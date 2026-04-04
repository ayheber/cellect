# Blog Post Draft — "I Reverse-Engineered Let's Calculate (and Made It Harder)"

## Target audience
Players of the Let's Calculate game who are curious / technically minded.
No CS degree required for the first half; complexity section is for developers.

---

## Hook (opening)

- You play Let's Calculate every day. You know the drill: one grid, one operation,
  five minutes of satisfying number-crunching.
- And then it's gone. One puzzle. Two if you subscribe.
- I started wondering: how hard is it to generate more? And why does the game
  only offer three operations — addition, subtraction, multiplication — and never
  division?
- Spoiler: division is *broken* in a mathematically interesting way. More on that.
- I built a fully working clone in Python, open source, with extra difficulty
  modes the original doesn't have.

---

## What the game actually is (brief, for context)

- 5×5 grid of integers
- Target number at the end of every row and the bottom of every column
- One operation for the whole puzzle (+, -, ×)
- Select 2 or more cells per row and per column so that applying the operation
  left-to-right / top-to-bottom equals the target
- Only selecting a cell costs a "step" — minimum steps = perfect score
- The interesting constraint: **a cell satisfies its row AND its column
  simultaneously** — you can't solve them independently

---

## The algorithm

### Solving (how does a computer find the answer?)

- Naïve approach: 25 binary variables (select / don't select) → 2²⁵ ≈ 33 million
  states. Too slow.
- Better: exploit the row structure
  - For each row independently, enumerate all subsets of size ≥ 2 (at most 26
    for a 5-cell row) and keep only those where `apply_op == row_target`
  - Call the count of valid subsets for row r: **V_r** (typically 1–3)
  - Backtrack depth-first: assign a valid subset to row 0, then row 1, etc.
  - At the bottom (all rows assigned), verify all 5 column constraints
  - Collect every valid solution, compute min-steps across all of them
- Tree size: **V^n** (typically 2⁵ = 32 nodes). Runs in < 1 ms.

### Generating (how do we make a new puzzle?)

- Naïve approach: random grid + random targets → run solver → retry if no
  solution. Wasteful and unpredictable.
- Better: **construct from a known solution**
  1. Random n×n grid of integers
  2. Pick a random selection pattern (which cells are "on"), ensuring every
     row and every column has ≥ 2 selected cells
  3. Compute row and column targets directly from that selection
  → The selected cells are a valid solution **by construction** — no solver needed
- Generation cost: O(n²). About 0.3 ms for a 5×5 grid.
- Multiple solutions are fine — we report the minimum step count across all of them.

---

## Why there is no division — and what that reveals about the algorithm

- Division seems natural: a ÷ b ÷ c, left to right. We tried it.
- The problem: division is **not closed over integers**. 12 ÷ 7 is not a whole
  number. All other operations (+, -, ×, alternating ±) always produce integers
  — so step 3 (compute targets) always works.
- With division, step 3 frequently fails (`12 ÷ 7 = not integer → retry`).
- The math: for random values 1–15, a pair (a, b) divides cleanly ~20% of the
  time. A 5×5 puzzle has 10 independent row+column selections that all need to
  divide cleanly simultaneously:
  ```
  P(all valid) ≈ 0.20¹⁰ ≈ 1 in 10,000,000
  ```
- Measured: **168 seconds** to generate a single division puzzle.
- The fix would require a completely different generator: build values that are
  *guaranteed* to divide (pick target → pick divisor → set dividend = target ×
  divisor), then reconcile those constructed values across shared row/column
  constraints. Non-trivial — left as future work.
- **This probably explains why the original game never added division.** It's
  not just a design choice — it's a generation problem.

---

## Extra difficulty modes we added

- **More operations**: alternating ± (a − b + c − d …) — same generation cost,
  genuinely harder for humans
- **Larger grids**: 6×6, 7×7 — generation stays fast, but the solver grows as
  O(V^n · n²); beyond 7×7 worst-case solve times spike into seconds
- **Negative numbers**: grid values drawn from [−max, +max] instead of [1, max].
  Targets can go negative. Same algorithm, modestly higher V, much harder to
  reason about mentally
- **Hidden operation**: the operation is not shown. Row/column feedback is
  suppressed until you guess the operation correctly. Forces you to reason about
  *which* operation is consistent with the numbers before you can start solving

---

## Complexity summary (for the technically curious)

| Operation | Complexity | 5×5 typical time |
|---|---|---|
| Generate puzzle | O(n²) | ~0.3 ms |
| Difficulty rating | O(n² · 2^n) | ~0.04 ms |
| Solve / find all solutions | O(V^n · n²) | ~0.07 ms |
| Check player's selection | O(n²) | < 0.05 ms |

- V is the key variable — the average number of valid subsets per row
- For +, -, ×, ~: V ≈ 1.7–2.2, so the solver is trivially fast
- For division: V would be near zero, but generation cost explodes instead
- Grid size n is the exponent — 7×7 is the practical limit for real-time play

---

## What to link / share

- GitHub repo with full source (`game.py`, `DESIGN.md`)
- DESIGN.md contains the full algorithm write-up and all complexity derivations
- `python3 game.py` to play in the terminal
- `new ~ 6 hidden` for a 6×6 alternating-sign puzzle with the operation hidden —
  the hardest mode

---

## Possible title options

- "I Reverse-Engineered Let's Calculate (and Made It Harder)"
- "Why Let's Calculate Has No Division — And What I Built Instead"
- "One Puzzle a Day Wasn't Enough: Building an Infinite Let's Calculate Generator"
- "The Math Behind Let's Calculate — and Why Division Breaks It"
