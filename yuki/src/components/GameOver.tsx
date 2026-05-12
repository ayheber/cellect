import { useEffect, useState } from 'react';
import { submitScore, getTopScores, alreadySubmitted, LeaderboardEntry } from '../leaderboard';

interface Props {
  score: number;
  yukiScore: number;
  playerName: string;
  playerEmail: string;
  isNewBest: boolean;
  onRestart: () => void;
}

function fmt(n: number): string {
  return '$' + Math.max(0, n).toLocaleString();
}

export function GameOver({ score, yukiScore, playerName, playerEmail, isNewBest, onRestart }: Props) {
  const gap = yukiScore - score;
  const pct = yukiScore > 0 ? Math.round((yukiScore / Math.max(score, 1)) * 100) : 0;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [lbState, setLbState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    async function run() {
      try {
        const name = playerName || `yuki-dev-${Math.random().toString(36).slice(2, 7)}`;
        if (!alreadySubmitted(score)) {
          await submitScore(name, playerEmail, score);
        }
        const top = await getTopScores(10);
        setEntries(top);
        setLbState('ok');
      } catch {
        setLbState('error');
      }
    }
    run();
  }, []);

  const playerRank = entries.findIndex(e => e.score <= score) + 1 || entries.length + 1;

  return (
    <div className="start-screen">
      <div className="start-card gameover-card">
        <div className="start-logo">YUKI</div>
        <h1 className="start-title">Game Over</h1>
        <p className="gameover-name">{playerName}</p>
        {isNewBest && <div className="new-best-banner">🏆 NEW PERSONAL BEST!</div>}

        <div className="gameover-scores">
          <div className="gameover-col">
            <span className="score-label">YOU SAVED</span>
            <span className="score-value player-score">{fmt(score)}</span>
          </div>
          <div className="gameover-vs">VS</div>
          <div className="gameover-col">
            <span className="score-label">🐧 YUKI SAVED</span>
            <span className="score-value yuki-score">{fmt(yukiScore)}</span>
          </div>
        </div>

        {gap > 0 && (
          <div className="gameover-gap">
            Yuki saved <strong>{fmt(gap)} more</strong> than you —<br />
            <span className="gameover-gap-pct">{pct}% more efficient.</span>
          </div>
        )}

        <div className="lb-container">
          <div className="lb-heading">LEADERBOARD</div>
          {lbState === 'loading' && <p className="lb-loading">Loading…</p>}
          {lbState === 'error'   && <p className="lb-loading">Could not load scores.</p>}
          {lbState === 'ok' && (
            <table className="lb-table">
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className={e.name === playerName && i + 1 === playerRank ? 'lb-row lb-row-self' : 'lb-row'}>
                    <td className="lb-rank">#{i + 1}</td>
                    <td className="lb-name">{e.name}</td>
                    <td className="lb-score">{fmt(e.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="gameover-hint">
          Yuki does this automatically, 24/7, across every query in your warehouse.
        </p>

        <button className="start-btn" onClick={onRestart}>Play Again →</button>
      </div>
    </div>
  );
}
