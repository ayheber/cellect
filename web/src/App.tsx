import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import './App.css'
import { getDailyPuzzle } from './engine/daily'
import { useGame } from './hooks/useGame'
import { Header } from './components/Header'
import { Grid } from './components/Grid'
import { Controls } from './components/Controls'
import { WinBanner } from './components/WinBanner'
import { Op } from './engine/types'

const initialPuzzle = getDailyPuzzle()

function isDailyPuzzle(seed: number): boolean {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return seed === parseInt(`${y}${m}${d}`, 10)
}

function fireConfetti(perfect: boolean) {
  if (perfect) {
    // Gold burst for perfect score
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#FFD700', '#FFA500', '#fff'] })
    setTimeout(() => confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 }, colors: ['#FFD700', '#FFA500'] }), 300)
  } else {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } })
  }
}

export default function App() {
  const game = useGame(initialPuzzle)
  const confettiFiredRef = useRef(false)

  const [solveElapsed, setSolveElapsed] = useState(() => {
    const key = `cellect_daily_elapsed_${initialPuzzle.seed}`
    const saved = localStorage.getItem(key)
    return saved ? parseInt(saved, 10) : 0
  })

  useEffect(() => {
    if (game.isSolved && solveElapsed === 0) {
      const key = `cellect_daily_elapsed_${game.puzzle.seed}`
      const saved = localStorage.getItem(key)
      if (saved) setSolveElapsed(parseInt(saved, 10))
    }
  }, [game.isSolved])

  // Fire confetti once when puzzle is solved in this session (not on reload)
  useEffect(() => {
    if (game.isSolved && !confettiFiredRef.current) {
      confettiFiredRef.current = true
      const isPerfect = game.steps === (game.minStepsCount ?? game.steps)
      fireConfetti(isPerfect)
    }
    if (!game.isSolved) {
      confettiFiredRef.current = false
    }
  }, [game.isSolved, game.steps, game.minStepsCount])

  function handleNewGame(op: Op, n: number, hiddenOp: boolean, negative: boolean) {
    const seed = Math.floor(Math.random() * 1_000_000_000)
    game.newGame(op, n, seed, hiddenOp, negative)
  }

  function handlePlayAgain() {
    const { op, n, hiddenOp, negative } = game.puzzle
    const seed = Math.floor(Math.random() * 1_000_000_000)
    game.newGame(op, n, seed, hiddenOp, negative)
  }

  return (
    <div className="app">
      <Header game={game} />
      <Grid game={game} />

      {game.isSolved && (
        <WinBanner
          steps={game.steps}
          minSteps={game.minStepsCount ?? game.steps}
          elapsed={solveElapsed}
          isDaily={isDailyPuzzle(game.puzzle.seed)}
          onNewGame={handlePlayAgain}
        />
      )}

      <Controls game={game} onNewGame={handleNewGame} />
    </div>
  )
}
