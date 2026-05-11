import { WHSize } from './types';

export const CANVAS_W = 560;
export const CANVAS_H = 700;

export const BOARD_W = 540;
export const BOARD_H = 680;

export const PLAYER_BX = 10; // single board, left offset

export const NUM_LANES = 5;
export const LANE_W = BOARD_W / NUM_LANES; // 108

export const HEADER_H = 72;
export const WH_ZONE_H = 130;
export const WH_ZONE_Y = BOARD_H - WH_ZONE_H; // 550

export const QUERY_W = LANE_W - 12; // 96
export const QUERY_START_Y = HEADER_H + 20; // 92
export const QUERY_LAND_Y = WH_ZONE_Y - 8; // 542

export const WH_SIZES: WHSize[] = ['XS', 'S', 'M', 'L', 'XL'];

export const WH_COLORS: Record<WHSize, string> = {
  XS: '#4ade80',
  S: '#a3e635',
  M: '#facc15',
  L: '#fb923c',
  XL: '#f87171',
};

export const WH_BG: Record<WHSize, string> = {
  XS: '#052e16',
  S: '#1a2e05',
  M: '#1c1002',
  L: '#1c0a02',
  XL: '#1c0202',
};

export const BASE_SPEED = 90;
export const FAST_DROP_SPEED = 600;
export const SPEED_INC = 14;
export const QUERIES_PER_LEVEL = 8;

export const MAX_QUEUE = 2;
export const STARTING_CREDITS = 500;

// Weighted query size distribution — small queries dominate (realistic workload)
export const WH_WEIGHTS: number[] = [0.35, 0.28, 0.20, 0.11, 0.06]; // XS S M L XL

// Base processing time per WH size (seconds)
export const PROCESS_TIME: Record<WHSize, number> = {
  XS: 5.5,
  S: 7.0,
  M: 8.0,
  L: 9.5,
  XL: 11.0,
};

// Processing slows +10% per stage
export const PROCESS_LEVEL_INC = 0.10;

export const CREDIT_COST = {
  perfect: 5,
  close: 18,
  poor: 40,
  spinup: 25,
  overflow: 0,
};

export const WH_QUERY_COST: Record<WHSize, number> = {
  XS: 15,
  S:  30,
  M:  60,
  L:  120,
  XL: 240,
};

export const BASELINE_COST = 60;
export const COMBO_BONUS = 0.4;

// ── Stage system ──────────────────────────────────────────────────────────────

export interface StageConfig {
  stage: number;
  name: string;
  queries: number; // -1 = infinite (stage 5)
  speed: number;
  desc: string;
}

export const STAGES: StageConfig[] = [
  { stage: 1, name: 'INTRO',     queries:  8, speed:  50, desc: 'Sizes shown on each query block' },
  { stage: 2, name: 'WARM UP',   queries: 12, speed:  75, desc: 'Read the bar — no size hints' },
  { stage: 3, name: 'CHALLENGE', queries: 16, speed: 100, desc: 'Hit a 5× combo to earn YUKI POW!' },
  { stage: 4, name: 'AI RAIN',   queries: 12, speed: 128, desc: 'Survive the storm...' },
  { stage: 5, name: 'EXPERT',    queries: -1, speed: 160, desc: 'Survive as long as you can' },
];

export const STAGE_SPEED_INC = 5;         // px/s added every 4 queries within a stage

export const AI_RAIN_TRIGGER_QUERY = 6;   // AI rain fires after this many queries in stage 4
export const AI_RAIN_WARNING_DURATION = 3.5;
export const AI_RAIN_TIMEOUT = 12.0;      // seconds to activate YUKI POW
export const AI_RAIN_NO_POW_TIMEOUT = 4.0; // doom timer when player has no YUKI POW
export const YUKI_POW_COMBO_REQUIRED = 5;
export const STAGE_TRANSITION_DURATION = 3.5;

export const SQL_SNIPPETS: Record<WHSize, string[]> = {
  XS: [
    'SELECT id FROM users LIMIT 10',
    'SELECT COUNT(*) FROM pings',
    'SELECT name FROM cfg WHERE key=?',
    'SELECT 1',
  ],
  S: [
    'SELECT * FROM orders WHERE ts > NOW()',
    'SELECT SUM(amt) FROM txns GROUP BY day',
    'SELECT DISTINCT uid FROM logins',
    'SELECT TOP 100 * FROM events',
  ],
  M: [
    'SELECT u.*, o.total FROM users u JOIN orders o ON u.id=o.uid',
    'SELECT region, AVG(rev) FROM sales GROUP BY 1 ORDER BY 2',
    'SELECT p.*, r.score FROM products p LEFT JOIN reviews r USING(id)',
    'SELECT * FROM sessions WHERE duration>300 ORDER BY started',
  ],
  L: [
    'SELECT * FROM fact_sales f JOIN dim_date d USING(date_id) JOIN dim_product p USING(pid)',
    'WITH base AS (SELECT uid, SUM(rev) FROM events GROUP BY 1) SELECT * FROM base WHERE sum>1000',
    'SELECT cohort, PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ltv) FROM cohorts GROUP BY 1',
    'SELECT * FROM logs WHERE ts BETWEEN ? AND ? AND cat IN (SELECT id FROM active_cats)',
  ],
  XL: [
    'SELECT * FROM raw_logs rl CROSS JOIN date_spine ds WHERE rl.year=2024',
    'MERGE INTO wh USING staging ON(id) WHEN MATCHED UPDATE SET ... WHEN NOT MATCHED INSERT ...',
    'SELECT uid, session, path, LAG(path) OVER(PARTITION BY session ORDER BY ts) FROM clickstream',
    "SELECT * FROM billion_row_tbl WHERE unindexed LIKE '%pattern%' ORDER BY RANDOM()",
  ],
};
