import { memo, useMemo } from "react";
import { TREE } from "@/lib/slots";
import { mulberry32 } from "@/lib/rand";

/* ───────────────────────────── geometry ───────────────────────────── */

const CX = TREE.cx;
const sil = (y: number) => ((y - TREE.apexY) / (TREE.baseY - TREE.apexY)) * TREE.baseHalfWidth;

const TIERS = [
  { top: 168, bottom: 296 },
  { top: 236, bottom: 404 },
  { top: 336, bottom: 520 },
  { top: 446, bottom: 642 },
  { top: 566, bottom: 766 },
  { top: 690, bottom: 888 },
  { top: 806, bottom: 1000 },
].map((t, i, arr) => {
  const hwB = sil(t.bottom) + 24;
  const hwT = i === 0 ? 0 : (sil(arr[i - 1].bottom) + 24) * 0.5;
  return { ...t, hwB, hwT, sag: 10 + i * 2.2 };
});

type Tier = (typeof TIERS)[number];

/** y of the scalloped bottom edge baseline at horizontal offset dx */
const edgeY = (t: Tier, dx: number) => t.bottom + t.sag * (1 - (dx / t.hwB) ** 2) - 6;

function tierPath(t: Tier, seed: number) {
  const r = mulberry32(seed);
  const h = t.bottom - t.top;
  const lobes = Math.max(3, Math.round((t.hwB * 2) / 56));
  const seg = (t.hwB * 2) / lobes;
  const lx = CX - t.hwB;
  let d = t.hwT === 0 ? `M${CX} ${t.top}` : `M${CX - t.hwT} ${t.top}`;
  // left flank — gently concave, flaring at the skirt
  d += ` Q${CX - t.hwT - (t.hwB - t.hwT) * 0.42} ${t.top + h * 0.78} ${lx} ${edgeY(t, -t.hwB)}`;
  // scalloped lower edge, lobes hang slightly
  for (let j = 0; j < lobes; j++) {
    const x0 = lx + j * seg;
    const x1 = x0 + seg;
    const y0 = edgeY(t, x0 - CX);
    const y1 = edgeY(t, x1 - CX);
    const depth = 15 + r() * 7 + (1 - Math.abs((x0 + seg / 2 - CX) / t.hwB)) * 4;
    d += ` C${x0 + seg * 0.08} ${y0 + depth} ${x1 - seg * 0.08} ${y1 + depth} ${x1} ${y1}`;
  }
  d += ` Q${CX + t.hwT + (t.hwB - t.hwT) * 0.42} ${t.top + h * 0.78} ${CX + t.hwT} ${t.top}`;
  d += " Z";
  return { d, lobes, seg };
}

/** Fir needle texture, merged into a handful of long paths for speed. */
function needles(t: Tier, ti: number) {
  const r = mulberry32(1000 + ti * 77);
  const buckets = { dark: "", mid: "", light: "", glint: "" };
  const tuft = (x: number, y: number, ang: number, len: number, kind: keyof typeof buckets, n = 3) => {
    // a little fringe of near-parallel needles hanging from a short twig
    const px = -Math.sin(ang);
    const py = Math.cos(ang);
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * 3.2 + (r() - 0.5) * 1.6;
      const sx = x + px * o;
      const sy = y + py * o;
      const a = ang + o * 0.035 + (r() - 0.5) * 0.18;
      const L = len * (0.7 + r() * 0.45);
      const ex = sx + Math.cos(a) * L;
      const ey = sy + Math.sin(a) * L;
      const bend = (r() - 0.5) * 0.5;
      const mx = sx + Math.cos(a + bend) * L * 0.5;
      const my = sy + Math.sin(a + bend) * L * 0.5;
      buckets[kind] += `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
  };
  const h = t.bottom - t.top;
  const halfAt = (y: number) => {
    const u = (y - t.top) / h;
    // approximate the concave flank
    return t.hwT + (t.hwB - t.hwT) * (u * u * 0.55 + u * 0.45);
  };

  // interior rows
  const rowGap = 21;
  for (let y = t.top + (ti === 0 ? 34 : 26); y < t.bottom + t.sag - 4; y += rowGap) {
    const hw = halfAt(Math.min(y, t.bottom)) - 10;
    const step = 25;
    const off = (Math.round(y / rowGap) % 2) * (step / 2);
    for (let x = CX - hw + off; x <= CX + hw; x += step) {
      const jx = x + (r() - 0.5) * 14;
      const jy = y + (r() - 0.5) * 10;
      const side = (jx - CX) / Math.max(1, t.hwB);
      if (jy > edgeY(t, jx - CX) + 6) continue;
      const ang = Math.PI / 2 + side * 0.75 + (r() - 0.5) * 0.5;
      const depthInTier = (jy - t.top) / h;
      const lit = side < -0.15 ? 0.65 : side > 0.35 ? 0.15 : 0.4;
      const roll = r();
      const kind: keyof typeof buckets =
        depthInTier < 0.25 ? (roll < 0.7 ? "dark" : "mid") : roll < lit * 0.6 ? "light" : roll < 0.82 ? "mid" : "dark";
      tuft(jx, jy, ang, 13 + depthInTier * 5, kind);
      if (kind === "light" && r() < 0.18) tuft(jx + 2, jy + 3, ang, 7, "glint", 2);
    }
  }
  // lobe tips: bright, longer needles hanging off the edge
  const { lobes, seg } = tierPath(t, 0);
  for (let j = 0; j < lobes; j++) {
    const x0 = CX - t.hwB + j * seg;
    for (let k = 0; k < 4; k++) {
      const u = 0.18 + (k / 3) * 0.64;
      const x = x0 + seg * u;
      const y = edgeY(t, x - CX) + 10 + Math.sin(u * Math.PI) * 8;
      const side = (x - CX) / t.hwB;
      tuft(x, y - 6, Math.PI / 2 + side * 0.6 + (u - 0.5) * 0.7, 12, side < 0.3 ? "light" : "mid", 3);
    }
  }
  // flanks: irregular fringe so the silhouette stays soft
  for (let y = t.top + 14; y < t.bottom - 8; y += 6 + r() * 7) {
    const hw = halfAt(y) - 5;
    tuft(CX - hw, y, Math.PI * 0.74 + (r() - 0.5) * 0.35, 9 + r() * 7, r() < 0.7 ? "light" : "mid", 2);
    tuft(CX + hw, y + r() * 4, Math.PI * 0.26 + (r() - 0.5) * 0.35, 9 + r() * 7, r() < 0.75 ? "mid" : "dark", 2);
  }
  return buckets;
}

/** visible half-width of the tree at height y (max over tiers) */
function treeHalfWidthAt(y: number) {
  let best = 0;
  for (const t of TIERS) {
    if (y < t.top || y > t.bottom) continue;
    const u = (y - t.top) / (t.bottom - t.top);
    // quadratic flank from tierPath: P0=(hwT,top) C=(hwT+(hwB-hwT)*0.42, top+0.78h) P2=(hwB,bottom)
    // solve for parameter s on y, then x
    const cy = 0.78;
    // y(s) = 2(1-s)s*cy + s^2  → s^2 (1-2cy) + 2cy s - u = 0
    const A = 1 - 2 * cy;
    const B = 2 * cy;
    const sParam = Math.abs(A) < 1e-6 ? u / B : (-B + Math.sqrt(B * B + 4 * A * u)) / (2 * A);
    const cx = t.hwT + (t.hwB - t.hwT) * 0.42;
    const x = (1 - sParam) ** 2 * t.hwT + 2 * (1 - sParam) * sParam * cx + sParam ** 2 * t.hwB;
    best = Math.max(best, x);
  }
  return best;
}

/* ───────────────────────────── lights ───────────────────────────── */

export type Bulb = { x: number; y: number; color: string; dur: number; delay: number; lo: number; rank: number };

const SWAGS = [
  [262, 330, 34],
  [366, 452, 44],
  [478, 574, 52],
  [598, 700, 58],
  [722, 828, 62],
  [846, 958, 66],
] as const;

function swagPoint(i: number, t: number) {
  const [y1, y2, sag] = SWAGS[i];
  const x1 = CX - treeHalfWidthAt(y1) + 8;
  const x2 = CX + treeHalfWidthAt(y2) - 8;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  const x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2;
  const y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2;
  return { x, y, x1, y1, x2, y2, mx, my };
}

export const SWAG_PATHS = SWAGS.map((_, i) => {
  const p = swagPoint(i, 0);
  return `M${p.x1} ${p.y1} Q${p.mx} ${p.my} ${p.x2} ${p.y2}`;
});

export const BULBS: Bulb[] = (() => {
  const r = mulberry32(42);
  const out: Bulb[] = [];
  const colors = ["#ffe8b0", "#ffe8b0", "#ffd98a", "#fff3d6", "#ffb347", "#ff6b6b", "#ff8f6b", "#ffe8b0"];
  SWAGS.forEach((s, i) => {
    const len = Math.hypot(treeHalfWidthAt(s[0]) + treeHalfWidthAt(s[1]), s[1] - s[0]);
    const n = Math.round(len / 30);
    for (let k = 1; k < n; k++) {
      const p = swagPoint(i, k / n);
      out.push({
        x: p.x,
        y: p.y + 4,
        color: colors[Math.floor(r() * colors.length)],
        dur: 2.2 + r() * 2.8,
        delay: -r() * 5,
        lo: 0.35 + r() * 0.3,
        rank: r(),
      });
    }
  });
  return out;
})();

/* bead garlands, revealed as the party grows */
const BEADS = [
  [300, 250, 22],
  [430, 360, 30],
  [560, 470, 36],
  [690, 590, 42],
  [820, 712, 46],
].map(([y1, y2, sag], i) => {
  const x1 = CX - treeHalfWidthAt(y1) + 6;
  const x2 = CX + treeHalfWidthAt(y2) - 6;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  const pts: { x: number; y: number }[] = [];
  const n = Math.round((x2 - x1) / 9);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    pts.push({
      x: (1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2,
      y: (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2,
    });
  }
  return { pts, threshold: 0.12 + i * 0.17 };
});

/* ───────────────────────────── presents ───────────────────────────── */

// present wrap in Greenwood Star brand colours
const BOX = {
  cranberry: ["#c8223e", "#7d0d22"],
  emerald: ["#2fae62", "#15723f"], // Greenwood green
  gold: ["#e4b95b", "#a3762a"],
  pearl: ["#fbf8f2", "#d8d2c6"],
} as const;
const RIB = { gold: ["#f6d27a", "#b48a32"], cranberry: ["#d42a40", "#7d0d22"], pearl: ["#ffffff", "#d9cfc2"], emerald: ["#2fae62", "#15723f"] } as const;
type BoxC = keyof typeof BOX;
type RibC = keyof typeof RIB;

const PRESENTS: { x: number; b: number; w: number; h: number; c: BoxC; rb: RibC; pat?: "stripe" | "dot"; min: number }[] = [
  { x: 640, b: 1088, w: 146, h: 112, c: "emerald", rb: "gold", pat: "dot", min: 0 },
  { x: 372, b: 1092, w: 124, h: 94, c: "cranberry", rb: "gold", pat: "stripe", min: 0 },
  { x: 262, b: 1098, w: 92, h: 70, c: "pearl", rb: "cranberry", min: 0.15 },
  { x: 770, b: 1100, w: 100, h: 80, c: "cranberry", rb: "pearl", pat: "dot", min: 0.32 },
  { x: 508, b: 1124, w: 92, h: 68, c: "gold", rb: "cranberry", min: 0 },
  { x: 704, b: 1132, w: 74, h: 54, c: "pearl", rb: "emerald", pat: "stripe", min: 0.55 },
  { x: 312, b: 1134, w: 78, h: 58, c: "emerald", rb: "cranberry", min: 0.75 },
];

function Present({ p, i }: { p: (typeof PRESENTS)[number]; i: number }) {
  const x0 = p.x - p.w / 2;
  const y0 = p.b - p.h;
  const lidH = Math.max(14, p.h * 0.2);
  const rw = Math.max(9, p.w * 0.12);
  const [c1, c2] = BOX[p.c];
  const [r1, r2] = RIB[p.rb];
  const id = `pr${i}`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-box`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={c1} />
          <stop offset="0.6" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <linearGradient id={`${id}-rib`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={r1} />
          <stop offset="0.55" stopColor={r1} />
          <stop offset="1" stopColor={r2} />
        </linearGradient>
        {p.pat === "stripe" && (
          <pattern id={`${id}-pat`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="6" height="16" fill={p.c === "pearl" ? "#c8223e" : "#fff"} opacity={p.c === "pearl" ? 0.35 : 0.13} />
          </pattern>
        )}
        {p.pat === "dot" && (
          <pattern id={`${id}-pat`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="2.2" fill={p.c === "pearl" ? "#c8223e" : "#f6d27a"} opacity="0.55" />
            <circle cx="14" cy="14" r="2.2" fill={p.c === "pearl" ? "#c8223e" : "#f6d27a"} opacity="0.55" />
          </pattern>
        )}
      </defs>
      <ellipse cx={p.x + 6} cy={p.b + 2} rx={p.w * 0.6} ry={7} fill="#5b4630" opacity="0.18" filter="url(#soft6)" />
      <rect x={x0} y={y0 + 4} width={p.w} height={p.h - 4} rx="3" fill={`url(#${id}-box)`} />
      {p.pat && <rect x={x0} y={y0 + 4} width={p.w} height={p.h - 4} rx="3" fill={`url(#${id}-pat)`} />}
      {/* lid */}
      <rect x={x0 - 4} y={y0 - 2} width={p.w + 8} height={lidH} rx="3" fill={`url(#${id}-box)`} />
      <rect x={x0 - 4} y={y0 - 2} width={p.w + 8} height={lidH} rx="3" fill="#fff" opacity="0.12" />
      <rect x={x0} y={y0 - 2 + lidH} width={p.w} height="4" fill="#000" opacity="0.16" />
      {/* ribbon */}
      <rect x={p.x - rw / 2} y={y0 - 2} width={rw} height={p.h + 2} fill={`url(#${id}-rib)`} />
      <rect x={p.x - rw / 2 + 1.5} y={y0 - 2} width="1.6" height={p.h + 2} fill="#fff" opacity="0.4" />
      {/* bow */}
      <g transform={`translate(${p.x} ${y0 - 3})`}>
        <path d={`M0 0 C ${-p.w * 0.12} -${p.w * 0.22}, ${-p.w * 0.36} -${p.w * 0.14}, ${-p.w * 0.26} -2 C ${-p.w * 0.2} 4, -6 3, 0 0Z`} fill={r1} />
        <path d={`M0 0 C ${p.w * 0.12} -${p.w * 0.22}, ${p.w * 0.36} -${p.w * 0.14}, ${p.w * 0.26} -2 C ${p.w * 0.2} 4, 6 3, 0 0Z`} fill={r2} />
        <path d={`M0 0 C ${-p.w * 0.1} -${p.w * 0.16}, ${-p.w * 0.25} -${p.w * 0.11}, ${-p.w * 0.2} -3`} stroke={r2} strokeWidth="1.4" fill="none" opacity="0.6" />
        <path d={`M-2 2 C -8 10, -12 16, -16 22 L -10 21 L -8 27 C -5 18, -2 9, 2 2Z`} fill={r2} />
        <path d={`M2 2 C 8 10, 12 16, 16 22 L 10 21 L 8 27 C 5 18, 2 9, -2 2Z`} fill={r1} />
        <ellipse cx="0" cy="0" rx={Math.max(4, p.w * 0.05)} ry={Math.max(3.5, p.w * 0.042)} fill={r1} />
        <ellipse cx="-1.2" cy="-1.2" rx="1.8" ry="1.2" fill="#fff" opacity="0.5" />
      </g>
      {/* lit edge */}
      <rect x={x0} y={y0 + lidH} width="2.2" height={p.h - lidH - 2} fill="#fff" opacity="0.22" />
    </g>
  );
}

/* ───────────────────────────── star ───────────────────────────── */

function Star() {
  const cx = CX;
  const cy = 118;
  const R = 64;
  const ri = 27;
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? R : ri;
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, a };
  });
  const light = -Math.PI * 0.72; // upper-left
  const shade = (a: number) => {
    const v = 0.5 + 0.5 * Math.cos(a - light);
    const lerp = (x: number, y: number) => Math.round(x + (y - x) * v);
    return `rgb(${lerp(168, 255)},${lerp(124, 244)},${lerp(56, 206)})`;
  };
  const facets: { d: string; fill: string }[] = [];
  for (let k = 0; k < 10; k += 2) {
    const tip = pts[k];
    const l = pts[(k + 9) % 10];
    const rgt = pts[(k + 1) % 10];
    facets.push({ d: `M${cx} ${cy}L${l.x} ${l.y}L${tip.x} ${tip.y}Z`, fill: shade(tip.a - 0.5) });
    facets.push({ d: `M${cx} ${cy}L${tip.x} ${tip.y}L${rgt.x} ${rgt.y}Z`, fill: shade(tip.a + 0.5) });
  }
  const outline = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("") + "Z";
  return (
    <g>
      <path d={outline} fill="#a8823e" stroke="#b8914a" strokeWidth="6" strokeLinejoin="round" />
      {facets.map((f, i) => (
        <path key={i} d={f.d} fill={f.fill} stroke={f.fill} strokeWidth="0.6" strokeLinejoin="round" />
      ))}
      <path d={outline} fill="none" stroke="#fff6dc" strokeOpacity="0.7" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx={cx - 14} cy={cy - 16} r="5" fill="#fff" opacity="0.9" />
      <path d={`M${cx - 30} ${cy - 30} l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z`} fill="#fff" opacity="0.85" />
    </g>
  );
}

/* ───────────────────────────── the tree ───────────────────────────── */

export const TreeArt = memo(function TreeArt({ festive }: { festive: number }) {
  const tiers = useMemo(
    () =>
      TIERS.map((t, i) => ({
        t,
        path: tierPath(t, 7 + i * 13).d,
        n: needles(t, i),
      })),
    [],
  );

  const presents = PRESENTS.map((p, i) => ({ p, i })).filter(({ p }) => festive >= p.min);
  presents.sort((a, b) => a.p.b - b.p.b);

  return (
    <svg viewBox={`0 0 ${TREE.width} ${TREE.height}`} className="absolute inset-0 h-full w-full" overflow="visible" aria-hidden focusable="false">
      <defs>
        <radialGradient id="warmGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ff9a5a" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ff9a5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tierFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00301a" />
          <stop offset="0.45" stopColor="#004b28" />
          <stop offset="1" stopColor="#0c6840" />
        </linearGradient>
        <linearGradient id="tierLight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff1c8" stopOpacity="0.16" />
          <stop offset="0.38" stopColor="#fff1c8" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b4527" />
          <stop offset="0.5" stopColor="#4a2e19" />
          <stop offset="1" stopColor="#2e1c10" />
        </linearGradient>
        <radialGradient id="snowMound" cx="0.45" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f2f5ee" />
          <stop offset="1" stopColor="#e1e6da" />
        </radialGradient>
        <filter id="soft6" x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="tierShadow" x="-10%" y="-10%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* warm ambient glow behind the tree */}
      <ellipse cx={CX} cy={590} rx={470 + festive * 40} ry={560} fill="url(#warmGlow)" opacity={0.75 + festive * 0.25} />

      {/* snowy ground */}
      <ellipse cx={CX} cy={1108} rx={492} ry={74} fill="url(#snowMound)" />
      <ellipse cx={CX - 250} cy={1128} rx={170} ry={34} fill="#fff" opacity="0.8" />
      <ellipse cx={CX + 270} cy={1132} rx={150} ry={30} fill="#fff" opacity="0.7" />
      <ellipse cx={CX} cy={1052} rx={320} ry={26} fill="#3d2b17" opacity="0.2" filter="url(#soft6)" />

      {/* trunk */}
      <path d={`M${CX - 30} 960 L${CX - 34} 1052 Q${CX} 1062 ${CX + 34} 1052 L${CX + 30} 960 Z`} fill="url(#trunk)" />
      <path d={`M${CX - 18} 990 q2 30 -2 56 M${CX + 8} 984 q-3 34 2 66`} stroke="#2a190d" strokeWidth="2" fill="none" opacity="0.5" />

      {/* tiers, bottom first so each upper tier casts its shadow on the one below */}
      {[...tiers].reverse().map(({ t, path, n }, ri) => (
        <g key={ri}>
          <path d={path} fill="#001a0c" opacity="0.5" transform="translate(4 14)" filter="url(#tierShadow)" />
          <path d={path} fill="url(#tierFill)" />
          <g strokeLinecap="round" fill="none">
            <path d={n.dark} stroke="#00230f" strokeWidth="2.4" opacity="0.45" />
            <path d={n.mid} stroke="#11714a" strokeWidth="2.2" opacity="0.85" />
            <path d={n.light} stroke="#2fa35e" strokeWidth="2.1" opacity="0.8" />
            <path d={n.glint} stroke="#a8ecc0" strokeWidth="1.6" opacity="0.7" />
          </g>
          <path d={path} fill="url(#tierLight)" />
          {/* soft frost on the lobe tips */}
          <path d={path} fill="none" stroke="#f6fbf2" strokeOpacity="0.12" strokeWidth="2" transform="translate(0 -1)" />
        </g>
      ))}

      {/* gold bead garlands appear as more people join */}
      {BEADS.map((g, i) => (
        <g key={i} style={{ opacity: festive >= g.threshold ? 1 : 0, transition: "opacity 1.2s ease" }}>
          {g.pts.map((p, k) => (
            <circle key={k} cx={p.x} cy={p.y} r="2.6" fill={k % 2 ? "#f6d27a" : "#d42a40"} />
          ))}
          {g.pts.map((p, k) => (k % 3 === 0 ? <circle key={`h${k}`} cx={p.x - 0.8} cy={p.y - 0.9} r="0.9" fill="#fff" opacity="0.8" /> : null))}
        </g>
      ))}

      <Star />

      {/* presents */}
      {presents.map(({ p, i }) => (
        <Present key={i} p={p} i={i} />
      ))}
    </svg>
  );
});

export const STAR = { cx: CX, cy: 118 };

/** Star glow + slowly turning rays, on their own composited layer (never repaints the tree). */
export const StarFx = memo(function StarFx({ festive }: { festive: number }) {
  const size = 420 + festive * 80; // tree units
  const _rays = Array.from({ length: 0 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2;
    const L = k % 2 ? 150 : 200;
    const w = 0.05;
    return `M0 0L${Math.cos(a - w) * L} ${Math.sin(a - w) * L}L${Math.cos(a + w) * L} ${Math.sin(a + w) * L}Z`;
  }).join("");
  const box = {
    left: `${((STAR.cx - size / 2) / TREE.width) * 100}%`,
    top: `${((STAR.cy - size / 2) / TREE.height) * 100}%`,
    width: `${(size / TREE.width) * 100}%`,
    aspectRatio: "1",
  } as const;
  return (
    <div aria-hidden className="pointer-events-none absolute" style={box}>
      <div
        className="star-glow absolute inset-[12%] rounded-full will-change-transform"
        style={{
          opacity: 0.7 + festive * 0.3,
          background: "radial-gradient(closest-side, rgba(255,244,207,0.95), rgba(255,227,160,0.45) 35%, rgba(255,227,160,0) 100%)",
        }}
      />
    </div>
  );
});

/** Fairy lights: wires + bulbs are static SVG; the twinkling glows are tiny composited HTML layers. */
export const Lights = memo(function Lights({ festive, burst }: { festive: number; burst: { x: number; y: number; id: number } | null }) {
  const litRatio = 0.85 + festive * 0.15;
  const glow = 40 + festive * 12; // tree units
  return (
    <>
      <svg viewBox={`0 0 ${TREE.width} ${TREE.height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden focusable="false">
        {SWAG_PATHS.map((d, i) => (
          <path key={i} d={d} stroke="#16301f" strokeWidth="1.6" fill="none" opacity="0.7" />
        ))}
        {BULBS.map((b, i) => {
          const on = b.rank < litRatio;
          return (
            <g key={i}>
              <circle cx={b.x} cy={b.y - 3.4} r="1.7" fill="#2a3a25" />
              <ellipse cx={b.x} cy={b.y} rx="3.6" ry="4.6" fill={on ? b.color : "#cdbf9f"} opacity={on ? 1 : 0.55} />
              {on && <circle cx={b.x - 0.9} cy={b.y - 1.2} r="1.1" fill="#fff" />}
            </g>
          );
        })}
      </svg>
      <div aria-hidden className="pointer-events-none absolute inset-0" key={burst?.id ?? "none"}>
        {BULBS.map((b, i) => {
          if (b.rank >= litRatio) return null;
          const dist = burst ? Math.hypot(b.x - burst.x, b.y - burst.y) : Infinity;
          return (
            <span
              key={i}
              className={`bulb absolute rounded-full${dist < 230 ? " burst" : ""}`}
              style={{
                left: `${((b.x - glow / 2) / TREE.width) * 100}%`,
                top: `${((b.y - glow / 2) / TREE.height) * 100}%`,
                width: `${(glow / TREE.width) * 100}%`,
                aspectRatio: "1",
                ["--bdelay" as string]: `${(dist / 900).toFixed(2)}s`,
              }}
            >
              <span
                className="bulb-glow absolute inset-0 rounded-full will-change-[opacity]"
                style={{
                  background: `radial-gradient(closest-side, #fff8e6, ${b.color}cc 22%, ${b.color}44 50%, ${b.color}00 100%)`,
                  ["--dur" as string]: `${b.dur}s`,
                  ["--delay" as string]: `${b.delay}s`,
                  ["--lo" as string]: b.lo,
                }}
              />
            </span>
          );
        })}
      </div>
    </>
  );
});
