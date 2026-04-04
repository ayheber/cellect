import styles from './Header.module.css'
import { useGame } from '../hooks/useGame'
import { OP_NAMES, OP_SYMBOLS } from '../engine/types'

interface HeaderProps {
  game: ReturnType<typeof useGame>
}

const DIFF_STYLE: Record<string, string> = {
  Easy: styles.diffEasy,
  Medium: styles.diffMedium,
  Hard: styles.diffHard,
  Expert: styles.diffExpert,
}

function isDaily(seed: number): boolean {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return seed === parseInt(`${y}${m}${d}`, 10)
}

export function Header({ game }: HeaderProps) {
  const { puzzle, steps, opRevealed, difficultyLabel, minStepsCount } = game
  const { op, hiddenOp } = puzzle

  const daily = isDaily(puzzle.seed)

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Cellect</h1>
      <p className={styles.subtitle}>Select cells so rows and columns hit their targets</p>

      <div className={styles.metaRow}>
        {daily && <span className={styles.dailyBadge}>Daily</span>}

        <span className={opRevealed ? styles.opBadge : styles.opBadgeHidden}>
          {opRevealed
            ? `${OP_SYMBOLS[op]} ${OP_NAMES[op]}`
            : hiddenOp
              ? '? — guess the operation'
              : `${OP_SYMBOLS[op]} ${OP_NAMES[op]}`}
        </span>

        <span className={`${styles.diffBadge} ${DIFF_STYLE[difficultyLabel] ?? ''}`}>
          {difficultyLabel}
        </span>

        <span className={styles.stepsCounter}>
          Steps: <span className={styles.stepsNumber}>{steps}</span>
          {minStepsCount !== null && (
            <span style={{ color: '#aaa', fontWeight: 400 }}>/{minStepsCount}</span>
          )}
        </span>
      </div>
    </header>
  )
}
