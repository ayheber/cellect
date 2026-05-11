import { useEffect, useRef, useState } from 'react';
import { GameState, GameStatus, Query, MatchQuality, Warehouse, ExtraWarehouse } from '../game/types';
import { sound } from '../game/sound';
import {
  WH_SIZES, SQL_SNIPPETS, FAST_DROP_SPEED, STAGE_SPEED_INC,
  WH_QUERY_COST, BASELINE_COST, COMBO_BONUS,
  QUERY_START_Y, QUERY_LAND_Y, BOARD_W, BOARD_H, WH_ZONE_Y, PLAYER_BX,
  MAX_QUEUE, STARTING_CREDITS, PROCESS_TIME, PROCESS_LEVEL_INC, CREDIT_COST, WH_WEIGHTS,
  STAGES, AI_RAIN_TRIGGER_QUERY, AI_RAIN_WARNING_DURATION, AI_RAIN_TIMEOUT, AI_RAIN_NO_POW_TIMEOUT,
  YUKI_POW_COMBO_REQUIRED, STAGE_TRANSITION_DURATION,
} from '../game/constants';
import { render } from '../game/renderer';

// ── Lane helpers (shared with renderer) ────────────────────────────────────────

export interface LaneEntry {
  id: string;
  size: string;
  queue: { query: Query; progress: number }[];
  isExtra: boolean;
  opacity: number;
}

export function buildLaneList(base: Warehouse[], extras: ExtraWarehouse[]): LaneEntry[] {
  const list: LaneEntry[] = [];
  for (const wh of base) {
    list.push({ id: wh.size, size: wh.size, queue: wh.queue, isExtra: false, opacity: 1 });
    for (const e of extras.filter(x => x.size === wh.size)) {
      list.push({ id: e.id, size: e.size, queue: e.queue, isExtra: true, opacity: Math.min(e.fadeIn, e.removing ? e.fadeOut : 1) });
    }
  }
  return list;
}

export function getBaseLaneX(list: LaneEntry[], baseIdx: number): number {
  const laneW = BOARD_W / list.length;
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    if (!list[i].isExtra) {
      if (count === baseIdx) return i * laneW + laneW / 2;
      count++;
    }
  }
  return BOARD_W / 2;
}

// ── Init helpers ───────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function weightedSize(): typeof WH_SIZES[number] {
  let r = Math.random();
  for (let i = 0; i < WH_SIZES.length; i++) {
    r -= WH_WEIGHTS[i];
    if (r <= 0) return WH_SIZES[i];
  }
  return WH_SIZES[WH_SIZES.length - 1];
}

function generatePool(count: number): Query[] {
  return Array.from({ length: count }, (_, i) => {
    const size = weightedSize();
    const snippets = SQL_SNIPPETS[size];
    return { id: `q${i}-${Math.random().toString(36).slice(2)}`, size, sqlSnippet: snippets[Math.floor(Math.random() * snippets.length)] };
  });
}

function makeWarehouses(): Warehouse[] {
  return WH_SIZES.map(size => ({ size, queue: [] }));
}

function makeBoard() {
  return { score: 0, lives: 3, combo: 0, feedback: [], warehouses: makeWarehouses(), extraWarehouses: [] as ExtraWarehouse[], credits: STARTING_CREDITS };
}

function getMatchQuality(lane: number, size: string): MatchQuality {
  const diff = Math.abs(lane - WH_SIZES.indexOf(size as any));
  return diff === 0 ? 'perfect' : diff === 1 ? 'close' : 'poor';
}

function calcSaved(routedLane: number, combo: number): number {
  const actualCost = WH_QUERY_COST[WH_SIZES[routedLane]];
  const saved = Math.max(0, BASELINE_COST - actualCost);
  const mult = 1 + Math.floor(combo / 3) * COMBO_BONUS;
  return Math.round(saved * mult);
}

function makeInitialState(playerName: string): GameState {
  const pool = generatePool(200);
  const first = pool[0];
  const bestScore = parseInt(localStorage.getItem('yuki-best') || '0', 10);
  return {
    status: 'tutorial',
    player: makeBoard(),
    yuki: makeBoard(),
    currentQuery: first,
    nextQuery: pool[1],
    queryY: QUERY_START_Y,
    playerLane: 2,
    playerX: getBaseLaneX(buildLaneList(makeWarehouses(), []), 2),
    yukiLane: WH_SIZES.indexOf(first.size),
    yukiX: getBaseLaneX(buildLaneList(makeWarehouses(), []), 2),
    queryPool: pool,
    queryIndex: 0,
    level: 1,
    queryCountThisLevel: 0,
    speed: STAGES[0].speed,
    playerName,
    spinupPending: false,
    shakeMagnitude: 0,
    bestScore,
    stage: 1,
    stageQueriesCompleted: 0,
    hasYukiPow: false,
    yukiPowUsed: false,
    aiRainPhase: 'none',
    aiRainTimer: 0,
    aiRainDrops: [],
    stageTransition: { active: false, nextStage: 2, timer: 0, grantedPow: false },
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGame(canvasRef: React.RefObject<HTMLCanvasElement>, playerName: string) {
  const [status, setStatus] = useState<GameStatus>('playing');
  const finalScoreRef = useRef(0);
  const yukiScoreRef = useRef(0);
  const isNewBestRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = makeInitialState(playerName);
    let fastDrop = false;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // ── Stage helpers ─────────────────────────────────────────────────────────

    function activateYukiPow() {
      if (!state.hasYukiPow || state.yukiPowUsed) return;
      if (state.aiRainPhase !== 'raining') return;
      state.yukiPowUsed = true;
      state.aiRainPhase = 'cleared';
      state.aiRainTimer = 2.2;
      state.aiRainDrops = [];
      sound.yukiPow();
      state.player.feedback.push({
        text: '⚡ YUKI POW! AI Rain neutralized!',
        x: BOARD_W / 2, y: 340, opacity: 1, color: '#67e8f9', big: true,
      });
    }

    function completeStageTransition() {
      const next = state.stageTransition.nextStage;
      state.stage = next;
      state.stageQueriesCompleted = 0;
      state.queryCountThisLevel = 0;
      state.level = next;
      state.speed = STAGES[next - 1].speed;
      state.stageTransition = { active: false, nextStage: next + 1, timer: 0, grantedPow: false };
      state.queryY = QUERY_START_Y;
      fastDrop = false;
    }

    function devJumpToStage(n: number) {
      if (n < 1 || n > STAGES.length) return;
      state.stage = n;
      state.stageQueriesCompleted = 0;
      state.queryCountThisLevel = 0;
      state.level = n;
      state.speed = STAGES[n - 1].speed;
      state.queryY = QUERY_START_Y;
      state.aiRainPhase = 'none';
      state.aiRainTimer = 0;
      state.aiRainDrops = [];
      state.stageTransition = { active: false, nextStage: n + 1, timer: 0, grantedPow: false };
      state.hasYukiPow = n >= 4;
      state.yukiPowUsed = false;
      fastDrop = false;
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    const onKeyDown = (e: KeyboardEvent) => {
      // Dev: Ctrl+1–5 jumps to that stage
      if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        devJumpToStage(parseInt(e.key));
        return;
      }

      if (state.status === 'tutorial') { state.status = 'playing'; return; }
      if (state.status !== 'playing') return;
      if (state.stageTransition.active) return;

      if (e.key === 'p' || e.key === 'P') { activateYukiPow(); return; }

      // Freeze all normal input during AI rain event
      if (state.aiRainPhase === 'warning' || state.aiRainPhase === 'raining') return;

      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') state.playerLane = Math.max(0, state.playerLane - 1);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { const lanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses); state.playerLane = Math.min(lanes.length - 1, state.playerLane + 1); }
      if (e.key === ' ')         { e.preventDefault(); state.spinupPending = true; }
      if (e.key === 'ArrowDown') { e.preventDefault(); fastDrop = true; }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'ArrowDown') fastDrop = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let touchStartX = 0, touchStartY = 0, lastTapTime = 0, lastTouchEnd = 0;
    const onTouchStart = (e: TouchEvent) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      if (state.status === 'tutorial') { state.status = 'playing'; return; }
      if (state.status !== 'playing') return;
      if (state.stageTransition.active) return;

      // YUKI POW tap during AI rain (raining only — warning is cinematic)
      if (state.aiRainPhase === 'raining') { activateYukiPow(); return; }
      if (state.aiRainPhase === 'warning') return;

      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
        { const lanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses); state.playerLane = dx > 0 ? Math.min(lanes.length - 1, state.playerLane + 1) : Math.max(0, state.playerLane - 1); }
        return;
      }
      if (dy > 35 && Math.abs(dy) > Math.abs(dx)) { fastDrop = true; setTimeout(() => { fastDrop = false; }, 600); return; }
      const now = Date.now();
      const rect = canvas.getBoundingClientRect();
      const tapX = (t.clientX - rect.left) * (canvas.width / rect.width);
      const tapY = (t.clientY - rect.top) * (canvas.height / rect.height);
      const inWHZone = tapY >= 10 + WH_ZONE_Y;
      const onBlock = Math.abs(tapX - (PLAYER_BX + state.playerX)) < 50;
      if (onBlock && now - lastTapTime < 300) {
        state.spinupPending = true;
      } else if (tapX >= PLAYER_BX && tapX <= PLAYER_BX + BOARD_W) {
        const lanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses);
        const dynLaneW = BOARD_W / lanes.length;
        const lane = Math.floor((tapX - PLAYER_BX) / dynLaneW);
        if (lane >= 0 && lane < lanes.length) {
          if (inWHZone && lane === state.playerLane) {
            state.queryY = QUERY_LAND_Y;
          } else {
            state.playerLane = lane;
          }
        }
      }
      lastTapTime = now;
      lastTouchEnd = now;
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('click', (e: MouseEvent) => {
      if (state.status === 'tutorial') { state.status = 'playing'; return; }
      if (state.status !== 'playing') return;
      if (state.stageTransition.active) return;
      if (Date.now() - lastTouchEnd < 400) return;

      // YUKI POW click during AI rain
      if (state.aiRainPhase === 'raining') { activateYukiPow(); return; }
      if (state.aiRainPhase === 'warning') return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (x >= PLAYER_BX && x <= PLAYER_BX + BOARD_W) {
        const lanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses);
        const dynLaneW = BOARD_W / lanes.length;
        const lane = Math.floor((x - PLAYER_BX) / dynLaneW);
        if (lane >= 0 && lane < lanes.length) {
          if (y >= 10 + WH_ZONE_Y && lane === state.playerLane) {
            state.queryY = QUERY_LAND_Y;
          } else {
            state.playerLane = lane;
          }
        }
      }
    });

    // ── Game logic ────────────────────────────────────────────────────────────

    function spawnExtra(size: string, query: Query, extras: ExtraWarehouse[]) {
      extras.push({ id: `extra-${Date.now()}-${Math.random().toString(36).slice(2)}`, size: size as any, queue: [{ query, progress: 0 }], fadeIn: 0, fadeOut: 1, removing: false });
    }

    function advanceQuery() {
      state.queryIndex++;
      if (state.queryIndex + 1 >= state.queryPool.length) state.queryPool.push(...generatePool(50));
      state.currentQuery = state.queryPool[state.queryIndex];
      state.nextQuery = state.queryPool[state.queryIndex + 1] ?? null;
      state.queryY = QUERY_START_Y;
      const pLanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses);
      state.playerLane = Math.min(state.playerLane, pLanes.length - 1);
      state.yukiLane = WH_SIZES.indexOf(state.currentQuery.size);
      state.spinupPending = false;
      fastDrop = false;

      state.stageQueriesCompleted++;
      state.queryCountThisLevel++;

      // Update speed within stage
      const stageConfig = STAGES[state.stage - 1];
      state.speed = stageConfig.speed + Math.floor(state.stageQueriesCompleted / 4) * STAGE_SPEED_INC;

      // Trigger AI rain in stage 4
      if (state.stage === 4 && state.stageQueriesCompleted === AI_RAIN_TRIGGER_QUERY && state.aiRainPhase === 'none') {
        state.aiRainPhase = 'warning';
        state.aiRainTimer = AI_RAIN_WARNING_DURATION;
        state.queryY = QUERY_START_Y; // park query at top; it won't fall until rain is over
        sound.aiRainWarning();
      }

      // Check stage completion (stage 5 is infinite)
      if (stageConfig.queries > 0 && state.stageQueriesCompleted >= stageConfig.queries && state.stage < STAGES.length) {
        const grantedPow = state.stage === 3 && state.hasYukiPow;
        state.stageTransition = {
          active: true,
          nextStage: state.stage + 1,
          timer: STAGE_TRANSITION_DURATION,
          grantedPow,
        };
        sound.stageAdvance();
      }
    }

    function scorePlayer(): boolean {
      const q = state.currentQuery!;
      const b = state.player;
      const fx = state.playerX;
      const fy = state.queryY - 20;

      if (state.spinupPending && b.credits >= CREDIT_COST.spinup) {
        spawnExtra(q.size, q, b.extraWarehouses);
        b.credits -= CREDIT_COST.spinup;
        const optLane = WH_SIZES.indexOf(q.size);
        const saved = calcSaved(optLane, b.combo);
        b.score += saved;
        b.combo++;
        sound.spinup();
        b.feedback.push({ text: `⚡ New ${q.size} WH added! Saved $${saved}`, x: fx, y: fy, opacity: 1, color: '#67e8f9' });
      } else {
        const lanes = buildLaneList(b.warehouses, b.extraWarehouses);
        const visIdx = Math.min(state.playerLane, lanes.length - 1);
        const selectedLane = lanes[visIdx];
        const playerSizeIdx = WH_SIZES.indexOf(selectedLane.size as any);
        if (selectedLane.queue.length >= MAX_QUEUE) {
          b.lives--;
          b.combo = 0;
          state.shakeMagnitude = 12;
          sound.lifeLoss();
          b.feedback.push({ text: '❌ WH FULL! Query LOST  –1 life', x: fx, y: fy, opacity: 1, color: '#f87171', big: true });
          const spinupHint = isTouchDevice ? 'Double-tap block to add a new WH' : 'Press SPACE to add a new WH';
          b.feedback.push({ text: spinupHint, x: fx, y: fy - 36, opacity: 1, color: '#fb923c' });
        } else {
          const optimalIdx = WH_SIZES.indexOf(q.size);
          const quality = getMatchQuality(playerSizeIdx, q.size);
          const saved = calcSaved(playerSizeIdx, b.combo);
          b.score += saved;
          b.credits = Math.max(0, b.credits - CREDIT_COST[quality]);
          selectedLane.queue.push({ query: q, progress: 0 });

          if (quality === 'perfect') {
            b.combo++;
            sound.perfect();
            if (b.combo >= 5 && b.combo % 5 === 0) sound.combo(b.combo);
            b.feedback.push({ text: `❄ PERFECT! Saved $${saved}`, x: fx, y: fy, opacity: 1, color: '#67e8f9' });

            // Earn YUKI POW in stage 3 on reaching combo threshold
            if (state.stage === 3 && b.combo >= YUKI_POW_COMBO_REQUIRED && !state.hasYukiPow) {
              state.hasYukiPow = true;
              b.feedback.push({ text: '⚡ YUKI POW EARNED!', x: fx, y: fy - 56, opacity: 1, color: '#67e8f9', big: true });
              sound.newBest();
            }
          } else if (quality === 'close') {
            b.combo = 0;
            sound.close();
            const rightWH = WH_SIZES[optimalIdx];
            const dir = playerSizeIdx > optimalIdx ? 'too big' : 'too small';
            b.feedback.push({ text: `WH ${dir} — use ${rightWH}`, x: fx, y: fy, opacity: 1, color: '#facc15' });
            b.feedback.push({ text: `Saved $${saved}  (−${CREDIT_COST.close}cr wasted)`, x: fx, y: fy - 32, opacity: 1, color: '#facc15' });
          } else {
            b.combo = 0;
            sound.wrong();
            const rightWH = WH_SIZES[optimalIdx];
            const dir = playerSizeIdx > optimalIdx ? 'Way too big' : 'Way too small';
            b.feedback.push({ text: `${dir}! Use ${rightWH} WH`, x: fx, y: fy, opacity: 1, color: '#f87171', big: true });
            b.feedback.push({ text: `Saved $${saved}  (−${CREDIT_COST.poor}cr wasted)`, x: fx, y: fy - 40, opacity: 1, color: '#f87171' });
          }

          if (b.credits <= 0) {
            b.lives--;
            b.credits = STARTING_CREDITS;
            state.shakeMagnitude = 12;
            sound.lifeLoss();
            b.feedback.push({ text: '💸 Over budget! –1 life', x: fx, y: fy - 74, opacity: 1, color: '#fb923c', big: true });
          }
        }
      }
      if (b.lives <= 0) { state.status = 'gameover'; return true; }
      return false;
    }

    function scoreYuki() {
      const q = state.currentQuery!;
      const b = state.yuki;
      const wh = b.warehouses[WH_SIZES.indexOf(q.size)];
      if (wh.queue.length >= MAX_QUEUE) {
        spawnExtra(q.size, q, b.extraWarehouses);
        b.credits = Math.max(0, b.credits - CREDIT_COST.spinup);
      } else {
        wh.queue.push({ query: q, progress: 0 });
        b.credits = Math.max(0, b.credits - CREDIT_COST.perfect);
      }
      if (b.credits <= 0) b.credits = STARTING_CREDITS;
      const optLane = WH_SIZES.indexOf(q.size);
      const saved = calcSaved(optLane, b.combo);
      b.score += saved;
      b.combo++;
      b.feedback.push({ text: `+$${saved}`, x: state.yukiX, y: state.queryY - 20, opacity: 1, color: '#38bdf8' });
    }

    function updateWarehouses(dt: number) {
      const levelMult = 1 + (state.stage - 1) * PROCESS_LEVEL_INC;
      for (const board of [state.player, state.yuki]) {
        for (const wh of board.warehouses) {
          if (wh.queue.length > 0) {
            wh.queue[0].progress += dt / (PROCESS_TIME[wh.size] * levelMult);
            if (wh.queue[0].progress >= 1) wh.queue.shift();
          }
        }
        for (const e of board.extraWarehouses) {
          e.fadeIn = Math.min(1, e.fadeIn + dt * 3.5);
          if (e.queue.length > 0) {
            e.queue[0].progress += dt / (PROCESS_TIME[e.size] * levelMult);
            if (e.queue[0].progress >= 1) e.queue.shift();
          }
          if (e.queue.length === 0 && e.fadeIn >= 1) e.removing = true;
          if (e.removing) e.fadeOut = Math.max(0, e.fadeOut - dt * 1.5);
        }
        board.extraWarehouses = board.extraWarehouses.filter(e => !(e.removing && e.fadeOut <= 0));
      }
    }

    function updateAiRain(dt: number) {
      const phase = state.aiRainPhase;
      if (phase === 'none') return;

      if (phase === 'warning') {
        state.aiRainTimer -= dt;
        // Sparse warning drops
        if (Math.random() < dt * 2.5) {
          state.aiRainDrops.push({
            x: 20 + Math.random() * (BOARD_W - 40),
            y: QUERY_START_Y - 10,
            speed: 55 + Math.random() * 45,
            size: WH_SIZES[Math.floor(Math.random() * WH_SIZES.length)],
            opacity: 0.75,
          });
        }
        if (state.aiRainTimer <= 0) {
          state.aiRainPhase = 'raining';
          state.aiRainTimer = state.hasYukiPow ? AI_RAIN_TIMEOUT : AI_RAIN_NO_POW_TIMEOUT;
          // Freeze query at top so player focuses on the POW activation
          state.queryY = QUERY_START_Y;
          fastDrop = false;
        }
      } else if (phase === 'raining') {
        state.aiRainTimer -= dt;
        // Dense rain
        const rate = state.hasYukiPow ? 5 : 12;
        const n = Math.floor(rate * dt + Math.random());
        for (let i = 0; i < n; i++) {
          state.aiRainDrops.push({
            x: 20 + Math.random() * (BOARD_W - 40),
            y: QUERY_START_Y - 20,
            speed: 110 + Math.random() * 130,
            size: WH_SIZES[Math.floor(Math.random() * WH_SIZES.length)],
            opacity: 1,
          });
        }
        if (state.aiRainTimer <= 0 && !state.yukiPowUsed) {
          // Overwhelmed — game over
          state.player.lives = 0;
          state.status = 'gameover';
        }
      } else if (phase === 'cleared') {
        state.aiRainTimer -= dt;
        state.aiRainDrops = state.aiRainDrops
          .map(d => ({ ...d, opacity: d.opacity - 3 * dt }))
          .filter(d => d.opacity > 0);
        if (state.aiRainTimer <= 0) {
          state.aiRainPhase = 'none';
          state.aiRainDrops = [];
        }
      }

      // Move drops (warning + raining phases)
      if (phase === 'warning' || phase === 'raining') {
        state.aiRainDrops = state.aiRainDrops
          .map(d => ({ ...d, y: d.y + d.speed * dt, opacity: d.y > QUERY_LAND_Y - 30 ? Math.max(0, d.opacity - 5 * dt) : d.opacity }))
          .filter(d => d.opacity > 0 && d.y < BOARD_H);
      }
    }

    // ── Loop ──────────────────────────────────────────────────────────────────

    let lastT = performance.now(), raf = 0;

    const loop = (ts: number) => {
      try {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;

      if (state.status === 'playing') {
        if (state.stageTransition.active) {
          // Frozen gameplay — only tick the transition countdown
          state.stageTransition.timer -= dt;
          if (state.stageTransition.timer <= 0) completeStageTransition();
        } else {
          // AI rain update (runs while query is frozen during warning/raining)
          if (state.aiRainPhase !== 'none') updateAiRain(dt);

          // Freeze gameplay during warning AND raining — the rain is a cinematic interruption
          const queryFrozen = state.aiRainPhase === 'warning' || state.aiRainPhase === 'raining';

          if (!queryFrozen) {
            // Dynamic lane positions
            const pList = buildLaneList(state.player.warehouses, state.player.extraWarehouses);
            const yList = buildLaneList(state.yuki.warehouses, state.yuki.extraWarehouses);
            state.playerLane = Math.min(state.playerLane, pList.length - 1);
            const pLaneW = BOARD_W / pList.length;
            const pTargetX = state.playerLane * pLaneW + pLaneW / 2;
            const yTargetX = getBaseLaneX(yList, state.yukiLane);
            state.playerX = lerp(state.playerX, pTargetX, 1 - Math.exp(-14 * dt));
            state.yukiX   = lerp(state.yukiX,   yTargetX, 1 - Math.exp(-22 * dt));

            state.queryY += (fastDrop ? FAST_DROP_SPEED : state.speed) * dt;

            if (state.queryY >= QUERY_LAND_Y) {
              const over = scorePlayer();
              scoreYuki();
              if (!over) advanceQuery();
            }

            updateWarehouses(dt);
          }
        }

        // Feedback and shake always update
        for (const board of [state.player, state.yuki]) {
          board.feedback = board.feedback
            .map(fb => ({ ...fb, y: fb.y - 32 * dt, opacity: fb.opacity - (fb.big ? 0.35 : 0.48) * dt }))
            .filter(fb => fb.opacity > 0);
        }
        if (state.shakeMagnitude > 0) {
          state.shakeMagnitude = Math.max(0, state.shakeMagnitude - 60 * dt);
        }
      }

      try { render(ctx, state); } catch (err) { console.error('render error:', err); }
      } catch (err) { console.error('loop error:', err); }

      if (state.status === 'playing' || state.status === 'tutorial') { raf = requestAnimationFrame(loop); }
      else {
        finalScoreRef.current = state.player.score;
        yukiScoreRef.current = state.yuki.score;
        const prev = parseInt(localStorage.getItem('yuki-best') || '0', 10);
        const isNew = state.player.score > prev;
        if (isNew) {
          localStorage.setItem('yuki-best', state.player.score.toString());
          sound.newBest();
        }
        isNewBestRef.current = isNew;
        setStatus(state.status);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canvasRef, playerName]);

  return { status, finalScore: finalScoreRef.current, yukiScore: yukiScoreRef.current, isNewBest: isNewBestRef.current };
}
