import {
  BOARD_W, BOARD_H, HEADER_H, WH_ZONE_H, WH_ZONE_Y,
  QUERY_W, WH_SIZES, WH_COLORS, WH_BG, PLAYER_BX, CANVAS_W, CANVAS_H,
  MAX_QUEUE, STARTING_CREDITS, QUERY_START_Y, QUERY_LAND_Y,
  STAGES, STAGE_TRANSITION_DURATION, AI_RAIN_TIMEOUT,
} from './constants';
import { BoardScore, ExtraWarehouse, GameState, Query, StageTransition, Warehouse, WHSize } from './types';
import { buildLaneList, LaneEntry } from '../hooks/useGame';

const PLAYER_ACCENT = '#a78bfa';
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ─── Snow particles ────────────────────────────────────────────────────────────

interface Particle { x: number; y: number; r: number; speed: number; drift: number; opacity: number }
const PARTICLE_COUNT = 90;
let particles: Particle[] = [];
let lastParticleTime = 0;

function initParticles() {
  particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    r: Math.random() * 1.8 + 0.4,
    speed: Math.random() * 28 + 12,
    drift: (Math.random() - 0.5) * 12,
    opacity: Math.random() * 0.45 + 0.08,
  }));
}
initParticles();

function updateParticles(dt: number) {
  for (const p of particles) {
    p.y += p.speed * dt;
    p.x += p.drift * dt;
    if (p.y > CANVAS_H + 4) { p.y = -4; p.x = Math.random() * CANVAS_W; }
    if (p.x < 0) p.x = CANVAS_W;
    if (p.x > CANVAS_W) p.x = 0;
  }
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#dff4fe';
  for (const p of particles) {
    ctx.globalAlpha = p.opacity;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function queryH(size: WHSize): number {
  return 30 + WH_SIZES.indexOf(size) * 8;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSnowflake(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
    for (const t of [0.45, 0.75]) {
      const bx = cx + Math.cos(a) * r * t;
      const by = cy + Math.sin(a) * r * t;
      const br = r * 0.28;
      for (const da of [Math.PI / 3, -Math.PI / 3]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + da) * br, by + Math.sin(a + da) * br);
        ctx.stroke();
      }
    }
  }
}

// ─── Storm cloud ───────────────────────────────────────────────────────────────

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, alpha: number, pulse: number) {
  ctx.globalAlpha = alpha;
  const scale = 1 + pulse * 0.04;
  const r = 32 * scale;
  const bumps: [number, number, number][] = [
    [0, 0, r],
    [-r * 0.75, r * 0.28, r * 0.72],
    [ r * 0.75, r * 0.28, r * 0.72],
    [-r * 0.38, -r * 0.38, r * 0.60],
    [ r * 0.38, -r * 0.38, r * 0.60],
  ];
  // Cheap glow: one large semi-transparent circle instead of shadowBlur on 5 fills
  ctx.globalAlpha = alpha * (0.30 + 0.20 * pulse);
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // Dark inner halo
  for (const [dx, dy, br] of bumps) {
    ctx.fillStyle = '#180830';
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, br + 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cloud body
  for (const [dx, dy, br] of bumps) {
    ctx.fillStyle = '#2d1060';
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, br, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bottom flat edge (make it look like a storm cloud underside)
  ctx.fillStyle = '#1a0845';
  ctx.fillRect(cx - r * 1.1, cy + 12, r * 2.2, r * 0.5);
  ctx.globalAlpha = 1;
}

// ─── AI Rain overlay ───────────────────────────────────────────────────────────

function drawAiRainOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  const { aiRainPhase, aiRainTimer, aiRainDrops, hasYukiPow, yukiPowUsed } = state;
  if (aiRainPhase === 'none') return;

  const cx = BOARD_W / 2;
  const cloudY = HEADER_H + 60;
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 190);

  // Background tint
  if (aiRainPhase === 'warning') {
    ctx.fillStyle = `rgba(80,10,10,${0.18 + 0.08 * pulse})`;
    ctx.fillRect(0, HEADER_H, BOARD_W, WH_ZONE_Y - HEADER_H);
  } else if (aiRainPhase === 'raining') {
    ctx.fillStyle = `rgba(40,0,80,${0.55 + 0.15 * pulse})`;
    ctx.fillRect(0, HEADER_H, BOARD_W, WH_ZONE_Y - HEADER_H);
  }

  // Cloud
  if (aiRainPhase === 'warning' || aiRainPhase === 'raining') {
    drawCloud(ctx, cx, cloudY, 0.92, pulse);

    // Lightning bolts
    const boltAlpha = aiRainPhase === 'raining' ? 0.7 + 0.3 * pulse : 0.5 * pulse;
    if (Math.random() < (aiRainPhase === 'raining' ? 0.12 : 0.06)) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.globalAlpha = boltAlpha;
      const lx = cx + (Math.random() - 0.5) * 60;
      ctx.beginPath();
      ctx.moveTo(lx, cloudY + 28);
      ctx.lineTo(lx - 9, cloudY + 52);
      ctx.lineTo(lx + 6, cloudY + 52);
      ctx.lineTo(lx - 5, cloudY + 78);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Rain drops (visual-only AI query blocks)
  for (const drop of aiRainDrops) {
    ctx.globalAlpha = drop.opacity * 0.88;
    rrect(ctx, drop.x - 19, drop.y - 13, 38, 13, 3);
    ctx.fillStyle = '#2d0d5e';
    ctx.fill();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AI', drop.x, drop.y - 3);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // ── Warning phase message ──────────────────────────────────────────────────
  if (aiRainPhase === 'warning') {
    ctx.globalAlpha = 0.75 + 0.25 * pulse;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('⚠  AI RAIN INCOMING!', cx, cloudY + 118);
    ctx.fillStyle = hasYukiPow ? '#67e8f9' : '#fb923c';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(
      hasYukiPow
        ? 'Prepare your YUKI POW...'
        : 'You have NO YUKI POW — prepare for defeat!',
      cx, cloudY + 140,
    );
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ── Raining phase message ──────────────────────────────────────────────────
  if (aiRainPhase === 'raining') {
    ctx.textAlign = 'center';

    if (hasYukiPow && !yukiPowUsed) {
      // Countdown
      const maxTime = AI_RAIN_TIMEOUT;
      const timeLeft = Math.max(0, aiRainTimer);
      const urgent = timeLeft < 4;
      const color = urgent ? '#f87171' : '#67e8f9';

      ctx.globalAlpha = 0.88 + 0.12 * pulse;
      ctx.fillStyle = color;
      ctx.font = `bold ${urgent ? 20 : 16}px "Courier New", monospace`;
      ctx.shadowColor = color;
      ctx.shadowBlur = urgent ? 20 : 10;
      const hint = IS_TOUCH ? '▶  TAP ANYWHERE — YUKI POW' : '▶  PRESS  P  — YUKI POW';
      ctx.fillText(hint, cx, cloudY + 110);
      ctx.shadowBlur = 0;

      // Big countdown number
      ctx.fillStyle = color;
      ctx.font = `bold ${urgent ? 52 : 40}px "Courier New", monospace`;
      ctx.shadowColor = color;
      ctx.shadowBlur = urgent ? 30 : 14;
      ctx.fillText(timeLeft.toFixed(1) + 's', cx, cloudY + 165);
      ctx.shadowBlur = 0;

      // Progress bar
      const barW = 200;
      const barRatio = timeLeft / maxTime;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(cx - barW / 2, cloudY + 178, barW, 6);
      ctx.fillStyle = barRatio > 0.4 ? '#67e8f9' : '#f87171';
      ctx.fillRect(cx - barW / 2, cloudY + 178, barW * barRatio, 6);
      ctx.globalAlpha = 1;

      // Touch tap button
      if (IS_TOUCH) {
        const btnY = WH_ZONE_Y - 64;
        ctx.globalAlpha = 0.92;
        rrect(ctx, cx - 90, btnY - 24, 180, 40, 10);
        ctx.fillStyle = '#071830';
        ctx.fill();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText('⚡ YUKI POW', cx, btnY + 8);
        ctx.globalAlpha = 1;
      }
    } else if (!hasYukiPow) {
      // Doom countdown
      const timeLeft = Math.max(0, aiRainTimer);
      ctx.globalAlpha = 0.9 + 0.1 * pulse;
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 17px "Courier New", monospace';
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 14;
      ctx.fillText('AI RAIN OVERWHELMING WAREHOUSE!', cx, cloudY + 110);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fb923c';
      ctx.font = '13px monospace';
      ctx.fillText('No YUKI POW — defeat in ' + timeLeft.toFixed(1) + 's', cx, cloudY + 134);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'left';
  }

  // ── Cleared phase flash ────────────────────────────────────────────────────
  if (aiRainPhase === 'cleared') {
    const elapsed = 2.2 - aiRainTimer;
    const flashAlpha = Math.max(0, 0.9 - elapsed * 1.2);
    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);
      ctx.globalAlpha = 1;
    }
  }
}

// ─── Stage transition overlay ─────────────────────────────────────────────────

function drawStageTransition(ctx: CanvasRenderingContext2D, transition: StageTransition, hasYukiPow: boolean) {
  const { nextStage, timer, grantedPow } = transition;
  const elapsed = STAGE_TRANSITION_DURATION - timer;
  const fadeIn  = Math.min(1, elapsed / 0.3);
  const fadeOut = Math.max(0, 1 - Math.max(0, elapsed - (STAGE_TRANSITION_DURATION - 0.4)) / 0.4);
  const alpha   = Math.min(fadeIn, fadeOut);

  ctx.globalAlpha = alpha * 0.94;
  ctx.fillStyle = '#000d1a';
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  ctx.globalAlpha = alpha;

  const cx = BOARD_W / 2;
  const cy = BOARD_H / 2;
  const stageConfig = STAGES[nextStage - 1];

  ctx.textAlign = 'center';

  // "STAGE X" heading
  ctx.fillStyle = '#1e3a5f';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillText('INCOMING', cx, cy - 88);

  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 54px "Courier New", monospace';
  ctx.shadowColor = '#67e8f9';
  ctx.shadowBlur = 30;
  ctx.fillText(`STAGE ${nextStage}`, cx, cy - 28);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#a78bfa';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(stageConfig.name, cx, cy + 16);

  ctx.fillStyle = '#475569';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText(stageConfig.desc, cx, cy + 46);

  // YUKI POW status for stage 4
  if (nextStage === 4) {
    if (grantedPow || hasYukiPow) {
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 12;
      ctx.fillText('⚡ YUKI POW READY — you can stop the AI Rain!', cx, cy + 86);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText('⚠  No YUKI POW — AI Rain cannot be stopped!', cx, cy + 86);
      ctx.fillStyle = '#475569';
      ctx.font = '11px monospace';
      ctx.fillText('(earn it by hitting a 5× combo in Stage 3)', cx, cy + 106);
    }
  }

  // Stage-specific tips
  if (nextStage === 2) {
    ctx.fillStyle = '#334155';
    ctx.font = '12px monospace';
    ctx.fillText('Size labels are gone — read the complexity bar!', cx, cy + 86);
  }
  if (nextStage === 3) {
    ctx.fillStyle = '#a78bfa';
    ctx.font = '12px monospace';
    ctx.fillText('Hit a 5× combo to unlock YUKI POW before Stage 4!', cx, cy + 86);
  }
  if (nextStage === 5) {
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 8;
    ctx.fillText('🎉 You survived the AI Rain! Now go full speed.', cx, cy + 86);
    ctx.shadowBlur = 0;
  }

  // Countdown
  const timeLeft = Math.max(0, Math.ceil(timer));
  ctx.fillStyle = '#1e3a5f';
  ctx.font = '11px monospace';
  ctx.fillText(`starting in ${timeLeft}…`, cx, cy + 148);

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ─── Stage 1 hint strip ────────────────────────────────────────────────────────

function drawStage1Hint(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = '#1e3a5f';
  ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Size label shown ↑  ·  route the query to the matching warehouse below', BOARD_W / 2, WH_ZONE_Y - 9);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ─── Header ────────────────────────────────────────────────────────────────────

function drawHeader(
  ctx: CanvasRenderingContext2D,
  board: BoardScore,
  label: string,
  accent: string,
  stage: number,
  nextQuery: Query | null,
  _isPenguin: boolean,
  spinupPending: boolean,
  yukiScore: number,
  bestScore: number,
  hasYukiPow: boolean,
  yukiPowUsed: boolean,
) {
  // Player name + spinup indicator (left)
  ctx.fillStyle = spinupPending ? '#67e8f9' : accent;
  ctx.font = 'bold 17px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label + (spinupPending ? ' ⚡' : ''), 14, 24);

  // SAVED label + amount (left, below name)
  ctx.fillStyle = '#334155';
  ctx.font = '8px monospace';
  ctx.fillText('SAVED', 14, 37);
  const savedStr = '$' + Math.max(0, board.score).toLocaleString();
  ctx.fillStyle = board.score > 0 ? '#67e8f9' : '#f87171';
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText(savedStr, 14, 52);

  // Lives (ice cubes) — centered
  for (let i = 0; i < 3; i++) {
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = i < board.lives ? 1 : 0.2;
    ctx.fillText('🧊', BOARD_W / 2 - 20 + i * 24, 26);
  }
  ctx.globalAlpha = 1;

  // Combo — centered, below lives
  if (board.combo >= 3) {
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${board.combo}× COMBO`, BOARD_W / 2, 45);
  }

  // Stage label + next query (right)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = '10px monospace';
  const stageName = STAGES[stage - 1]?.name ?? '';
  ctx.fillText(`S${stage} ${stageName}`, BOARD_W - 14, 22);

  if (nextQuery) {
    ctx.fillStyle = '#334155';
    ctx.font = '8px monospace';
    ctx.fillText('NEXT', BOARD_W - 14, 35);
    ctx.fillStyle = WH_COLORS[nextQuery.size];
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(`❄ ${nextQuery.size}`, BOARD_W - 14, 49);
  }
  ctx.textAlign = 'left';

  // Credits bar (full width, near bottom of header)
  const credRatio = board.credits / STARTING_CREDITS;
  const barW = BOARD_W - 28;
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(14, 57, barW, 6);
  ctx.fillStyle = credRatio > 0.5 ? '#22d3ee' : credRatio > 0.2 ? '#fb923c' : '#ef4444';
  ctx.fillRect(14, 57, barW * credRatio, 6);
  ctx.fillStyle = '#334155';
  ctx.font = '8px monospace';
  ctx.fillText(`${board.credits}cr`, 14, 56);

  // Bottom row: YUKI POW badge (left) or PB (left) + Yuki score (right)
  if (hasYukiPow && !yukiPowUsed) {
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 260);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 8;
    ctx.fillText('⚡ POW READY', 14, 70);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  } else {
    ctx.font = '8px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e3a5f';
    ctx.fillText(bestScore > 0 ? `PB $${bestScore.toLocaleString()}` : 'PB ---', 14, 70);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = yukiScore > board.score ? '#3a1820' : '#1a3020';
  ctx.font = '8px "Courier New", monospace';
  ctx.fillText(`🐧 $${yukiScore.toLocaleString()}`, BOARD_W - 14, 70);

  // Divider
  ctx.strokeStyle = '#0f2040';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(BOARD_W, HEADER_H);
  ctx.stroke();
  ctx.textAlign = 'left';
}

// ─── Warehouses (Snowflake Cooling Chambers) ───────────────────────────────────

function drawLane(
  ctx: CanvasRenderingContext2D,
  lane: LaneEntry,
  x: number,
  laneW: number,
  isHighlighted: boolean,
) {
  const color = WH_COLORS[lane.size as WHSize];
  const isFull = lane.queue.length >= MAX_QUEUE;

  ctx.globalAlpha = lane.opacity;

  ctx.fillStyle = lane.isExtra ? '#001a2e' : isFull ? '#2a0a0a' : isHighlighted ? color + '18' : WH_BG[lane.size as WHSize];
  ctx.fillRect(x + 1, WH_ZONE_Y + 1, laneW - 2, WH_ZONE_H - 2);

  if (lane.isExtra) { ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 14; }
  else if (isFull)  { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8; }
  else if (isHighlighted) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
  ctx.strokeStyle = lane.isExtra ? '#67e8f9' : isFull ? '#ef444488' : isHighlighted ? color : color + '44';
  ctx.lineWidth = (lane.isExtra || isFull || isHighlighted) ? 2 : 1;
  ctx.strokeRect(x + 1, WH_ZONE_Y + 1, laneW - 2, WH_ZONE_H - 2);
  ctx.shadowBlur = 0;

  const lbl = lane.isExtra ? `⚡ ${lane.size}` : `❄ ${lane.size}`;
  ctx.fillStyle = lane.isExtra ? '#67e8f9' : isFull ? '#ef4444' : isHighlighted ? color : color + 'aa';
  ctx.font = `bold ${laneW > 70 ? 13 : 11}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(lbl, x + laneW / 2, WH_ZONE_Y + 20);

  if (lane.isExtra) {
    ctx.fillStyle = '#67e8f966';
    ctx.font = '8px monospace';
    ctx.fillText('NEW', x + laneW / 2, WH_ZONE_Y + 31);
  } else if (isFull) {
    ctx.fillStyle = '#ef444488';
    ctx.font = '8px monospace';
    ctx.fillText('FULL', x + laneW / 2, WH_ZONE_Y + 31);
  }

  const slotW = laneW - 14;
  const slotH = 16;
  const slotX = x + 7;
  for (let s = 0; s < MAX_QUEUE; s++) {
    const sy = WH_ZONE_Y + 40 + s * 22;
    const pq = lane.queue[s];
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(slotX, sy, slotW, slotH);
    if (pq) {
      const qc = WH_COLORS[pq.query.size as WHSize];
      const fillW = s === 0 ? slotW * (1 - pq.progress) : slotW;
      ctx.fillStyle = qc + '88';
      ctx.fillRect(slotX, sy, fillW, slotH);
      ctx.fillStyle = qc;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pq.query.size, slotX + slotW / 2, sy + 11);
    }
    ctx.strokeStyle = pq ? WH_COLORS[pq.query.size as WHSize] + '55' : '#0f2040';
    ctx.lineWidth = 1;
    ctx.strokeRect(slotX, sy, slotW, slotH);
  }

  const sfAlpha = isFull ? '22' : lane.isExtra ? 'cc' : isHighlighted ? 'aa' : '33';
  drawSnowflake(ctx, x + laneW / 2, WH_ZONE_Y + 106, Math.min(14, laneW * 0.13), color + sfAlpha);

  if (lane.queue.length > 0) {
    const fillRatio = lane.queue.length / MAX_QUEUE;
    const barH = (WH_ZONE_H - 6) * fillRatio;
    ctx.globalAlpha = lane.opacity * 0.6;
    ctx.fillStyle = fillRatio >= 1 ? '#ef4444' : '#fb923c';
    ctx.fillRect(x + 1, WH_ZONE_Y + WH_ZONE_H - 4 - barH, 3, barH);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawWarehouses(
  ctx: CanvasRenderingContext2D,
  playerLane: number,
  warehouses: Warehouse[],
  extraWarehouses: ExtraWarehouse[],
  showFullHint: boolean,
  isPlayer: boolean,
) {
  ctx.fillStyle = '#030a18';
  ctx.fillRect(0, WH_ZONE_Y, BOARD_W, WH_ZONE_H);
  ctx.strokeStyle = '#0f2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, WH_ZONE_Y);
  ctx.lineTo(BOARD_W, WH_ZONE_Y);
  ctx.stroke();

  const lanes = buildLaneList(warehouses, extraWarehouses);
  const laneW = BOARD_W / lanes.length;
  const highlightVisualIdx = Math.min(playerLane, lanes.length - 1);

  for (let i = 0; i < lanes.length; i++) {
    drawLane(ctx, lanes[i], i * laneW, laneW, i === highlightVisualIdx);
  }

  if (showFullHint && isPlayer && highlightVisualIdx >= 0) {
    const targetLane = lanes[highlightVisualIdx];
    if (targetLane && targetLane.queue.length >= MAX_QUEUE) {
      const hx = highlightVisualIdx * laneW + laneW / 2;
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 200);
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('WH FULL!', hx, WH_ZONE_Y - 12);
      ctx.fillStyle = '#67e8f9';
      ctx.fillText(IS_TOUCH ? '2× tap block' : 'SPACE to add WH', hx, WH_ZONE_Y - 2);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  }
}

// ─── Ice Cube Query Block ──────────────────────────────────────────────────────

function drawFallingQuery(
  ctx: CanvasRenderingContext2D,
  query: Query,
  x: number,
  y: number,
  isYuki: boolean,
  spinupActive = false,
  showSizeLabel = false,
) {
  const h = queryH(query.size);
  const iceColor = isYuki ? '#38bdf8' : '#67e8f9';
  const qx = x - QUERY_W / 2;
  const qy = y - h;

  ctx.shadowColor = spinupActive ? '#ffffff' : iceColor;
  ctx.shadowBlur = spinupActive ? 30 : isYuki ? 10 : 22;

  const grad = ctx.createLinearGradient(qx, qy, qx + QUERY_W, qy + h);
  grad.addColorStop(0, '#163560');
  grad.addColorStop(1, '#0e2448');
  ctx.fillStyle = grad;
  ctx.beginPath();
  rrect(ctx, qx, qy, QUERY_W, h, 6);
  ctx.fill();

  ctx.strokeStyle = spinupActive ? '#ffffff' : iceColor;
  ctx.lineWidth = isYuki ? 1.5 : 2;
  ctx.beginPath();
  rrect(ctx, qx, qy, QUERY_W, h, 6);
  ctx.stroke();

  ctx.shadowBlur = 0;

  const shine = ctx.createLinearGradient(qx, qy, qx + QUERY_W * 0.7, qy + h * 0.7);
  shine.addColorStop(0, 'rgba(200,240,255,0.12)');
  shine.addColorStop(1, 'rgba(200,240,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  rrect(ctx, qx, qy, QUERY_W, h, 6);
  ctx.fill();

  const sizeIdx = WH_SIZES.indexOf(query.size as WHSize);

  if (spinupActive) {
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ SPIN UP', x, qy + 14);
  } else if (showSizeLabel) {
    // Stage 1: show size prominently so player can learn the mapping
    ctx.fillStyle = WH_COLORS[query.size as WHSize];
    ctx.font = `bold ${h > 38 ? 18 : 15}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.shadowColor = WH_COLORS[query.size as WHSize];
    ctx.shadowBlur = 10;
    ctx.fillText(query.size, x, qy + h / 2 + 6);
    ctx.shadowBlur = 0;
  } else {
    // Complexity bar (5 segments)
    const segCount = 5;
    const segW = (QUERY_W - 14) / segCount;
    const segH = 6;
    const segY = qy + h / 2 - segH / 2;
    for (let i = 0; i < segCount; i++) {
      const sx = x - QUERY_W / 2 + 7 + i * segW;
      ctx.fillStyle = i <= sizeIdx ? '#67e8f9' : '#1a3a6a';
      ctx.fillRect(sx, segY, segW - 2, segH);
    }
  }

  ctx.textAlign = 'left';
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

function drawFeedback(ctx: CanvasRenderingContext2D, board: BoardScore) {
  for (const fb of board.feedback) {
    ctx.globalAlpha = Math.max(0, fb.opacity);
    ctx.fillStyle = fb.color;
    ctx.font = fb.big ? 'bold 24px sans-serif' : 'bold 17px "Courier New", monospace';
    ctx.textAlign = 'center';
    if (fb.big) {
      ctx.shadowColor = fb.color;
      ctx.shadowBlur = 14;
    } else {
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
    }
    ctx.fillText(fb.text, fb.x, fb.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ─── Tutorial screen ──────────────────────────────────────────────────────────

function drawTutorial(ctx: CanvasRenderingContext2D, playerName: string) {
  const cx = CANVAS_W / 2;
  const CLR  = ['#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171'];
  const BKG  = ['#052e16', '#1a2e05', '#1c1002', '#1c0a02', '#1c0202'];
  const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

  const div = (y: number) => {
    ctx.strokeStyle = '#0f2a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, y);
    ctx.lineTo(CANVAS_W - 36, y);
    ctx.stroke();
  };

  const sec = (text: string, y: number) => {
    ctx.fillStyle = '#1e4a6a';
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(text, 36, y);
  };

  ctx.textAlign = 'center';
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.shadowColor = '#67e8f9';
  ctx.shadowBlur = 18;
  ctx.fillText('❄  QUERY DROP', cx, 52);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#334155';
  ctx.font = '13px "Courier New", monospace';
  const greeting = playerName ? `Route queries · save the most $  ·  good luck, ${playerName}!` : 'Route queries to the right warehouse · save the most $';
  ctx.fillText(greeting, cx, 76);

  // 5 stages callout
  ctx.fillStyle = '#a78bfa';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('5 stages  ·  earn YUKI POW in Stage 3  ·  survive the AI Rain in Stage 4!', cx, 90);

  div(98);

  sec('COMPLEXITY BAR  →  SIZE OF WAREHOUSE NEEDED', 116);
  const colW = (CANVAS_W - 72) / 5;
  for (let i = 0; i < 5; i++) {
    const bx = 36 + i * colW + colW / 2;
    const segW = 11, segGap = 3, totalW = 5 * segW + 4 * segGap;
    const sx = bx - totalW / 2;
    for (let s = 0; s < 5; s++) {
      ctx.fillStyle = s <= i ? CLR[i] : '#1a3a6a';
      ctx.fillRect(sx + s * (segW + segGap), 130, segW, 9);
    }
    ctx.fillStyle = CLR[i];
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(SIZES[i], bx, 158);
  }

  div(171);

  sec('MATCH QUERY TO THE RIGHT WAREHOUSE SIZE', 189);
  const badgeW = Math.floor((CANVAS_W - 72 - 16) / 5);
  for (let i = 0; i < 5; i++) {
    const bx = 36 + i * (badgeW + 4);
    rrect(ctx, bx, 199, badgeW, 30, 6);
    ctx.fillStyle = BKG[i];
    ctx.fill();
    ctx.strokeStyle = CLR[i] + '88';
    ctx.lineWidth = 1.5;
    rrect(ctx, bx, 199, badgeW, 30, 6);
    ctx.stroke();
    ctx.fillStyle = CLR[i];
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`❄ ${SIZES[i]}`, bx + badgeW / 2, 219);
  }

  div(245);

  sec('CONTROLS', 263);
  const ctrlRows: [string, string][] = IS_TOUCH ? [
    ['Swipe ← →',   'Move between warehouses'],
    ['Swipe ↓',     'Fast drop'],
    ['Tap WH',      'Instant drop to that warehouse'],
    ['2× tap block','Spin up new WH  (costs 25cr)'],
    ['Tap anywhere','Activate YUKI POW (Stage 4 only)'],
  ] : [
    ['← →',         'Move between warehouses'],
    ['↓',           'Fast drop'],
    ['Click WH',    'Instant drop to that warehouse'],
    ['SPACE',       'Spin up new WH  (costs 25cr)'],
    ['P',           'Activate YUKI POW (Stage 4 only)'],
  ];
  for (let i = 0; i < ctrlRows.length; i++) {
    const y = 279 + i * 22;
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(ctrlRows[i][0], 36, y);
    ctx.fillStyle = '#475569';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(ctrlRows[i][1], 160, y);
  }

  div(393);

  sec('SCORING', 411);
  const scoreRows: [string, string, string][] = [
    ['❄ Perfect match',          'Saved $45 · combo grows',    '#67e8f9'],
    ['⚠ Off by 1 size',          'Less savings · −18cr budget','#facc15'],
    ['✗ Wrong WH',               'No savings  · −40cr budget', '#f87171'],
    ['❌ WH full / budget out',  '−1 life  (3 lives total)',    '#f87171'],
    ['⚡ 5× combo in Stage 3',   'Earns YUKI POW!',             '#a78bfa'],
  ];
  for (let i = 0; i < scoreRows.length; i++) {
    const y = 427 + i * 22;
    ctx.fillStyle = scoreRows[i][2];
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(scoreRows[i][0], 36, y);
    ctx.fillStyle = '#475569';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(scoreRows[i][1], 282, y);
  }

  div(537);

  ctx.fillStyle = '#1e3a5f';
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Spin up a WH when it\'s full — that\'s what Yuki does automatically, 24/7.', cx, 557);

  const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 480);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#67e8f9';
  ctx.shadowBlur = 14;
  ctx.fillText(IS_TOUCH ? '▶  Tap anywhere to start' : '▶  Click or press any key to start', cx, 620);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const now = performance.now();
  const dt = Math.min((now - lastParticleTime) / 1000, 0.05);
  lastParticleTime = now;
  updateParticles(dt);

  ctx.fillStyle = '#020c1a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const aurora = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
  aurora.addColorStop(0,   'rgba(103,232,249,0.04)');
  aurora.addColorStop(0.5, 'rgba(167,139,250,0.06)');
  aurora.addColorStop(1,   'rgba(103,232,249,0.04)');
  ctx.fillStyle = aurora;
  ctx.fillRect(0, 0, CANVAS_W, 180);

  drawParticles(ctx);

  if (state.status === 'tutorial') {
    drawTutorial(ctx, state.playerName);
    ctx.fillStyle = 'rgba(0,0,0,0.025)';
    for (let y = 0; y < CANVAS_H; y += 4) ctx.fillRect(0, y, CANVAS_W, 2);
    return;
  }

  const drawBoard = (
    boardX: number,
    board: BoardScore,
    label: string,
    accent: string,
    queryX: number,
    lane: number,
    isPenguin: boolean,
  ) => {
    ctx.save();
    ctx.translate(boardX, 10);

    const boardGrad = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    boardGrad.addColorStop(0, '#071220');
    boardGrad.addColorStop(1, '#040d18');
    ctx.fillStyle = boardGrad;
    ctx.beginPath();
    rrect(ctx, 0, 0, BOARD_W, BOARD_H, 10);
    ctx.fill();

    ctx.strokeStyle = accent + '44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    rrect(ctx, 0, 0, BOARD_W, BOARD_H, 10);
    ctx.stroke();

    drawHeader(
      ctx, board, label, accent, state.stage, state.nextQuery,
      isPenguin, state.spinupPending && !isPenguin,
      state.yuki.score, state.bestScore,
      !isPenguin && state.hasYukiPow, !isPenguin && state.yukiPowUsed,
    );

    const dynamicLaneW = BOARD_W / buildLaneList(board.warehouses, board.extraWarehouses).length;
    const totalLanes = buildLaneList(board.warehouses, board.extraWarehouses).length;
    ctx.strokeStyle = '#0a1a2e';
    ctx.lineWidth = 1;
    for (let i = 1; i < totalLanes; i++) {
      ctx.beginPath();
      ctx.moveTo(i * dynamicLaneW, HEADER_H);
      ctx.lineTo(i * dynamicLaneW, WH_ZONE_Y);
      ctx.stroke();
    }

    const fallProgress = (state.queryY - QUERY_START_Y) / (QUERY_LAND_Y - QUERY_START_Y);
    const showFullHint = !isPenguin && fallProgress > 0.55;

    if (!isPenguin && board.combo >= 5) {
      const intensity = Math.min(1, (board.combo - 5) / 10);
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 200));
      ctx.globalAlpha = (0.10 + intensity * 0.18) * pulse;
      ctx.fillStyle = '#c084fc';
      const fontSize = Math.round(48 + intensity * 24);
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 32;
      ctx.fillText(`${board.combo}×`, BOARD_W / 2, (HEADER_H + WH_ZONE_Y) / 2 + fontSize * 0.36);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    drawWarehouses(ctx, lane, board.warehouses, board.extraWarehouses, showFullHint, !isPenguin);

    // Draw falling query — hidden during transitions and the whole AI rain event
    const rainActive = state.aiRainPhase === 'warning' || state.aiRainPhase === 'raining';
    const showQuery = isPenguin || (!state.stageTransition.active && !rainActive);
    if (state.currentQuery && showQuery) {
      drawFallingQuery(
        ctx, state.currentQuery, queryX, state.queryY,
        isPenguin,
        !isPenguin && state.spinupPending,
        !isPenguin && state.stage === 1,
      );
    }

    drawFeedback(ctx, board);

    // Stage 1 hint
    if (!isPenguin && state.stage === 1 && !state.stageTransition.active) {
      drawStage1Hint(ctx);
    }

    // AI rain overlay (player board only)
    if (!isPenguin && state.aiRainPhase !== 'none') {
      drawAiRainOverlay(ctx, state);
    }

    // Stage transition overlay (player board only)
    if (!isPenguin && state.stageTransition.active) {
      drawStageTransition(ctx, state.stageTransition, state.hasYukiPow);
    }

    ctx.restore();
  };

  const playerLabel = state.playerName
    ? state.playerName.toUpperCase().slice(0, 14)
    : 'PLAYER';

  const shk = state.shakeMagnitude;
  if (shk > 0) {
    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * shk * 2.2,
      (Math.random() - 0.5) * shk,
    );
  }

  drawBoard(PLAYER_BX, state.player, playerLabel, PLAYER_ACCENT, state.playerX, state.playerLane, false);

  if (shk > 0) {
    ctx.fillStyle = `rgba(239,68,68,${Math.min(0.22, shk * 0.019)})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.025)';
  for (let y = 0; y < CANVAS_H; y += 4) {
    ctx.fillRect(0, y, CANVAS_W, 2);
  }
}
