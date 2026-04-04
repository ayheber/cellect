import styles from './WinBanner.module.css'

interface WinBannerProps {
  steps: number
  minSteps: number
  onNewGame: () => void
}

export function WinBanner({ steps, minSteps, onNewGame }: WinBannerProps) {
  const isPerfect = steps === minSteps

  return (
    <div className={`${styles.banner} ${isPerfect ? styles.bannerPerfect : ''}`}>
      <div className={styles.trophy}>{isPerfect ? '🏆' : '🎉'}</div>
      <h2 className={styles.title}>
        {isPerfect ? 'Perfect Score!' : 'Puzzle Solved!'}
      </h2>
      <p className={styles.message}>
        {isPerfect
          ? 'You solved it in the minimum number of steps!'
          : 'You solved the puzzle!'}
      </p>
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{steps}</span>
          <span className={styles.statLabel}>your steps</span>
        </div>
        <div className={styles.statDivider}>/</div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{minSteps}</span>
          <span className={styles.statLabel}>minimum</span>
        </div>
      </div>
      {!isPerfect && steps > minSteps && (
        <p className={styles.hint}>
          The optimal solution uses {minSteps} step{minSteps !== 1 ? 's' : ''}. Try again to beat it!
        </p>
      )}
      <button className={styles.playAgainBtn} onClick={onNewGame}>
        Play Again
      </button>
    </div>
  )
}
