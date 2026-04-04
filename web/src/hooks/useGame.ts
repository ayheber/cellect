import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { CellState, Op, Solution } from '../engine/types'
import { PuzzleData, generatePuzzle } from '../engine/generator'
import { getDailyPuzzle } from '../engine/daily'
import { applyOp } from '../engine/operations'
import { alreadySubmitted, loadSavedCells, saveCells } from '../engine/leaderboard'
import {
  solvePuzzle,
  minSteps,
  bestSolution,
  difficultyScore,
  difficultyLabel as computeDifficultyLabel,
} from '../engine/solver'
import {
  trackGameStarted,
  trackGameCompleted,
  trackGameAbandoned,
  trackOpGuessed,
  trackHintUsed,
} from '../analytics'

function makeCellStates(n: number): CellState[][] {
  return Array.from({ length: n }, () => new Array<CellState>(n).fill('neutral'))
}

function isDaily(puzzle: PuzzleData): boolean {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return puzzle.seed === parseInt(`${y}${m}${d}`, 10)
}

export function useGame(initialPuzzle: PuzzleData) {
  const [puzzle, setPuzzle] = useState<PuzzleData>(initialPuzzle)
  const [cellStates, setCellStates] = useState<CellState[][]>(() => {
    if (isDaily(initialPuzzle)) {
      const saved = loadSavedCells()
      if (saved) return saved
    }
    return makeCellStates(initialPuzzle.n)
  })
  const [steps, setSteps] = useState(0)
  const [opRevealed, setOpRevealed] = useState(!initialPuzzle.hiddenOp)

  // Ref to read cellStates synchronously (avoids stale closure in callbacks)
  const cellStatesRef = useRef(cellStates)
  cellStatesRef.current = cellStates

  const startTimeRef = useRef<number>(Date.now())
  // If already submitted today, mark solved as already fired to skip re-tracking
  const solvedFiredRef = useRef(isDaily(initialPuzzle) && alreadySubmitted())

  // Track game start whenever puzzle changes
  useEffect(() => {
    solvedFiredRef.current = false
    trackGameStarted(puzzle.op, puzzle.n, puzzle.hiddenOp, puzzle.negative, isDaily(puzzle))
  }, [puzzle])

  // Derived: solve puzzle (memoized — recomputes only when puzzle changes)
  const solutions: Solution[] = useMemo(
    () => solvePuzzle(puzzle.grid, puzzle.rowTargets, puzzle.colTargets, puzzle.op),
    [puzzle],
  )

  const minStepsCount: number | null = useMemo(
    () => (solutions.length > 0 ? minSteps(solutions) : null),
    [solutions],
  )

  const best: Solution = useMemo(
    () => (solutions.length > 0 ? bestSolution(solutions) : []),
    [solutions],
  )

  const score: number = useMemo(
    () => difficultyScore(puzzle.grid, puzzle.rowTargets, puzzle.op, puzzle.n),
    [puzzle],
  )

  const diffLabel: string = useMemo(() => computeDifficultyLabel(score), [score])

  // Per-row results based on current cell selections
  const rowResults: (number | null)[] = useMemo(() => {
    return puzzle.grid.map((row, r) => {
      const selected = (cellStates[r] ?? [])
        .map((state, c) => (state === 'selected' ? c : -1))
        .filter(c => c >= 0)
      if (selected.length < 2) return null
      return applyOp(selected.map(c => row[c]), puzzle.op)
    })
  }, [puzzle, cellStates])

  // Per-column results based on current cell selections
  const colResults: (number | null)[] = useMemo(() => {
    return Array.from({ length: puzzle.n }, (_, c) => {
      const selectedRows: number[] = []
      for (let r = 0; r < puzzle.n; r++) {
        if (cellStates[r]?.[c] === 'selected') selectedRows.push(r)
      }
      if (selectedRows.length < 2) return null
      return applyOp(selectedRows.map(r => puzzle.grid[r][c]), puzzle.op)
    })
  }, [puzzle, cellStates])

  // Puzzle is solved when all row and column results match their targets
  const isSolved: boolean = useMemo(() => {
    for (let r = 0; r < puzzle.n; r++) {
      if (rowResults[r] !== puzzle.rowTargets[r]) return false
    }
    for (let c = 0; c < puzzle.n; c++) {
      if (colResults[c] !== puzzle.colTargets[c]) return false
    }
    return true
  }, [puzzle, rowResults, colResults])

  // Auto-save daily puzzle cell states on every change (restores progress on reload)
  useEffect(() => {
    if (isDaily(puzzle)) {
      saveCells(cellStates)
    }
  }, [cellStates, puzzle])

  // Save elapsed time when daily puzzle is solved
  useEffect(() => {
    if (isSolved && isDaily(puzzle)) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
      localStorage.setItem(`cellect_daily_elapsed_${puzzle.seed}`, String(elapsed))
    }
  }, [isSolved, puzzle])

  // Fire analytics exactly once when puzzle is solved
  useEffect(() => {
    if (isSolved && !solvedFiredRef.current) {
      solvedFiredRef.current = true
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
      trackGameCompleted(
        puzzle.op,
        puzzle.n,
        steps,
        minStepsCount ?? steps,
        elapsed,
        puzzle.hiddenOp,
        puzzle.negative,
        isDaily(puzzle),
      )
    }
  }, [isSolved, puzzle, steps, minStepsCount])

  // ---- Actions ----

  /** Mark a neutral cell as selected (costs 1 step). */
  const selectCell = useCallback((r: number, c: number) => {
    const current = cellStatesRef.current[r]?.[c]
    if (current !== 'neutral') return
    setCellStates(prev => {
      const next = prev.map(row => [...row]) as CellState[][]
      next[r][c] = 'selected'
      return next
    })
    setSteps(s => s + 1)
  }, [])

  /** Mark a neutral cell as disabled (free — no step cost). */
  const disableCell = useCallback((r: number, c: number) => {
    const current = cellStatesRef.current[r]?.[c]
    if (current !== 'neutral') return
    setCellStates(prev => {
      const next = prev.map(row => [...row]) as CellState[][]
      next[r][c] = 'disabled'
      return next
    })
  }, [])

  /** Return any cell to neutral (free). */
  const clearCell = useCallback((r: number, c: number) => {
    const current = cellStatesRef.current[r]?.[c]
    if (current === 'neutral') return
    setCellStates(prev => {
      const next = prev.map(row => [...row]) as CellState[][]
      next[r][c] = 'neutral'
      return next
    })
  }, [])

  /**
   * Left-click: neutral/disabled → selected (+1 step), selected → neutral (free).
   */
  const toggleCell = useCallback((r: number, c: number) => {
    const current = cellStatesRef.current[r]?.[c] ?? 'neutral'
    setCellStates(prev => {
      const next = prev.map(row => [...row]) as CellState[][]
      next[r][c] = current === 'selected' ? 'neutral' : 'selected'
      return next
    })
    if (current !== 'selected') setSteps(s => s + 1)
  }, [])

  /**
   * Right-click: neutral/selected → disabled (free), disabled → neutral (free).
   */
  const toggleDisable = useCallback((r: number, c: number) => {
    const current = cellStatesRef.current[r]?.[c] ?? 'neutral'
    setCellStates(prev => {
      const next = prev.map(row => [...row]) as CellState[][]
      next[r][c] = current === 'disabled' ? 'neutral' : 'disabled'
      return next
    })
  }, [])

  /** Reset all cell states. Steps keep accumulating — resets are not free. */
  const reset = useCallback(() => {
    setCellStates(makeCellStates(puzzle.n))
    solvedFiredRef.current = false
  }, [puzzle.n])

  /** Guess the hidden operation. Reveals op only if correct. Returns true if correct. */
  const guessOp = useCallback(
    (op: string): boolean => {
      const correct = op === puzzle.op
      if (correct) setOpRevealed(true)
      trackOpGuessed(correct)
      return correct
    },
    [puzzle.op],
  )

  /** Select the next unselected cell from the best known solution. */
  const applyHint = useCallback(() => {
    if (best.length === 0) return
    const states = cellStatesRef.current
    for (let r = 0; r < best.length; r++) {
      for (const c of best[r]) {
        if (states[r]?.[c] !== 'selected') {
          trackHintUsed()
          setCellStates(prev => {
            const next = prev.map(row => [...row]) as CellState[][]
            next[r][c] = 'selected'
            return next
          })
          setSteps(s => s + 2)
          return
        }
      }
    }
  }, [best])

  /** Load a brand-new puzzle. Tracks abandonment if one was in progress. */
  const newGame = useCallback(
    (op: Op, n: number, seed?: number, hiddenOp?: boolean, negative?: boolean) => {
      if (steps > 0 && !isSolved) {
        trackGameAbandoned(puzzle.op, puzzle.n, steps, puzzle.hiddenOp)
      }
      const actualSeed = seed ?? Math.floor(Math.random() * 1_000_000_000)
      const newPuzzle = generatePuzzle(op, n, actualSeed, hiddenOp ?? false, negative ?? false)
      setPuzzle(newPuzzle)
      setCellStates(makeCellStates(n))
      setSteps(0)
      setOpRevealed(!newPuzzle.hiddenOp)
      startTimeRef.current = Date.now()
      solvedFiredRef.current = false
    },
    [puzzle, steps, isSolved],
  )

  /** Load today's daily puzzle. */
  const loadDaily = useCallback(() => {
    if (steps > 0 && !isSolved) {
      trackGameAbandoned(puzzle.op, puzzle.n, steps, puzzle.hiddenOp)
    }
    const daily = getDailyPuzzle()
    setPuzzle(daily)
    setCellStates(makeCellStates(daily.n))
    setSteps(0)
    setOpRevealed(!daily.hiddenOp)
    startTimeRef.current = Date.now()
    solvedFiredRef.current = false
  }, [puzzle, steps, isSolved])

  return {
    puzzle,
    cellStates,
    steps,
    opRevealed,
    startTime: startTimeRef.current,
    solutions,
    isSolved,
    rowResults,
    colResults,
    difficultyLabel: diffLabel,
    minStepsCount,
    best,
    selectCell,
    disableCell,
    clearCell,
    toggleCell,
    toggleDisable,
    reset,
    guessOp,
    applyHint,
    newGame,
    loadDaily,
  }
}
