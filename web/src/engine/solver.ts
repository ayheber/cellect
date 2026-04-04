import { Op, Solution } from './types'
import { applyOp, validSubsets } from './operations'

/**
 * Solves the puzzle using backtracking.
 *
 * For each row, enumerate all valid index subsets. Recurse row-by-row.
 * At the bottom (all rows assigned), verify all column constraints hold.
 * Returns all valid solutions.
 */
export function solvePuzzle(
  grid: number[][],
  rowTargets: number[],
  colTargets: number[],
  op: Op,
): Solution[] {
  const n = grid.length
  const solutions: Solution[] = []

  // Precompute valid subsets for each row to avoid recomputation
  const rowCandidates: number[][][] = grid.map((row, r) =>
    validSubsets(row, rowTargets[r], op),
  )

  function backtrack(rowIdx: number, current: Solution): void {
    if (rowIdx === n) {
      // Verify column constraints
      for (let c = 0; c < n; c++) {
        const colValues: number[] = []
        for (let r = 0; r < n; r++) {
          if (current[r].includes(c)) {
            colValues.push(grid[r][c])
          }
        }
        if (colValues.length < 2) return
        if (applyOp(colValues, op) !== colTargets[c]) return
      }
      solutions.push(current.map(row => [...row]))
      return
    }

    for (const subset of rowCandidates[rowIdx]) {
      current.push(subset)
      backtrack(rowIdx + 1, current)
      current.pop()
    }
  }

  backtrack(0, [])
  return solutions
}

/**
 * Returns the minimum total number of cell selections needed across all solutions.
 * Each solution's "steps" = total count of selected cells.
 */
export function minSteps(solutions: Solution[]): number {
  if (solutions.length === 0) return 0
  return Math.min(...solutions.map(sol => sol.reduce((acc, row) => acc + row.length, 0)))
}

/**
 * Returns the solution with fewest total selected cells.
 * Ties broken by picking the first encountered.
 */
export function bestSolution(solutions: Solution[]): Solution {
  if (solutions.length === 0) return []
  return solutions.reduce((best, sol) => {
    const bestCount = best.reduce((acc, row) => acc + row.length, 0)
    const solCount = sol.reduce((acc, row) => acc + row.length, 0)
    return solCount < bestCount ? sol : best
  })
}

/**
 * Difficulty score = product of valid subset counts per row.
 * Higher means more ambiguity and thus harder.
 */
export function difficultyScore(
  grid: number[][],
  rowTargets: number[],
  op: Op,
  n: number,
): number {
  let score = 1
  for (let r = 0; r < n; r++) {
    const count = validSubsets(grid[r], rowTargets[r], op).length
    score *= Math.max(count, 1)
  }
  return score
}

/**
 * Maps a difficulty score to a human-readable label.
 * ≤50: Easy, ≤500: Medium, ≤5000: Hard, else: Expert
 */
export function difficultyLabel(score: number): 'Easy' | 'Medium' | 'Hard' | 'Expert' {
  if (score <= 50) return 'Easy'
  if (score <= 500) return 'Medium'
  if (score <= 5000) return 'Hard'
  return 'Expert'
}
