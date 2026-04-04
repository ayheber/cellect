#!/usr/bin/env python3
"""
Cellect — a number selection puzzle game.

Rules:
  - 5x5 grid of numbers
  - Each row has a target at the right; each column has a target at the bottom
  - Select 2+ cells per row AND per column so that applying the daily
    operation (left→right / top→bottom) on the selected cells equals the target
  - Only selecting a cell counts as a step (disabling is free)
  - Minimum steps = perfect score

Commands:
  s <row> <col>  — Select cell (1-indexed, counts as a step)
  d <row> <col>  — Disable cell (mark with ✗, free)
  c <row> <col>  — Clear cell back to neutral
  reset          — Reset board (steps reset to 0)
  solve          — Show all solutions and minimum step count
  hint           — Auto-select the next unselected cell from the best solution
  q              — Quit
"""

import random
from itertools import combinations
from typing import List, Tuple, Optional, Set

# ANSI codes
GREEN  = '\033[42;1m'
DIM    = '\033[2m'
RESET  = '\033[0m'
BOLD   = '\033[1m'
YELLOW = '\033[33;1m'
RED    = '\033[31m'


# ---------------------------------------------------------------------------
# Core math helpers
# ---------------------------------------------------------------------------

OPS = ('+', '-', '*', '~')
OP_NAME = {
    '+': 'Addition',
    '-': 'Subtraction',
    '*': 'Multiplication',
    '/': 'Division',
    '~': 'Alternating ±',
}


def apply_op(values: List[int], op: str) -> int:
    """
    Apply operation left-to-right on an ordered list of values.

    Supported operations:
      +  standard addition
      -  standard subtraction
      *  standard multiplication
      /  integer division — raises ValueError for non-integer or zero divisor
      ~  alternating +/−: a − b + c − d + …  (first value positive, rest alternate)
    """
    result = values[0]
    for i, v in enumerate(values[1:], 1):
        if op == '+':
            result += v
        elif op == '-':
            result -= v
        elif op == '*':
            result *= v
        elif op == '/':
            if v == 0 or result % v != 0:
                raise ValueError(f"Invalid division: {result} / {v}")
            result //= v
        elif op == '~':
            # odd position (1, 3, 5…) → subtract; even position (2, 4, 6…) → add
            result = result - v if i % 2 == 1 else result + v
        else:
            raise ValueError(f"Unknown operation: {op!r}")
    return result


def valid_subsets(values: List[int], target: int, op: str) -> List[Tuple[int, ...]]:
    """Return all index-tuples (size >= 2, in order) where apply_op == target."""
    result = []
    for size in range(2, len(values) + 1):
        for indices in combinations(range(len(values)), size):
            try:
                if apply_op([values[i] for i in indices], op) == target:
                    result.append(indices)
            except ValueError:
                pass  # invalid division — skip this subset
    return result


# ---------------------------------------------------------------------------
# Solver
# ---------------------------------------------------------------------------

def solve_puzzle(
    grid: List[List[int]],
    row_targets: List[int],
    col_targets: List[int],
    op: str,
) -> List[List[Tuple[int, ...]]]:
    """
    Return every valid solution as a list of per-row selected-index tuples.
    Each solution is a list of 5 tuples, one per row.
    """
    n = len(grid)

    # Pre-compute valid subsets per row
    row_options: List[List[Tuple[int, ...]]] = []
    for r in range(n):
        opts = valid_subsets(grid[r], row_targets[r], op)
        if not opts:
            return []          # no solution possible
        row_options.append(opts)

    solutions: List[List[Tuple[int, ...]]] = []

    def backtrack(row: int, selection: List[Optional[Tuple[int, ...]]]):
        if row == n:
            # Verify all column constraints
            for c in range(n):
                vals = [grid[r][c] for r in range(n) if c in selection[r]]  # type: ignore[operator]
                try:
                    if len(vals) < 2 or apply_op(vals, op) != col_targets[c]:
                        return
                except ValueError:
                    return  # invalid division in column — discard
            solutions.append(list(selection))  # type: ignore[arg-type]
            return

        for subset in row_options[row]:
            selection[row] = subset
            backtrack(row + 1, selection)

        selection[row] = None

    backtrack(0, [None] * n)
    return solutions


# ---------------------------------------------------------------------------
# Game state
# ---------------------------------------------------------------------------

class Game:
    NEUTRAL  = 0
    SELECTED = 1
    DISABLED = 2

    def __init__(
        self,
        grid: List[List[int]],
        row_targets: List[int],
        col_targets: List[int],
        op: str,
        hidden_op: bool = False,
    ):
        self.grid         = grid
        self.row_targets  = row_targets
        self.col_targets  = col_targets
        self.op           = op
        self.n            = len(grid)
        self._state       = [[self.NEUTRAL] * self.n for _ in range(self.n)]
        self.steps        = 0
        self.hidden_op    = hidden_op
        self._op_revealed = not hidden_op
        self._solutions_cache: Optional[List] = None

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    def select(self, r: int, c: int) -> bool:
        """Select a cell. Returns True if it changed state (costs a step)."""
        if self._state[r][c] != self.SELECTED:
            self._state[r][c] = self.SELECTED
            self.steps += 1
            self._solutions_cache = None
            return True
        return False

    def disable(self, r: int, c: int):
        """Disable (cross out) a cell. Free action."""
        self._state[r][c] = self.DISABLED

    def clear(self, r: int, c: int):
        """Return a cell to neutral."""
        self._state[r][c] = self.NEUTRAL

    def reset(self):
        self._state     = [[self.NEUTRAL] * self.n for _ in range(self.n)]
        self.steps      = 0
        self._solutions_cache = None

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def is_selected(self, r: int, c: int) -> bool:
        return self._state[r][c] == self.SELECTED

    def is_disabled(self, r: int, c: int) -> bool:
        return self._state[r][c] == self.DISABLED

    def row_result(self, r: int) -> Optional[int]:
        vals = [self.grid[r][c] for c in range(self.n) if self.is_selected(r, c)]
        if len(vals) < 2:
            return None
        return apply_op(vals, self.op)

    def col_result(self, c: int) -> Optional[int]:
        vals = [self.grid[r][c] for r in range(self.n) if self.is_selected(r, c)]
        if len(vals) < 2:
            return None
        return apply_op(vals, self.op)

    def row_ok(self, r: int) -> bool:
        return self.row_result(r) == self.row_targets[r]

    def col_ok(self, c: int) -> bool:
        return self.col_result(c) == self.col_targets[c]

    def is_solved(self) -> bool:
        return all(self.row_ok(r) for r in range(self.n)) and \
               all(self.col_ok(c) for c in range(self.n))

    # ------------------------------------------------------------------
    # Hidden operation
    # ------------------------------------------------------------------

    def guess_op(self, op: str) -> bool:
        """
        Guess the hidden operation. Free action — no step cost.
        Returns True if correct (and reveals the operation).
        """
        if op == self.op:
            self._op_revealed = True
            return True
        return False

    # ------------------------------------------------------------------
    # Difficulty
    # ------------------------------------------------------------------

    def difficulty_score(self) -> int:
        """
        Product of valid-subset counts per row: ∏ V_r.
        Measures the size of the backtracking search space a player faces.
        Complexity: O(2^n × n) — just counting, no backtracking.
        """
        score = 1
        for r in range(self.n):
            v = len(valid_subsets(self.grid[r], self.row_targets[r], self.op))
            score *= max(1, v)
        return score

    def difficulty_label(self) -> str:
        score = self.difficulty_score()
        if score <= 50:    return 'Easy'
        if score <= 500:   return 'Medium'
        if score <= 5000:  return 'Hard'
        return 'Expert'

    # ------------------------------------------------------------------
    # Solver interface
    # ------------------------------------------------------------------

    def solutions(self) -> List:
        if self._solutions_cache is None:
            self._solutions_cache = solve_puzzle(
                self.grid, self.row_targets, self.col_targets, self.op
            )
        return self._solutions_cache

    def min_steps(self) -> Optional[int]:
        sols = self.solutions()
        if not sols:
            return None
        return min(sum(len(row_sel) for row_sel in sol) for sol in sols)

    def best_solution(self) -> Optional[List[Tuple[int, ...]]]:
        """Return a solution with minimum selected cells."""
        sols = self.solutions()
        if not sols:
            return None
        return min(sols, key=lambda sol: sum(len(r) for r in sol))

    # ------------------------------------------------------------------
    # Display
    # ------------------------------------------------------------------

    def display(self):
        if self._op_revealed:
            op_display = f"{BOLD}{OP_NAME.get(self.op, self.op)}{RESET}"
        else:
            op_display = f"{BOLD}{YELLOW}? (hidden — use: guess +/-/*){RESET}"

        label = self.difficulty_label()
        label_color = {'Easy': GREEN, 'Medium': YELLOW, 'Hard': RED, 'Expert': RED + BOLD}.get(label, '')
        print(f"\n  Operation: {op_display}    "
              f"Difficulty: {label_color}{label}{RESET}    "
              f"Steps: {BOLD}{self.steps}{RESET}")
        print()

        # Column headers
        print("       ", end="")
        for c in range(self.n):
            print(f"  C{c+1}  ", end="")
        print()
        print("      ┌" + "─────┬" * (self.n - 1) + "─────┐  TARGET")

        for r in range(self.n):
            print(f"  R{r+1}  │", end="")
            for c in range(self.n):
                val = self.grid[r][c]
                if self.is_selected(r, c):
                    cell = f"{GREEN} {val:>3} {RESET}"
                elif self.is_disabled(r, c):
                    cell = f"{DIM} {val:>3} {RESET}"
                else:
                    cell = f" {val:>3} "
                print(cell + "│", end="")

            # Row target + status (suppressed until op revealed)
            target = self.row_targets[r]
            if not self._op_revealed:
                status = f"  {target:>4}   ?"
            else:
                res = self.row_result(r)
                if res is None:
                    status = f"  {target:>4}   ?"
                elif res == target:
                    status = f"  {GREEN}{target:>4}{RESET}  {GREEN}✓{RESET}"
                else:
                    status = f"  {RED}{target:>4}  ✗ ({res}){RESET}"
            print(status)

            if r < self.n - 1:
                print("      ├" + "─────┼" * (self.n - 1) + "─────┤")

        print("      └" + "─────┴" * (self.n - 1) + "─────┘")

        # Column targets row
        print("  TGT  │", end="")
        for c in range(self.n):
            target = self.col_targets[c]
            res    = self.col_result(c) if self._op_revealed else None
            if res == target:
                print(f"{GREEN} {target:>3} {RESET}│", end="")
            else:
                print(f" {target:>3} │", end="")
        print()

        # Column results row (suppressed until op revealed)
        print("  RES  │", end="")
        for c in range(self.n):
            if not self._op_revealed:
                print(f"  {DIM}?{RESET}   │", end="")
            else:
                res    = self.col_result(c)
                target = self.col_targets[c]
                if res is None:
                    print(f"  {DIM}?{RESET}   │", end="")
                elif res == target:
                    print(f"{GREEN} {res:>3} {RESET}│", end="")
                else:
                    print(f"{RED} {res:>3} {RESET}│", end="")
        print()

        if self._op_revealed and self.is_solved():
            min_s = self.min_steps()
            if self.steps == min_s:
                print(f"\n  {GREEN}{BOLD}PERFECT! Solved in minimum {self.steps} steps!{RESET}")
            else:
                print(f"\n  {YELLOW}{BOLD}SOLVED in {self.steps} steps "
                      f"(minimum possible: {min_s}){RESET}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

RULES = """
HOW TO PLAY
  You have a grid of numbers. Each row has a target on the right; each column
  has a target at the bottom. The daily operation (+, -, *, /, or ±) is shown
  at the top (or hidden, if you chose that mode).

  Your goal: select 2 or more cells in every row and every column so that
  applying the operation left-to-right (rows) or top-to-bottom (columns) on
  the selected cells equals the target.

  Rules:
    • Every row must have ≥ 2 selected cells whose result matches the row target.
    • Every column must have ≥ 2 selected cells whose result matches the column target.
    • Selecting a cell costs 1 step. Fewer steps = better score.
    • Disabling a cell (marking it with ✗) is free — use it to rule out cells.

  Operations:
    +   addition:          a + b + c …
    -   subtraction:       a - b - c …
    *   multiplication:    a × b × c …
    ~   alternating ±:     a - b + c - d …

  Hidden op mode: the operation is not shown. Use `guess <op>` to reveal it
  before you can see row/column feedback.
"""

HELP = """
Commands:
  s <row> <col>            Select a cell (1-indexed) — costs 1 step
  d <row> <col>            Disable a cell (free — use to rule out cells)
  c <row> <col>            Clear a cell back to neutral
  reset                    Reset the whole board
  new [op] [size] [seed] [neg] [hidden]  Generate a new puzzle
                             op:     +  -  *  ~  (default: +)
                                     ~ = alternating +/- (a-b+c-d…)
                             size:   grid dimension, e.g. 5 6 7  (default: 5)
                             seed:   any integer for reproducibility
                             neg:    allow negative numbers in the grid
                             hidden: hide the operation for extra difficulty
  guess <op>               Guess the hidden operation — free action
  solve                    Show all solutions and the minimum step count
  hint                     Auto-select the next cell from the optimal solution
  rules                    Show the full rules
  q / quit                 Exit
"""


# ---------------------------------------------------------------------------
# Puzzle generator
# ---------------------------------------------------------------------------

def _pick_row_size(rng: random.Random) -> int:
    """Return 2 (50%), 3 (35%), or 4 (15%)."""
    r = rng.random()
    if r < 0.50: return 2
    if r < 0.85: return 3
    return 4


def _random_selection(n: int, rng: random.Random) -> List[Set[int]]:
    """
    Return a list of n sets (one per row) such that:
      - each row set has 2, 3, or 4 elements (chosen from 0..n-1)
      - each column index appears in at least 2 row sets
    """
    while True:
        counts = [0] * n
        selection: List[Set[int]] = [set() for _ in range(n)]

        for r in range(n):
            k = min(n, _pick_row_size(rng))
            cols = list(range(n))
            weights = [4 if counts[c] < 2 else 1 for c in cols]
            chosen = rng.choices(cols, weights=weights, k=k)
            # ensure distinct
            chosen = list(dict.fromkeys(chosen))
            while len(chosen) < k:
                extra = rng.choices([c for c in cols if c not in chosen],
                                    weights=[4 if counts[c] < 2 else 1
                                             for c in cols if c not in chosen], k=1)
                chosen += extra
            for c in chosen:
                selection[r].add(c)
                counts[c] += 1

        ok = True
        for c in range(n):
            if counts[c] < 2:
                ok = False
                candidates = [r for r in range(n) if c not in selection[r]]
                if len(candidates) < 2:
                    break
                for r in rng.sample(candidates, 2):
                    selection[r].add(c)
                    counts[c] += 1
        if ok:
            return selection


def generate_puzzle(
    op: str = '+',
    n: int = 5,
    min_val: int = 1,
    max_val: int = 15,
    seed: Optional[int] = None,
    hidden_op: bool = False,
    negative: bool = False,
) -> "Game":
    """
    Generate a valid puzzle.

    For +, -, *, ~: O(n²) — construct from a fixed selection, no retries.
    For /: retries until the chosen selection divides cleanly at every step.
    The solver runs lazily (only when the user calls `solve`, `hint`,
    or requests min_steps), so generation itself is fast.
    Multiple solutions are fine — min_steps accounts for all of them.
    """
    rng = random.Random(seed)

    while True:
        # 1. Random grid (negative mode widens range to include negatives)
        lo = -max_val if negative else min_val
        grid = [[rng.randint(lo, max_val) for _ in range(n)] for _ in range(n)]

        # 2. Random selection pattern (≥2 per row, ≥2 per col — guaranteed)
        selection = _random_selection(n, rng)

        # 3. Compute targets directly from the selection.
        #    Division can fail if the selected values don't divide cleanly;
        #    in that case retry with a new grid/selection.
        try:
            row_targets = [
                apply_op([grid[r][c] for c in sorted(selection[r])], op)
                for r in range(n)
            ]
            col_targets = [
                apply_op([grid[r][c] for r in range(n) if c in selection[r]], op)
                for c in range(n)
            ]
        except ValueError:
            continue  # only reachable for op='/'

        return Game(grid, row_targets, col_targets, op, hidden_op=hidden_op)


def make_example_puzzle() -> Game:
    """
    A sample addition puzzle.

    Intended solution (selected cells marked with *):
      Row 0: cols 1, 3  →  *8 + 3 + *6 + 2 + 7  (select 0,2)  8+6=14
      ...  (run `solve` to see the full solution)

    Grid:
        8  3  6  2  7   | 14
        4  9  1  5  3   | 12
        7  2  8  4  6   | 11
        3  6  4  9  2   |  6
        5  1  7  3  8   |  4
       ─────────────────
       15 10 10  7  5
    """
    grid = [
        [8, 3, 6, 2, 7],
        [4, 9, 1, 5, 3],
        [7, 2, 8, 4, 6],
        [3, 6, 4, 9, 2],
        [5, 1, 7, 3, 8],
    ]
    row_targets = [14, 12, 11, 6, 4]
    col_targets = [15, 10, 10, 7, 5]
    op = '+'
    return Game(grid, row_targets, col_targets, op)


def run():
    print(f"\n{BOLD}Welcome to Cellect!{RESET}")
    print(RULES)
    print(HELP)

    game = make_example_puzzle()
    game.display()

    while True:
        try:
            raw = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not raw:
            continue

        parts = raw.lower().split()
        cmd   = parts[0]

        if cmd in ('q', 'quit'):
            break

        elif cmd == 'rules':
            print(RULES)

        elif cmd == 'reset':
            game.reset()
            game.display()

        elif cmd == 'new':
            op       = next((p for p in parts[1:] if p in OPS), '+')
            hidden   = 'hidden' in parts
            negative = 'neg' in parts
            keywords = OPS + ('hidden', 'neg')
            ints     = []
            for p in parts[1:]:
                if p not in keywords:
                    try:
                        ints.append(int(p))
                    except ValueError:
                        print(f"  Ignoring unknown argument: {p!r}")
            size = ints[0] if len(ints) >= 1 else 5
            seed = ints[1] if len(ints) >= 2 else None
            if size < 3 or size > 12:
                print(f"  Size must be between 3 and 12. Got {size}.")
            else:
                game = generate_puzzle(op=op, n=size, seed=seed,
                                       hidden_op=hidden, negative=negative)
                game.display()

        elif cmd == 'guess':
            if len(parts) != 2 or parts[1] not in OPS:
                print("  Usage: guess <op>   where op is +, -, or *")
            elif not game.hidden_op:
                print("  This puzzle doesn't have a hidden operation.")
            elif game._op_revealed:
                print("  Operation is already revealed.")
            elif game.guess_op(parts[1]):
                print(f"  Correct! Operation is {OP_NAME[game.op]}.")
                game.display()
            else:
                print("  Wrong — try again.")

        elif cmd == 'solve':
            if game.hidden_op and not game._op_revealed:
                print("  Guess the operation first (guess +/-/*).")
            else:
                sols = game.solutions()
                if not sols:
                    print("  No solution exists for this puzzle.")
                else:
                    min_s = game.min_steps()
                    print(f"  Found {len(sols)} solution(s).  Minimum steps: {BOLD}{min_s}{RESET}")
                    best = game.best_solution()
                    print("  Optimal solution (selected columns per row):")
                    for r, row_sel in enumerate(best):
                        cols = [c + 1 for c in sorted(row_sel)]
                        print(f"    Row {r+1}: columns {cols}")

        elif cmd == 'hint':
            if game.hidden_op and not game._op_revealed:
                print("  Guess the operation first (guess +/-/*).")
                continue
            best = game.best_solution()
            if best is None:
                print("  No solution found!")
            else:
                for r in range(game.n):
                    for c in sorted(best[r]):
                        if not game.is_selected(r, c):
                            print(f"  Hint: selecting row {r+1}, col {c+1}")
                            game.select(r, c)
                            game.display()
                            break
                    else:
                        continue
                    break
                else:
                    print("  All optimal cells are already selected!")

        elif cmd in ('s', 'd', 'c') and len(parts) == 3:
            try:
                r, c = int(parts[1]) - 1, int(parts[2]) - 1
            except ValueError:
                print("  Row and col must be integers.")
                continue

            if not (0 <= r < game.n and 0 <= c < game.n):
                print(f"  Row and col must be between 1 and {game.n}.")
                continue

            if cmd == 's':
                game.select(r, c)
            elif cmd == 'd':
                game.disable(r, c)
            else:
                game.clear(r, c)

            game.display()

        else:
            print(HELP)


if __name__ == '__main__':
    run()
