import { OPS } from './types'
import { generatePuzzle, PuzzleData } from './generator'

/**
 * Returns today's date as a YYYYMMDD integer, e.g. 20260403.
 * Uses local time so the puzzle resets at midnight for the user.
 */
export function getDailySeed(): number {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return parseInt(`${y}${m}${d}`, 10)
}

/**
 * Returns today's daily puzzle.
 * - Seed: today's date as YYYYMMDD integer
 * - Op: OPS[seed % 4] cycles through +, -, *, ~ day by day
 * - Grid size: 5×5
 * - hiddenOp: false (daily puzzles always show the operation)
 * - negative: false
 */
export function getDailyPuzzle(): PuzzleData {
  const seed = getDailySeed()
  const op = OPS[seed % 4]
  return generatePuzzle(op, 5, seed, false, false)
}
