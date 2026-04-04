import { Op } from './types'
import { RNG } from './rng'
import { applyOp } from './operations'

export interface PuzzleData {
  grid: number[][]
  rowTargets: number[]
  colTargets: number[]
  op: Op
  n: number
  seed: number
  hiddenOp: boolean
  negative: boolean
}

/**
 * Generates a puzzle guaranteed to have at least one valid solution.
 *
 * Algorithm:
 * 1. Fill an n×n grid with random integers.
 * 2. Randomly assign a "selection pattern": each row picks exactly 2 columns,
 *    and we ensure every column is selected in at least 2 rows.
 * 3. Compute row/col targets from that canonical selection.
 *
 * This guarantees the puzzle is solvable (the generator's selection is a valid solution).
 */
export function generatePuzzle(
  op: Op,
  n: number,
  seed: number,
  hiddenOp: boolean,
  negative: boolean,
): PuzzleData {
  const rng = new RNG(seed)

  const minVal = negative ? -9 : 1
  const maxVal = 9

  // Fill grid with random integers
  const grid: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => rng.randInt(minVal, maxVal)),
  )

  // Build a valid selection pattern:
  // Each row selects exactly 2 columns.
  // Every column must appear in at least 2 rows.
  // Use a weighted retry loop to achieve column coverage.
  const selection = buildSelection(rng, n)

  // Compute row targets
  const rowTargets: number[] = selection.map((selectedCols, r) => {
    const values = selectedCols.map(c => grid[r][c])
    return applyOp(values, op)
  })

  // Compute column targets: for each col, gather all rows that selected it
  const colTargets: number[] = Array.from({ length: n }, (_, c) => {
    const selectedRows: number[] = []
    for (let r = 0; r < n; r++) {
      if (selection[r].includes(c)) selectedRows.push(r)
    }
    const values = selectedRows.map(r => grid[r][c])
    return applyOp(values, op)
  })

  return { grid, rowTargets, colTargets, op, n, seed, hiddenOp, negative }
}

/**
 * Builds a selection pattern for an n×n grid where:
 * - Each row selects 2, 3, or 4 columns (randomly weighted: 50% / 35% / 15%)
 * - Every column appears in at least 2 selected rows
 *
 * More cells per row makes puzzles richer and harder. The column-coverage
 * constraint is easier to satisfy when rows are larger (more total cells).
 */
function buildSelection(rng: RNG, n: number): number[][] {
  const maxAttempts = 1000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const selection: number[][] = []
    const colCounts: number[] = new Array(n).fill(0)

    for (let r = 0; r < n; r++) {
      // Choose how many cells to select in this row: 2, 3, or 4
      // Capped at n (can't select more columns than exist)
      const k = Math.min(n, pickRowSize(rng))

      // Weight under-represented columns higher
      const weights: number[] = Array.from({ length: n }, (_, c) =>
        colCounts[c] < 2 ? 4 : 1,
      )

      const cols = weightedSampleK(rng, n, k, weights)
      cols.sort((a, b) => a - b)
      selection.push(cols)
      for (const c of cols) colCounts[c]++
    }

    if (colCounts.every(cnt => cnt >= 2)) return selection
  }

  return fallbackSelection(n)
}

/** Returns 2 with p=0.50, 3 with p=0.35, 4 with p=0.15. */
function pickRowSize(rng: RNG): number {
  const r = rng.next()
  if (r < 0.50) return 2
  if (r < 0.85) return 3
  return 4
}

/**
 * Picks k distinct column indices using weighted sampling without replacement.
 */
function weightedSampleK(rng: RNG, _n: number, k: number, weights: number[]): number[] {
  const result: number[] = []
  const remaining = [...weights]

  for (let i = 0; i < k; i++) {
    const total = remaining.reduce((a, b) => a + b, 0)
    let r = rng.next() * total
    let picked = remaining.length - 1
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j]
      if (r <= 0) { picked = j; break }
    }
    result.push(picked)
    remaining[picked] = 0   // exclude from future picks
  }

  return result
}

/**
 * Fallback: cycle through columns to guarantee coverage.
 */
function fallbackSelection(n: number): number[][] {
  return Array.from({ length: n }, (_, r) => {
    const a = r % n
    const b = (r + 1) % n
    return [Math.min(a, b), Math.max(a, b)]
  })
}
