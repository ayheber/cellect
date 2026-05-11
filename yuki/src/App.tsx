import { useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { Game } from './components/Game';
import { GameOver } from './components/GameOver';
import { submitToHubSpot } from './hubspot';

const requireRegistration = import.meta.env.VITE_REQUIRE_REGISTRATION === 'true';

type Screen = 'start' | 'playing' | 'gameover';

export default function App() {
  const [screen, setScreen] = useState<Screen>(requireRegistration ? 'start' : 'playing');
  const [playerName, setPlayerName] = useState('');
  const [gameKey, setGameKey] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [yukiScore, setYukiScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const handleStart = (name: string, email: string) => {
    submitToHubSpot(name, email);
    setPlayerName(name);
    setGameKey(k => k + 1);
    setScreen('playing');
  };

  const handleGameOver = (score: number, yScore: number, newBest: boolean) => {
    setFinalScore(score);
    setYukiScore(yScore);
    setIsNewBest(newBest);
    setScreen('gameover');
  };

  const handleRestart = () => {
    setGameKey(k => k + 1);
    setScreen('playing');
  };

  return (
    <div className="app">
      {screen === 'start' && <StartScreen onStart={handleStart} />}
      {screen === 'playing' && (
        <Game key={gameKey} playerName={playerName} onGameOver={handleGameOver} />
      )}
      {screen === 'gameover' && (
        <GameOver score={finalScore} yukiScore={yukiScore} playerName={playerName} isNewBest={isNewBest} onRestart={handleRestart} />
      )}
    </div>
  );
}
