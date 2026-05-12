import { useEffect, useState } from 'react';
import { getTopScores, LeaderboardEntry } from '../leaderboard';

interface Props {
  onBack: () => void;
}

function goBack(onBack: () => void) {
  history.replaceState(null, '', window.location.pathname);
  onBack();
}

function fmt(n: number): string {
  return '$' + Math.max(0, n).toLocaleString();
}

export function LeaderboardScreen({ onBack: onBackProp }: Props) {
  const onBack = () => goBack(onBackProp);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    getTopScores(20)
      .then(top => { setEntries(top); setState('ok'); })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="start-screen">
      <div className="start-card lb-full-card">
        <div className="start-logo">YUKI</div>
        <h1 className="start-title">Leaderboard</h1>

        {state === 'loading' && <p className="lb-loading">Loading…</p>}
        {state === 'error'   && <p className="lb-loading">Could not load scores.</p>}
        {state === 'ok' && entries.length === 0 && (
          <p className="lb-loading">No scores yet — be the first!</p>
        )}
        {state === 'ok' && entries.length > 0 && (
          <table className="lb-table lb-table-full">
            <thead>
              <tr>
                <th className="lb-rank lb-th">#</th>
                <th className="lb-name lb-th" style={{ textAlign: 'left', paddingLeft: 12 }}>Player</th>
                <th className="lb-score lb-th">Saved</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="lb-row">
                  <td className="lb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</td>
                  <td className="lb-name">{e.name}</td>
                  <td className="lb-score">{fmt(e.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="start-btn lb-back-btn" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}
