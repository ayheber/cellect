import { useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { Game } from './components/Game';
import { GameOver } from './components/GameOver';
import { LeaderboardScreen } from './components/LeaderboardScreen';
const requireRegistration = import.meta.env.VITE_REQUIRE_REGISTRATION === 'true';

function initialScreen(): Screen {
  if (window.location.hash === '#leaderboard') return 'leaderboard';
  return requireRegistration ? 'start' : 'playing';
}

type Screen = 'start' | 'playing' | 'gameover' | 'leaderboard';

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [gameKey, setGameKey] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [yukiScore, setYukiScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const handleStart = (name: string, email: string) => {
    setPlayerName(name);
    setPlayerEmail(email);
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
      {screen === 'start' && <StartScreen onStart={handleStart} onLeaderboard={() => setScreen('leaderboard')} />}
      {screen === 'leaderboard' && <LeaderboardScreen onBack={() => setScreen('start')} />}
      {screen === 'playing' && (
        <Game key={gameKey} playerName={playerName} onGameOver={handleGameOver} />
      )}
      {screen === 'gameover' && (
        <GameOver score={finalScore} yukiScore={yukiScore} playerName={playerName} playerEmail={playerEmail} isNewBest={isNewBest} onRestart={handleRestart} />
      )}
    </div>
  );
}
