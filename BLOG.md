# One Puzzle a Day Wasn't Enough — So I Built My Own

There's a puzzle game I play every morning called Let's Calculate. It gives you a 5×5 grid of numbers, a target at the end of each row and the bottom of each column, and one operation for the whole board. Your job: select cells so that applying the operation to your selections hits every target simultaneously.

It's satisfying in a way that's hard to explain. The moment a row clicks into place while also fixing a column — that's the thing.

The problem: you get one puzzle a day. Two if you subscribe.

I started wondering how hard it would be to generate more. That question turned into a rabbit hole, which turned into Cellect — my own version with unlimited puzzles, harder modes, and a daily leaderboard.

Here's what I learned along the way.

---

## What makes this puzzle hard to generate

The obvious approach to generating a puzzle is: fill a grid with random numbers, pick random targets, check if a solution exists. If not, try again.

This doesn't work. The search space is enormous and solutions are sparse. I ran experiments — for some configurations you'd retry millions of times before hitting a valid puzzle.

The key insight is to **reverse the direction**: instead of generating a puzzle and hoping it's solvable, start from a known solution and derive the puzzle from it.

1. Fill an n×n grid with random integers
2. Randomly pick which cells are "selected" — ensuring every row and every column has at least 2 selected cells
3. Compute the row and column targets directly from those selected cells

The selected cells are a valid solution **by construction**. No solver needed. Generation takes about 0.3 ms for a 5×5 grid.

---

## How the solver works

Even though generation doesn't need a solver, I still needed one — for hints, for computing the minimum possible steps, and for difficulty rating.

The naïve approach is 2²⁵ ≈ 33 million states for a 5×5 grid. Too slow.

The better approach exploits the row structure:

For each row independently, enumerate all subsets of 2+ cells and keep only those where applying the operation equals the row target. Call this count **V** (usually 1–3 per row). Then backtrack: assign a valid subset to row 0, then row 1, and so on. At the end, verify all column constraints.

The search tree has at most **V^n** nodes. With V≈2 and n=5, that's 32 nodes — essentially instant. The full solver runs in under 1 ms on a 5×5 grid.

---

## Why there's no division — and what that reveals

Every number puzzle game I've seen uses addition, subtraction, and multiplication. Never division. I assumed it was a design choice. It's not — it's a generation problem.

Division is not *closed over integers*: 12 ÷ 7 is not a whole number. Addition, subtraction, multiplication, and alternating ± always produce integers from integers. Division usually doesn't.

In my construction-based generator, step 3 (compute targets from selected cells) silently breaks for division. For random values between 1 and 9, a pair (a, b) divides cleanly only about 20% of the time. A 5×5 puzzle has 10 independent row and column selections that all need to work:

```
P(all 10 divide cleanly) ≈ 0.20¹⁰ ≈ 1 in 10,000,000
```

I ran the experiment. It took **168 seconds** to generate a single division puzzle.

The fix would require a fundamentally different approach: construct values that are guaranteed to divide (pick the target, pick a divisor, set the dividend to their product), then reconcile those constraints across rows and columns simultaneously. Non-trivial. I left it as future work.

This is probably why the original game never added division either.

---

## What I added that the original doesn't have

**Unlimited puzzles.** The core reason I built this. Generate as many as you want, any size, any operation.

**Variable grid sizes.** 3×3 is a good warm-up. 6×6 with the solver still running in real time is where it gets interesting. Beyond 7×7, worst-case solve times spike — the exponent in V^n starts to hurt.

**Alternating ± operation.** a − b + c − d … Signs alternate left-to-right. Same generation cost, harder for humans to reason about than pure addition or multiplication.

**Negative numbers.** Grid values drawn from [−9, +9] instead of [1, 9]. Targets can go negative. The algorithm handles it cleanly — it's mentally much harder.

**Hidden operation mode.** The operation is not shown. Row and column result feedback is suppressed until you correctly guess whether it's +, −, ×, or ~. You have to reason about which operation is consistent with the numbers before you can start solving. This is the hardest mode.

**Daily leaderboard.** Same seed for everyone each day (derived from the date — no server needed). Compete on steps and time.

---

## Difficulty rating

I wanted to know objectively how hard each puzzle is. The answer falls naturally out of the solver structure.

The difficulty is the product of V across all rows — the total number of paths through the backtracking tree before column verification:

```
difficulty = V₁ × V₂ × V₃ × V₄ × V₅
```

This is O(n² · 2ⁿ) to compute — no full solve required. It maps cleanly to Easy / Medium / Hard / Expert bands.

---

## Complexity summary

| Operation | Complexity | 5×5 typical |
|---|---|---|
| Generate puzzle | O(n²) | ~0.3 ms |
| Difficulty rating | O(n² · 2ⁿ) | ~0.04 ms |
| Solve (find all solutions) | O(Vⁿ · n²) | ~0.07 ms |
| Validate player's selection | O(n²) | < 0.05 ms |

Everything runs in the browser. No server. The whole game is a static site on GitHub Pages.

---

## Try it

**[cellect.app](https://cellect.app)** — daily puzzle, unlimited games, leaderboard.

The full source and design notes are on GitHub: **[github.com/ayheber/cellect](https://github.com/ayheber/cellect)**

If you're a Let's Calculate player and you've been wanting more — this is for you.
