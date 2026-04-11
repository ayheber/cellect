import { useEffect, useRef, useState } from 'react';
import { GameState, GameStatus, Query, MatchQuality, Warehouse, ExtraWarehouse } from '../game/types';
import { sound } from '../game/sound';
import {
  WH_SIZES, SQL_SNIPPETS, BASE_SPEED, FAST_DROP_SPEED, SPEED_INC, QUERIES_PER_LEVEL,
  WH_QUERY_COST, BASELINE_COST, COMBO_BONUS,
  QUERY_START_Y, QUERY_LAND_Y, BOARD_W, WH_ZONE_Y, PLAYER_BX,
  MAX_QUEUE, STARTING_CREDITS, PROCESS_TIME, PROCESS_LEVEL_INC, CREDIT_COST, WH_WEIGHTS,
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

// Dollars saved vs the "route everything to M" baseline.
// Never negative — large queries that cost more than M still score $0, not a penalty.
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
    speed: BASE_SPEED,
    playerName,
    spinupPending: false,
    shakeMagnitude: 0,
    bestScore,
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

    // ── Input ─────────────────────────────────────────────────────────────────

    const onKeyDown = (e: KeyboardEvent) => {
      if (state.status === 'tutorial') { state.status = 'playing'; return; }
      if (state.status !== 'playing') return;
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
      const inWHZone = tapY >= 10 + WH_ZONE_Y; // 10 = board's top offset
      const onBlock = Math.abs(tapX - (PLAYER_BX + state.playerX)) < 50;
      if (onBlock && now - lastTapTime < 300) {
        state.spinupPending = true; // double-tap on block = spinup
      } else if (tapX >= PLAYER_BX && tapX <= PLAYER_BX + BOARD_W) {
        const lanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses);
        const dynLaneW = BOARD_W / lanes.length;
        const lane = Math.floor((tapX - PLAYER_BX) / dynLaneW);
        if (lane >= 0 && lane < lanes.length) {
          if (inWHZone && lane === state.playerLane) {
            state.queryY = QUERY_LAND_Y; // tap own WH = instant drop
          } else {
            state.playerLane = lane; // tap other WH or upper area = move there
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
      if (Date.now() - lastTouchEnd < 400) return; // suppress ghost click after touch
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (x >= PLAYER_BX && x <= PLAYER_BX + BOARD_W) {
        const lanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses);
        const dynLaneW = BOARD_W / lanes.length;
        const lane = Math.floor((x - PLAYER_BX) / dynLaneW);
        if (lane >= 0 && lane < lanes.length) {
          if (y >= 10 + WH_ZONE_Y && lane === state.playerLane) {
            state.queryY = QUERY_LAND_Y; // click own WH = instant drop
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
      // Clamp playerLane in case an extra WH just disappeared
      const pLanes = buildLaneList(state.player.warehouses, state.player.extraWarehouses);
      state.playerLane = Math.min(state.playerLane, pLanes.length - 1);
      state.yukiLane = WH_SIZES.indexOf(state.currentQuery.size);
      state.spinupPending = false;
      fastDrop = false;
      state.queryCountThisLevel++;
      if (state.queryCountThisLevel >= QUERIES_PER_LEVEL) {
        state.level++;
        state.queryCountThisLevel = 0;
        state.speed = BASE_SPEED + (state.level - 1) * SPEED_INC;
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
      // Processing slows each level — queues back up more as game speeds up
      const levelMult = 1 + (state.level - 1) * PROCESS_LEVEL_INC;
      for (const board of [state.player, state.yuki]) {
        // Base warehouses
        for (const wh of board.warehouses) {
          if (wh.queue.length > 0) {
            wh.queue[0].progress += dt / (PROCESS_TIME[wh.size] * levelMult);
            if (wh.queue[0].progress >= 1) wh.queue.shift();
          }
        }
        // Extra warehouses
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

    // ── Loop ──────────────────────────────────────────────────────────────────

    let lastT = performance.now(), raf = 0;

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;

      if (state.status === 'playing') {
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

        for (const board of [state.player, state.yuki]) {
          board.feedback = board.feedback
            .map(fb => ({ ...fb, y: fb.y - 32 * dt, opacity: fb.opacity - (fb.big ? 0.35 : 0.48) * dt }))
            .filter(fb => fb.opacity > 0);
        }

        // Decay screen shake
        if (state.shakeMagnitude > 0) {
          state.shakeMagnitude = Math.max(0, state.shakeMagnitude - 60 * dt);
        }
      }

      render(ctx, state);

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
