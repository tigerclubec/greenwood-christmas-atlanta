/**
 * Deterministic ornament slots.
 *
 * Slots are generated once from a fixed seed, so the same index always maps to
 * the same spot on the tree — on the server, on every client, after every reload.
 * Storage only keeps the slot index.
 */

export const TREE = {
  width: 1000,
  height: 1200,
  cx: 500,
  apexY: 168, // tip of the top tier (the star sits just above)
  baseY: 1000, // bottom edge of the lowest tier
  baseHalfWidth: 440,
  ornamentSize: 38, // ball diameter in tree units
} as const;

import { mulberry32 } from "./rand";

export type Slot = { i: number; x: number; y: number };


/** Half-width of the usable ornament area at height y. */
function usableHalfWidth(y: number) {
  const t = (y - TREE.apexY) / (TREE.baseY - TREE.apexY);
  return t * TREE.baseHalfWidth - 34;
}

const MIN_Y = 250;
const MAX_Y = 968;

function inside(x: number, y: number) {
  if (y < MIN_Y || y > MAX_Y) return false;
  return Math.abs(x - TREE.cx) <= usableHalfWidth(y);
}

function edgeDistance(x: number, y: number) {
  return Math.min(usableHalfWidth(y) - Math.abs(x - TREE.cx), y - MIN_Y + 30, MAX_Y - y + 30);
}

/** Bridson Poisson-disk sampling inside the tree silhouette. */
function poisson(minDist: number, seed: number): { x: number; y: number }[] {
  const rand = mulberry32(seed);
  const cell = minDist / Math.SQRT2;
  const cols = Math.ceil(TREE.width / cell);
  const rows = Math.ceil(TREE.height / cell);
  const grid: number[] = new Array(cols * rows).fill(-1);
  const pts: { x: number; y: number }[] = [];
  const active: number[] = [];

  const add = (x: number, y: number) => {
    pts.push({ x, y });
    const gi = Math.floor(y / cell) * cols + Math.floor(x / cell);
    grid[gi] = pts.length - 1;
    active.push(pts.length - 1);
  };

  add(TREE.cx, 620);
  while (active.length) {
    const ai = Math.floor(rand() * active.length);
    const p = pts[active[ai]];
    let found = false;
    for (let k = 0; k < 40; k++) {
      const a = rand() * Math.PI * 2;
      const r = minDist * (1 + rand() * 0.3);
      const x = p.x + Math.cos(a) * r;
      const y = p.y + Math.sin(a) * r;
      if (!inside(x, y)) continue;
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      let ok = true;
      for (let yy = Math.max(0, gy - 2); yy <= Math.min(rows - 1, gy + 2) && ok; yy++) {
        for (let xx = Math.max(0, gx - 2); xx <= Math.min(cols - 1, gx + 2); xx++) {
          const j = grid[yy * cols + xx];
          if (j >= 0) {
            const dx = pts[j].x - x;
            const dy = pts[j].y - y;
            if (dx * dx + dy * dy < minDist * minDist) {
              ok = false;
              break;
            }
          }
        }
      }
      if (ok) {
        add(x, y);
        found = true;
        break;
      }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}

/**
 * Order slots so that the first ornaments spread out evenly over the whole tree
 * and later ones fill the gaps (greedy farthest-point, softly pulled away from edges).
 */
function fillOrder(pts: { x: number; y: number }[]) {
  const n = pts.length;
  const chosen: number[] = [];
  const minD = new Array(n).fill(Infinity);
  const edge = pts.map((p) => Math.max(0, Math.min(1, edgeDistance(p.x, p.y) / 90)));
  // start in the visual "sweet spot", a little above center
  let first = 0;
  let best = Infinity;
  pts.forEach((p, i) => {
    const d = Math.hypot(p.x - TREE.cx, p.y - 560);
    if (d < best) {
      best = d;
      first = i;
    }
  });
  const used = new Array(n).fill(false);
  let cur = first;
  for (let step = 0; step < n; step++) {
    used[cur] = true;
    chosen.push(cur);
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const d = Math.hypot(pts[i].x - pts[cur].x, pts[i].y - pts[cur].y);
      if (d < minD[i]) minD[i] = d;
    }
    let next = -1;
    let score = -1;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const s = minD[i] * (0.55 + 0.45 * edge[i]);
      if (s > score) {
        score = s;
        next = i;
      }
    }
    if (next < 0) break;
    cur = next;
  }
  return chosen.map((i) => pts[i]);
}

let cache: Slot[] | null = null;

/** All slots; `slot.i` is the stable index stored with each RSVP. */
export function getSlots(): Slot[] {
  if (cache) return cache;
  const pts = poisson(36, 20261211);
  // Index by fill order so slot 0 is the first ornament's spot, etc.
  cache = fillOrder(pts).map((p, i) => ({ i, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
  return cache;
}

export const SLOT_COUNT = () => getSlots().length;

/** First free slot in fill order. */
export function firstFreeSlot(taken: Set<number>): number | null {
  for (const s of getSlots()) if (!taken.has(s.i)) return s.i;
  return null;
}

/** Nearest free slot to a point (tree units), e.g. where a user dropped their ornament. */
export function nearestFreeSlot(x: number, y: number, taken: Set<number>): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const s of getSlots()) {
    if (taken.has(s.i)) continue;
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s.i;
    }
  }
  return best;
}
