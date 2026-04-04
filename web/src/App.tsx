import { useState, useEffect } from 'react'
import './App.css'
import { getDailyPuzzle } from './engine/daily'
import { useGame } from './hooks/useGame'
import { Header } from './components/Header'
import { Grid } from './components/Grid'
import { Controls } from './components/Controls'
import { WinBanner } from './components/WinBanner'
import { Op } from './engine/types'
import { alreadySubmitted } from './engine/leaderboard'

const initialPuzzle = getDailyPuzzle()

function isDailyPuzzle(seed: number): boolean {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return seed === parseInt(`${y}${m}${d}`, 10)
}

export default function App() {
  const game = useGame(initialPuzzle)
  // Restore elapsed time from localStorage if already submitted today
  const [solveElapsed, setSolveElapsed] = useState(() => {
    const key = `cellect_daily_elapsed`
    return alreadySubmitted() ? parseInt(localStorage.getItem(key) ?? '0', 10) : 0
  })

  // Capture elapsed time at the moment of solving
  useEffect(() => {
    if (game.isSolved) {
      const elapsed = Math.round((Date.now() - game.startTime) / 1000)
      setSolveElapsed(elapsed)
      localStorage.setItem('cellect_daily_elapsed', String(elapsed))
    }
  }, [game.isSolved])

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
          cellStates={game.cellStates}
          onNewGame={handlePlayAgain}
        />
      )}

      <Controls game={game} onNewGame={handleNewGame} />
    </div>
  )
}
