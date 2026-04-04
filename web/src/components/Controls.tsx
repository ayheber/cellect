import { useState } from 'react'
import styles from './Controls.module.css'
import { useGame } from '../hooks/useGame'
import { Op, OPS, OP_NAMES, OP_SYMBOLS } from '../engine/types'

interface ControlsProps {
  game: ReturnType<typeof useGame>
  onNewGame: (op: Op, n: number, hiddenOp: boolean, negative: boolean) => void
}

export function Controls({ game, onNewGame }: ControlsProps) {
  const { puzzle, isSolved, opRevealed, reset, applyHint, guessOp, loadDaily } = game

  const [selectedOp, setSelectedOp] = useState<Op | 'hidden'>(puzzle.op)
  const [selectedN, setSelectedN] = useState<number>(puzzle.n)
  const [negative, setNegative] = useState(false)
  const [showNewGameModal, setShowNewGameModal] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [guessFeedback, setGuessFeedback] = useState<'correct' | 'wrong' | null>(null)

  function handleNewGame() {
    const isHidden = selectedOp === 'hidden'
    const op: Op = isHidden ? OPS[Math.floor(Math.random() * OPS.length)] : selectedOp
    onNewGame(op, selectedN, isHidden, negative)
    setShowNewGameModal(false)
    setShowSolution(false)
    setGuessFeedback(null)
  }

  function handleReset() {
    reset()
    setShowSolution(false)
  }

  function handleGuessOp(op: string) {
    const correct = guessOp(op)
    setGuessFeedback(correct ? 'correct' : 'wrong')
    if (!correct) {
      setTimeout(() => setGuessFeedback(null), 1200)
    }
  }

  function handleLoadDaily() {
    loadDaily()
    setShowNewGameModal(false)
    setShowSolution(false)
    setGuessFeedback(null)
  }

  const showGuessSection = puzzle.hiddenOp && !opRevealed && !isSolved

  return (
    <div className={styles.controls}>
      {/* Primary action buttons */}
      <div className={styles.buttonRow}>
        <button className={`${styles.btn} ${styles.btnDaily}`} onClick={handleLoadDaily}>
          Daily Puzzle
        </button>

        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => setShowNewGameModal(true)}
        >
          New Game
        </button>

        <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleReset}>
          Reset
        </button>

        {!showGuessSection && !isSolved && (
          <>
            <button className={`${styles.btn} ${styles.btnHint}`} onClick={applyHint} title="Reveals one correct cell (+2 steps)">
              Hint +2
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setShowSolution(prev => !prev)}
            >
              {showSolution ? 'Hide Solution' : 'Solve'}
            </button>
          </>
        )}
      </div>

      {/* Guess the operation section */}
      {showGuessSection && (
        <div className={styles.guessSection}>
          <div className={styles.guessLabel}>Guess the Operation</div>
          <div className={styles.buttonRow}>
            {OPS.map(op => (
              <button
                key={op}
                className={`${styles.btn} ${styles.btnGuess}`}
                onClick={() => handleGuessOp(op)}
                disabled={guessFeedback === 'correct'}
                title={OP_NAMES[op]}
              >
                {OP_SYMBOLS[op]}
              </button>
            ))}
          </div>
          {guessFeedback === 'correct' && (
            <div className={`${styles.guessFeedback} ${styles.guessFeedbackCorrect}`}>
              Correct! The operation is {OP_NAMES[puzzle.op]}.
            </div>
          )}
          {guessFeedback === 'wrong' && (
            <div className={`${styles.guessFeedback} ${styles.guessFeedbackWrong}`}>
              Not quite — try again!
            </div>
          )}
        </div>
      )}

      {/* Solution panel */}
      {showSolution && game.best.length > 0 && (
        <div className={styles.solutionPanel}>
          <div className={styles.solutionTitle}>One valid solution:</div>
          {game.best.map((cols, r) => (
            <div key={r} className={styles.solutionRow}>
              Row {r + 1}: columns {cols.map(c => c + 1).join(', ')} (values:{' '}
              {cols.map(c => puzzle.grid[r][c]).join(', ')})
            </div>
          ))}
        </div>
      )}

      {/* New Game modal */}
      {showNewGameModal && (
        <div className={styles.overlay} onClick={() => setShowNewGameModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>New Game</div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Operation</label>
              <div className={styles.opGrid}>
                {([...OPS, 'hidden'] as (Op | 'hidden')[]).map(op => (
                  <button
                    key={op}
                    className={`${styles.opBtn} ${selectedOp === op ? styles.opBtnActive : ''}`}
                    title={op === 'hidden' ? 'Mystery — operation is hidden' : OP_NAMES[op]}
                    onClick={() => setSelectedOp(op)}
                  >
                    <span className={styles.opSymbol}>
                    {op === 'hidden' ? '?' : OP_SYMBOLS[op]}
                  </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Grid Size</label>
              <div className={styles.sizeRow}>
                {[3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    className={`${styles.sizeBtn} ${selectedN === n ? styles.sizeBtnActive : ''}`}
                    onClick={() => setSelectedN(n)}
                  >
                    {n}×{n}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={negative}
                onChange={e => setNegative(e.target.checked)}
              />
              Negative numbers
            </label>

            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNewGame}>
              Start Game
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
