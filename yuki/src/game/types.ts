export type WHSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type MatchQuality = 'perfect' | 'close' | 'poor';
export type GameStatus = 'start' | 'tutorial' | 'playing' | 'gameover';

export interface Query {
  id: string;
  size: WHSize;
  sqlSnippet: string;
}

export interface ProcessingQuery {
  query: Query;
  progress: number; // 0 → 1
}

export interface Warehouse {
  size: WHSize;
  queue: ProcessingQuery[];
}

export interface Feedback {
  text: string;
  x: number;
  y: number;
  opacity: number;
  color: string;
  big?: boolean; // error/life-loss messages — larger text, slower fade
}

export interface ExtraWarehouse {
  id: string;
  size: WHSize;
  queue: ProcessingQuery[];
  fadeIn: number;    // 0 → 1 on creation
  fadeOut: number;   // 1 → 0 on removal
  removing: boolean;
}

export interface BoardScore {
  score: number;
  lives: number;
  combo: number;
  feedback: Feedback[];
  warehouses: Warehouse[];
  extraWarehouses: ExtraWarehouse[];
  credits: number;
}

export interface GameState {
  status: GameStatus;
  player: BoardScore;
  yuki: BoardScore;
  currentQuery: Query | null;
  nextQuery: Query | null;
  queryY: number;
  playerLane: number;
  playerX: number;
  yukiLane: number;
  yukiX: number;
  queryPool: Query[];
  queryIndex: number;
  level: number;
  queryCountThisLevel: number;
  speed: number;
  playerName: string;
  spinupPending: boolean;
}
