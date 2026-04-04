# Cellect — Design Notes

## What is it?

A number-selection puzzle. An n×n grid of integers (positive, or positive and
negative in hard mode) is shown with a target value at the end of each row and
at the bottom of each column. The player selects 2 or more cells per row and
per column so that applying the day's operation left-to-right / top-to-bottom
on the selected cells equals the target. Selecting a cell costs one step; fewer
steps = better score.

### Rules (as shown to the player)

- Every row must have ≥ 2 selected cells whose result matches the row target.
- Every column must have ≥ 2 selected cells whose result matches the column target.
- Operations apply left-to-right (rows) and top-to-bottom (columns).
- Selecting a cell costs 1 step. Disabling (crossing out) a cell is free.
- Minimum steps across all valid solutions = perfect score.

### Supported operations

| Symbol | Name | Formula |
|---|---|---|
| `+` | Addition | a + b + c … |
| `-` | Subtraction | a − b − c … |
| `*` | Multiplication | a × b × c … |
| `~` | Alternating ± | a − b + c − d … |

### Difficulty modifiers

- **Grid size** — default 5×5, supports 3×3 to 7×7 for comfortable play.
- **Negative numbers** (`neg` flag) — grid values drawn from [−max, +max] instead
  of [1, max]. Targets can be negative. Makes subtraction and alternating ±
  significantly harder to reason about.
- **Hidden operation** (`hidden` flag) — the operation is not shown. Row/column
  feedback is suppressed until the player guesses the operation correctly.

---

## How we built it

### 1. Model the game state first

Before any solver or generator, we defined the core data:

- A 5×5 `grid` of integers.
- `row_targets` and `col_targets` — the expected result for each row/column.
- A single `op` (+, −, ×) that applies uniformly across the whole board.
- Per-cell state: `NEUTRAL | SELECTED | DISABLED`.
- A `steps` counter that increments only on select (disable is free).

The key insight that shapes everything else: **a selected cell participates
simultaneously in its row constraint AND its column constraint**. The two
constraint sets are coupled through the shared selection matrix — you cannot
solve rows and columns independently.

### 2. Define the constraint

For row `r` with selected columns `{c1, c2, …}` (left to right):

```
grid[r][c1]  OP  grid[r][c2]  OP  …  ==  row_target[r]
```

For column `c` with selected rows `{r1, r2, …}` (top to bottom):

```
grid[r1][c]  OP  grid[r2][c]  OP  …  ==  col_target[c]
```

Both must hold for every row and column simultaneously.

### 3. Solver — backtracking over row subsets

Rather than treating 25 binary variables independently (2²⁵ ≈ 33 M states),
we exploit the row structure:

1. **Enumerate valid row subsets.** For each row independently, generate all
   index subsets of size ≥ 2 using `combinations`. Keep only those where
   `apply_op` equals the row target. Call this count `V_r` (branching factor
   for row `r`).

2. **Backtrack depth-first.** Assign a valid subset to row 0, then row 1, etc.
   At depth 5 (all rows assigned), verify all 5 column constraints in O(n²).

3. **Collect all solutions.** Multiple solutions are fine — `min_steps` is the
   minimum total selected cells across all of them.

### 4. Generator — construct, don't search

A naive approach would sample random targets and then check whether a solution
exists. We reversed the direction:

1. Sample a random grid.
2. Pick a random *selection pattern* (which cells are "on"), ensuring every row
   and every column has ≥ 2 selected cells.
3. Derive targets directly from that pattern.

The selected cells are a valid solution **by construction** — no solver needed
at generation time. The solver runs lazily only when the player requests a hint,
`solve`, or the minimum step count.

### 5. Difficulty rating — count, don't solve

The search space a human player must mentally traverse is exactly the
backtracking tree before column pruning kicks in. Its size is:

```
difficulty_score = ∏ V_r   (product of valid-subset counts per row)
```

This is computed by counting valid subsets per row — no backtracking needed.

### 6. Hidden operation mode

An optional harder mode where the operation is not revealed upfront. The board
and targets are shown normally, but the operation label is hidden. Row and
column result feedback is suppressed until the player guesses the operation
correctly with `guess <op>` (a free action). The player must reason about which
operation is consistent with the numbers and targets before solving.

---

## Complexity

The grid size `n` is variable (default 5, supported up to ~7 for comfortable
play). Each operation is analysed below, with measured timings across grid sizes.

### Generating a new puzzle

Grid fill and target computation are O(n²). The dominant practical cost is
`_random_selection`, which uses a weighted retry loop to guarantee every column
gets ≥ 2 selected cells. The expected number of retries grows with n (harder to
cover all columns uniformly at random in a single pass), making empirical growth
closer to **O(n³)** than O(n²) — though still fast at all practical sizes.

| n | Measured time |
|---|---|
| 4 | 0.10 ms |
| 5 | 0.37 ms |
| 6 | 1.16 ms |
| 7 | 4.92 ms |
| 8 | 18.3 ms |

### Difficulty rating — O(n² · 2^n)

For each of the n rows, enumerate all index subsets of size ≥ 2 — there are
`2ⁿ − n − 1` of them, each checked in O(n) — and count those where
`apply_op == row_target`. Multiply the n counts. No backtracking involved.

Per row: O(2^n · n). Over all n rows: **O(n² · 2^n)**.

| n | 2^n | Measured time |
|---|---|---|
| 4 | 16 | 0.015 ms |
| 5 | 32 | 0.038 ms |
| 6 | 64 | 0.095 ms |
| 7 | 128 | 0.238 ms |
| 8 | 256 | 0.562 ms |

Purely exponential growth, but remains sub-millisecond up to n=8.

**Rating thresholds** (product of per-row valid-subset counts):

| Score | Label |
|---|---|
| ≤ 50 | Easy |
| ≤ 500 | Medium |
| ≤ 5 000 | Hard |
| > 5 000 | Expert |

### Solving — O(V^n · n²)

Let **V** = average number of valid row subsets (those where `apply_op == target`).

- The backtracking tree has depth n and branching factor V → **O(V^n)** nodes.
- At each leaf, verifying all n columns costs **O(n²)**.
- Total: **O(V^n · n²)**.

Two things grow with n: the tree is deeper (exponent increases), and V itself
grows because a longer row has more candidate subsets even at the same hit rate.
These compound, making the solver the most n-sensitive operation by far:

| n | avg solve time | max solve time |
|---|---|---|
| 4 | 0.02 ms | 0.1 ms |
| 5 | 0.05 ms | 0.1 ms |
| 6 | 0.23 ms | 1.1 ms |
| 7 | 2.74 ms | 21.9 ms |
| 8 | 452 ms | ~14 s |

**Practical limit: n ≤ 7** for real-time solve/hint. At n=8 the average is
acceptable but worst-case outlier puzzles (high V across all rows) can take
many seconds.

**The solver runs exactly once — for the true op only.**

A naïve approach to checking operation ambiguity would run the solver for all
four operations and compare. That would cost **4 × O(V^n · n²)** — same
complexity class, constant factor only. We skip it because op-ambiguity is
empirically impossible with random integer grids (0 cases in 5,000 puzzles):
satisfying all `2n` row and column targets simultaneously under a second
operation requires a coincidence that random integers essentially never produce.
The solver therefore runs once, not five times, and the cost stays O(V^n · n²).

**How the choice of operation affects V — and therefore solver speed:**

Adding new operations does not change the algorithmic complexity. It is always
O(V^n · n²). What changes is the concrete value of V, which is entirely
determined by how many cell subsets happen to produce the row target under that
operation.

| Operation | Measured avg_V (n=5) | Solver avg/max | Notes |
|---|---|---|---|
| `+` Addition | 1.73 | 0.07 ms / 0.1 ms | Baseline |
| `−` Subtraction | 1.69 | 0.07 ms / 0.1 ms | Baseline |
| `*` Multiplication | 1.72 | 0.09 ms / 0.4 ms | — |
| `~` Alternating ± | 2.2 | 0.10 ms / 0.1 ms | More subsets hit alternating targets |

All four operations produce V ≈ 1.7–2.2, keeping the solver under 1 ms at n=5.

**Why division (`/`) makes generation very expensive:**

Division is **not closed over integers**: `a / b` is only a whole number when
`b` divides `a` evenly. All other operations (`+`, `-`, `*`, `~`) are closed —
applying them to any integers always yields an integer, so step 3 of the
generator (compute targets from the selection) always succeeds.

For division it can fail, so the generator falls into a retry loop:

```
while True:
    grid    = random values (1–15)    # always fine
    pattern = random selection        # always fine
    targets = apply_op(selection, /) # raises ValueError for 12/7, 5/3, …
    → retry
```

The probability that a single 2-cell selection `(a, b)` divides cleanly is
roughly `1/b` on average. Across the 1–15 range that works out to about **20%
per pair**. The generator needs every selected pair in every row and every
column to divide cleanly simultaneously — that is 10 independent constraints
(5 rows + 5 columns) for a 5×5 grid:

```
P(all 10 clean) ≈ 0.20¹⁰ ≈ 1 in 10,000,000
```

Measured result: **168 seconds** to generate a single puzzle (seed=42).

The fix requires reversing the construction logic for division: instead of
"pick random values → check if they divide", you build values that are
*guaranteed* to divide by construction — pick the target first, pick `b`, set
`a = target × b`. But those constructed values must also satisfy the column
constraints for the shared selection, which requires a completely different
generator design. Division is left as a future enhancement for that reason.

**Other potential operations** (Max, Min, GCD, Power, Modulo) follow the same
pattern. The complexity form O(V^n · n²) never changes — only the constant
inside V moves. Max/Min would inflate V (many subsets share the same maximum,
slowing the solver). Power/Modulo/Division shrink V toward zero (faster solver,
but generation breaks with random integers for the same reason as division).
Adding any new op is a one-line change to `apply_op`; the hard part is always
ensuring the generator can produce valid puzzles efficiently.

**Effect of negative numbers on V:**

Allowing negative grid values (range [−max, +max] instead of [1, max]) roughly
doubles the number of candidate values per cell, which increases the number of
subsets that hit any given target. In practice V grows modestly (perhaps 2–4×),
since targets also shift into a wider range making any specific target harder to
hit by chance. The complexity class stays O(V^n · n²); only the constant inside
V changes. For the player, negative numbers are significantly harder to reason
about mentally — the algorithmic cost is minor.

Other operations one could imagine adding (Max, Min, GCD, Power) follow the
same pattern: the form O(V^n · n²) never changes. Max/Min would inflate V
dramatically (many subsets share the same maximum), slowing the solver.
Power/Modulo would shrink V toward zero, making the solver trivial but
generation harder. The complexity formula stays; only the constant inside V
moves.

### Validating a player's current selection — O(n²)

Read selected cells for each row and column, apply the operation, compare to
target. Completely unaffected by the exponential terms above.

Total: **O(n²)** — fast at all grid sizes, always.

---

## Summary

| Operation | Complexity | n=5 | n=6 | n=7 | n=8 |
|---|---|---|---|---|---|
| Generate puzzle | O(n³) empirical | 0.37 ms | 1.16 ms | 4.92 ms | 18 ms |
| Difficulty rating | O(n² · 2^n) | 0.04 ms | 0.10 ms | 0.24 ms | 0.56 ms |
| Solve (avg / max) | O(V^n · n²) | 0.05 / 0.1 ms | 0.23 / 1.1 ms | 2.7 / 22 ms | 452 / 14 000 ms |
| Check player selection | O(n²) | < 0.05 ms | < 0.05 ms | < 0.05 ms | < 0.05 ms |

The only operation sensitive to `n` in a game-breaking way is the solver.
Generation and difficulty rating stay fast up to n=8. Check-selection is always
free. **Recommended max for interactive play: n=7.**

The solver runs once, for the true op only. Checking all three ops for
ambiguity would multiply solver cost by 3 — same complexity class — but is
unnecessary: op-ambiguity is empirically impossible with random integer grids.

---

## Operation ambiguity

**Can the same targets be satisfied by a different operation?**

We solver only for the true op — we never check the other two. The question is
whether this could ever produce a wrong `min_steps` or let a player "solve" a
hidden-op puzzle with the wrong operation.

**Short answer: it cannot, in practice.**

For a set of targets to be satisfiable by two different operations, a single
valid selection must satisfy ALL `n` row targets AND all `n` column targets
simultaneously under both ops. While it's easy to find a single row where the
same target is reachable by + and −, adding column constraints makes it
combinatorially near-impossible with random integers.

Verified empirically: scanning 5 000 generated puzzles across all three
operations found **zero op-ambiguous puzzles**.

**Why the column constraints are decisive:**

Row targets are derived as `apply_op(selected_row_values, true_op)`. For the
same target to be reachable by a different op with some cell selection, those
cells must also produce the column targets under that op. Both the row and
column targets were computed from the same op and the same selection — a second
op satisfying all 10 targets simultaneously with any selection is essentially
impossible with random integer grids.

**The one real gap — hidden op mode:**

`solve` and `hint` used to work before the player guessed the operation,
leaking cell positions while the op was still unknown. This was fixed: both
commands now require the op to be guessed first when hidden.

---

## Daily puzzle — how everyone gets the same puzzle

The daily puzzle uses **no server**. The seed is simply today's date formatted
as an integer:

```
seed = YYYYMMDD   e.g. 20260404
```

The **operation** is derived directly from the seed with no randomness at all:

```ts
const op = OPS[seed % 4]   // OPS = ['+', '-', '*', '~']
```

`20260404 % 4 = 0` → `+`, `20260405 % 4 = 1` → `−`, and so on — cycling
through all four operations day by day. Since everyone computes the same seed,
they get the same remainder and therefore the same operation.

The seed is then fed into a **Mulberry32** seeded PRNG — a deterministic
function that always produces the same sequence of pseudo-random numbers for a
given seed. The generator uses that sequence to fill the grid and build the
selection pattern.

Because every player's browser runs the same deterministic algorithm with the
same seed, every player gets the same puzzle.

**One caveat: local time.** The seed is derived from the user's local clock, not
a canonical server clock. A player in Tokyo therefore receives "tomorrow's"
puzzle about 9 hours before a player in New York. This is a deliberate tradeoff
— eliminating it would require a server to canonicalize the date. Most daily
puzzle games (Wordle included) accept this behaviour.

**Why Mulberry32?** It is a simple, fast, seedable integer hash — exactly what
is needed for a deterministic browser-side PRNG with no dependencies. The
standard `Math.random()` is not seedable and would produce a different puzzle on
every page load.

---

## What's next

Two directions we want to explore:

### Difficulty-controlled generation

Right now the generator produces puzzles of random difficulty. The next step is
to target a specific difficulty band (Easy / Medium / Hard / Expert) by
re-rolling the grid values or the selection pattern until `difficulty_score`
falls in the desired range. Both generation and difficulty scoring are fast
(sub-5 ms at n=7), so this is just a tight retry loop with no meaningful cost.

### Hidden operation — deeper integration

The current hidden-op mode withholds result feedback until the player guesses
the operation. Future ideas within this theme:

- **Partial reveal** — after the player selects a full row, show only whether
  the row result matches the target (✓/✗) without revealing the operation
  itself. A correct row is a strong signal; a wrong row narrows down
  possibilities.
- **Operation-per-row** — each row has its own operation (all still hidden or
  revealed one at a time). A significantly harder variant.
