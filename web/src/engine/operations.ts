import { Op } from './types'

/**
 * Apply an operation to a list of values.
 *
 * '+': left-to-right addition
 * '-': left-to-right subtraction (first - rest)
 * '*': left-to-right multiplication
 * '~': alternating ±: index 1,3,5… subtract; index 2,4,6… add
 *       so: a − b + c − d + e …  (first value always +, subsequent alternate)
 */
export function applyOp(values: number[], op: Op): number {
  if (values.length === 0) throw new Error('applyOp requires at least one value')

  if (op === '+') {
    return values.reduce((acc, v) => acc + v, 0)
  }

  if (op === '-') {
    return values.slice(1).reduce((acc, v) => acc - v, values[0])
  }

  if (op === '*') {
    return values.reduce((acc, v) => acc * v, 1)
  }

  // op === '~': alternating ±
  // Position 0 → add, position 1 → subtract, position 2 → add, ...
  return values.reduce((acc, v, i) => (i % 2 === 0 ? acc + v : acc - v), 0)
}

/**
 * Generator that yields all combinations of k indices chosen from [0, n).
 * Yields arrays in lexicographic order.
 */
export function* combinations(n: number, k: number): Generator<number[]> {
  if (k > n || k < 0) return

  const indices: number[] = Array.from({ length: k }, (_, i) => i)
  yield [...indices]

  while (true) {
    let i = k - 1
    while (i >= 0 && indices[i] === i + n - k) {
      i--
    }
    if (i < 0) return
    indices[i]++
    for (let j = i + 1; j < k; j++) {
      indices[j] = indices[j - 1] + 1
    }
    yield [...indices]
  }
}

/**
 * Returns all index arrays of size >= 2 where applyOp(selectedValues, op) === target.
 * Each returned array is a sorted list of column indices into `values`.
 */
export function validSubsets(values: number[], target: number, op: Op): number[][] {
  const results: number[][] = []
  const n = values.length

  for (let k = 2; k <= n; k++) {
    for (const combo of combinations(n, k)) {
      const selectedValues = combo.map(i => values[i])
      if (applyOp(selectedValues, op) === target) {
        results.push(combo)
      }
    }
  }

  return results
}
