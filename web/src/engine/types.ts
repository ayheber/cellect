export type Op = '+' | '-' | '*' | '~'
export type CellState = 'neutral' | 'selected' | 'disabled'
export type Solution = number[][]  // Solution[row] = sorted array of selected col indices

export const OPS: Op[] = ['+', '-', '*', '~']
export const OP_NAMES: Record<Op, string> = {
  '+': 'Addition',
  '-': 'Subtraction',
  '*': 'Multiplication',
  '~': 'Alternating ±',
}
export const OP_SYMBOLS: Record<Op, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '~': '±',
}
