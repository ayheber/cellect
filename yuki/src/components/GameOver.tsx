interface Props {
  score: number;
  yukiScore: number;
  playerName: string;
  isNewBest: boolean;
  onRestart: () => void;
}

function fmt(n: number): string {
  return '$' + Math.max(0, n).toLocaleString();
}

export function GameOver({ score, yukiScore, playerName, isNewBest, onRestart }: Props) {
  const gap = yukiScore - score;
  const pct = yukiScore > 0 ? Math.round((yukiScore / Math.max(score, 1)) * 100) : 0;

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

        <p className="gameover-hint">
          Yuki does this automatically, 24/7, across every query in your warehouse.
        </p>

        <button className="start-btn" onClick={onRestart}>Play Again →</button>
      </div>
    </div>
  );
}
