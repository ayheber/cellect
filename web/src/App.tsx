import './App.css'
import { getDailyPuzzle } from './engine/daily'
import { useGame } from './hooks/useGame'
import { Header } from './components/Header'
import { Grid } from './components/Grid'
import { Controls } from './components/Controls'
import { WinBanner } from './components/WinBanner'
import { Op } from './engine/types'

const initialPuzzle = getDailyPuzzle()

export default function App() {
  const game = useGame(initialPuzzle)

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
          onNewGame={handlePlayAgain}
        />
      )}

      <Controls game={game} onNewGame={handleNewGame} />
    </div>
  )
}
