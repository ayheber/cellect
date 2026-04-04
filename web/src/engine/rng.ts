/**
 * Mulberry32 seeded pseudo-random number generator.
 * Produces a deterministic sequence from a 32-bit integer seed.
 */
export class RNG {
  private state: number

  constructor(seed: number) {
    // Ensure seed is a 32-bit unsigned integer
    this.state = seed >>> 0
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state + 0x6d2b79f5) >>> 0
    this.state = t
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    t = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return t
  }

  /** Returns a random integer in [min, max] inclusive */
  randInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /**
   * Weighted random choice from items array using corresponding weights.
   * weights must be non-negative and sum to > 0.
   */
  weightedChoice(items: number[], weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }

  /**
   * Returns k unique items drawn without replacement from pool.
   * Uses Fisher-Yates partial shuffle.
   */
  sample(pool: number[], k: number): number[] {
    const arr = [...pool]
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.next() * (arr.length - i))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, k)
  }
}
