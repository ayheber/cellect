import { useRef, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { CANVAS_W, CANVAS_H } from '../game/constants';

interface Props {
  playerName: string;
  onGameOver: (score: number, yukiScore: number) => void;
}

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const CONTROLS_HINT = isTouch
  ? 'swipe ← → to move · swipe ↓ fast drop · tap WH = instant drop · double-tap block = new WH'
  : '← → move · SPACE = spin up new WH · ↓ = fast drop · click WH = instant drop';

export function Game({ playerName, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { status, finalScore, yukiScore } = useGame(canvasRef, playerName);

  useEffect(() => {
    if (status === 'gameover') {
      onGameOver(finalScore, yukiScore);
    }
  }, [status, finalScore, yukiScore, onGameOver]);

  return (
    <div className="game-wrapper">
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="game-canvas" />
      <p className="controls-hint">{CONTROLS_HINT}</p>
    </div>
  );
}
