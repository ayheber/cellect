import { useState } from 'react'
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
  const [showHelp, setShowHelp] = useState(false)

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Cellect</h1>
        <button className={styles.helpBtn} onClick={() => setShowHelp(true)} aria-label="How to play">
          ?
        </button>
      </div>
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

      {showHelp && (
        <div className={styles.overlay} onClick={() => setShowHelp(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>How to Play</div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Goal</div>
              <p>Select cells so that applying the operation to your selections equals the target for every row and every column.</p>
              <ul>
                <li>Every row needs <strong>≥ 2 selected cells</strong></li>
                <li>Every column needs <strong>≥ 2 selected cells</strong></li>
                <li>A cell counts toward both its row <em>and</em> its column</li>
              </ul>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Controls</div>
              <ul>
                <li><strong>Tap / left click</strong> — select / deselect</li>
                <li><strong>Long press / right click</strong> — disable (cross out, free)</li>
                <li><strong>Hint +2</strong> — reveals one correct cell (costs 2 steps)</li>
                <li><strong>Reset</strong> — clears the board, keeps your step count</li>
              </ul>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Scoring</div>
              <ul>
                <li>Each selection costs <strong>1 step</strong></li>
                <li>Each hint costs <strong>2 steps</strong></li>
                <li>Fewer steps = better score</li>
                <li>Daily puzzle scores go on the leaderboard</li>
              </ul>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Operations</div>
              <ul>
                <li><strong>+</strong> Addition — a + b + c …</li>
                <li><strong>−</strong> Subtraction — a − b − c …</li>
                <li><strong>×</strong> Multiplication — a × b × c …</li>
                <li><strong>~</strong> Alternating ± — a − b + c − d …</li>
              </ul>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Modes</div>
              <ul>
                <li><strong>Mystery</strong> — operation is hidden; guess it to unlock feedback</li>
                <li><strong>Negative numbers</strong> — grid values and targets can go negative</li>
                <li><strong>Grid sizes</strong> — 3×3 (easy) to 6×6 (hard)</li>
              </ul>
            </div>

            <button className={styles.closeBtn} onClick={() => setShowHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
