import { Op } from './engine/types'

// gtag is injected by the GA4 script tag in index.html.
// If you remove GA4, you can safely remove this file and all trackXxx calls.
type GtagFn = (command: string, action: string, params?: Record<string, unknown>) => void

function safeGtag(eventName: string, params: Record<string, unknown>): void {
  const w = window as typeof window & { gtag?: GtagFn }
  if (typeof w.gtag === 'function') {
    w.gtag('event', eventName, params)
  }
}

export function trackGameStarted(
  op: Op,
  n: number,
  hiddenOp: boolean,
  negative: boolean,
  daily: boolean,
): void {
  safeGtag('game_started', {
    op,
    grid_size: n,
    hidden_op: hiddenOp,
    negative_mode: negative,
    daily_puzzle: daily,
  })
}

export function trackGameCompleted(
  op: Op,
  n: number,
  steps: number,
  minStepsCount: number,
  timeSec: number,
  hiddenOp: boolean,
  negative: boolean,
  daily: boolean,
): void {
  safeGtag('game_completed', {
    op,
    grid_size: n,
    steps_taken: steps,
    min_steps: minStepsCount,
    perfect: steps === minStepsCount,
    time_seconds: timeSec,
    hidden_op: hiddenOp,
    negative_mode: negative,
    daily_puzzle: daily,
  })
}

export function trackGameAbandoned(
  op: Op,
  n: number,
  steps: number,
  hiddenOp: boolean,
): void {
  safeGtag('game_abandoned', {
    op,
    grid_size: n,
    steps_taken: steps,
    hidden_op: hiddenOp,
  })
}

export function trackOpGuessed(correct: boolean): void {
  safeGtag('op_guessed', { correct })
}

export function trackHintUsed(): void {
  safeGtag('hint_used', {})
}
