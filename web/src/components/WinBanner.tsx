import { useState, useEffect } from 'react'
import styles from './WinBanner.module.css'
import { submitScore, saveCells, getTopScores, alreadySubmitted, LeaderboardEntry } from '../engine/leaderboard'
import { CellState } from '../engine/types'

interface WinBannerProps {
  steps: number
  minSteps: number
  elapsed: number   // seconds
  isDaily: boolean
  cellStates: CellState[][]
  onNewGame: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

export function WinBanner({ steps, minSteps, elapsed, isDaily, cellStates, onNewGame }: WinBannerProps) {
  const isPerfect = steps === minSteps

  const [name, setName] = useState(() => localStorage.getItem('cellect_player_name') ?? '')
  const [submitted, setSubmitted] = useState(() => isDaily && alreadySubmitted())
  const [submitting, setSubmitting] = useState(false)
  const [scores, setScores] = useState<LeaderboardEntry[]>([])
  const [loadingScores, setLoadingScores] = useState(false)

  useEffect(() => {
    if (!isDaily || !submitted) return
    setLoadingScores(true)
    getTopScores().then(s => {
      setScores(s)
      setLoadingScores(false)
    })
  }, [isDaily, submitted])

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitting(true)
    localStorage.setItem('cellect_player_name', trimmed)
    saveCells(cellStates)
    await submitScore(trimmed, steps, elapsed)
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <div className={`${styles.banner} ${isPerfect ? styles.bannerPerfect : ''}`}>
      <div className={styles.trophy}>{isPerfect ? '🏆' : '🎉'}</div>
      <h2 className={styles.title}>{isPerfect ? 'Perfect!' : 'Solved!'}</h2>
      <p className={styles.message}>
        {isPerfect
          ? 'You found the optimal solution!'
          : `Optimal was ${minSteps} steps — try to beat it next time.`}
      </p>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{steps}</span>
          <span className={styles.statLabel}>steps</span>
        </div>
        <div className={styles.statDivider}>·</div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatTime(elapsed)}</span>
          <span className={styles.statLabel}>time</span>
        </div>
      </div>

      {isDaily && !submitted && (
        <div className={styles.submitSection}>
          <p className={styles.submitLabel}>Add your score to today's leaderboard</p>
          <div className={styles.submitRow}>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="Your name"
              maxLength={20}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={!name.trim() || submitting}
            >
              {submitting ? '…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {isDaily && submitted && (
        <div className={styles.leaderboard}>
          <div className={styles.leaderboardTitle}>Today's leaderboard</div>
          {loadingScores ? (
            <div className={styles.loading}>Loading…</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thRank}>#</th>
                  <th className={styles.thName}>Name</th>
                  <th className={styles.thNum}>Steps</th>
                  <th className={styles.thNum}>Time</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={i} className={s.name === name.trim() ? styles.myRow : ''}>
                    <td className={styles.tdRank}>{i + 1}</td>
                    <td className={styles.tdName}>{s.name}</td>
                    <td className={styles.tdNum}>{s.steps}</td>
                    <td className={styles.tdNum}>{formatTime(s.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <button className={styles.playAgainBtn} onClick={onNewGame}>
        New Game
      </button>
    </div>
  )
}
