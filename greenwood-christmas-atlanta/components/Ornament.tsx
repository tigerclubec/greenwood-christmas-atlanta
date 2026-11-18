import { memo } from "react";
import type { OrnamentColor, OrnamentPattern } from "@/lib/schema";

/**
 * Glass bauble, drawn in a 100 × 170 box:
 *   thread  y 0–40   ·  cap  y 38–60  ·  ball  center (50,112) r 50
 * All gradients & patterns live once in <OrnamentDefs/> so 180 ornaments stay cheap.
 */

export const ORN_VIEW_W = 100;
export const ORN_VIEW_H = 170;
export const ORN_BALL_CY = 112;

type Accent = "gold" | "red" | "white";
const ACCENTS: Record<Accent, string> = { gold: "#f6d27a", red: "#c4203b", white: "#ffffff" };

type Palette = { hi: string; base: string; deep: string; edge: string; accent: Accent; text: string; shadow: string; ribbon: string; ribbonDeep: string };

export const PALETTES: Record<OrnamentColor, Palette> = {
  cranberry: { hi: "#ff8597", base: "#c8223e", deep: "#7d0d22", edge: "#3a030f", accent: "gold", text: "#ffe7ad", shadow: "#3a030f", ribbon: "#f6d27a", ribbonDeep: "#b48a32" },
  gold: { hi: "#fff5cf", base: "#e4b95b", deep: "#a3762a", edge: "#563a0e", accent: "red", text: "#8a1020", shadow: "#fff5cf", ribbon: "#d42a40", ribbonDeep: "#7d0d22" },
  green: { hi: "#a3ecbf", base: "#2fae62", deep: "#15723f", edge: "#053a1f", accent: "white", text: "#ffffff", shadow: "#053a1f", ribbon: "#d42a40", ribbonDeep: "#7d0d22" },
  frost: { hi: "#ffffff", base: "#f5f3ee", deep: "#d5d6cf", edge: "#8c938d", accent: "red", text: "#b3182f", shadow: "#ffffff", ribbon: "#d42a40", ribbonDeep: "#7d0d22" },
  teal: { hi: "#74d4bf", base: "#13786a", deep: "#0a4a3f", edge: "#03241e", accent: "gold", text: "#ffe7ad", shadow: "#03241e", ribbon: "#d42a40", ribbonDeep: "#7d0d22" },
  midnight: { hi: "#8aa4dc", base: "#24396d", deep: "#13213f", edge: "#060c1a", accent: "gold", text: "#ffe7ad", shadow: "#060c1a", ribbon: "#d42a40", ribbonDeep: "#7d0d22" },
};

/* little shapes reused by patterns */
const flake = (cx: number, cy: number, r: number) =>
  Array.from({ length: 3 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    return `M${cx - dx} ${cy - dy}L${cx + dx} ${cy + dy}`;
  }).join("");
const star = (cx: number, cy: number, R: number) =>
  Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? R * 0.45 : R;
    return `${k ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  }).join("") + "Z";

function PatternDefs({ accent }: { accent: Accent }) {
  const c = ACCENTS[accent];
  return (
    <>
      <pattern id={`orn-pat-stripes-${accent}`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
        <rect width="6.5" height="16" fill={c} />
      </pattern>
      <pattern id={`orn-pat-dots-${accent}`} width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2.8" fill={c} />
        <circle cx="12" cy="12" r="2.8" fill={c} />
      </pattern>
      <pattern id={`orn-pat-snow-${accent}`} width="26" height="26" patternUnits="userSpaceOnUse">
        <path d={flake(7, 7, 4.6) + flake(20, 19, 3.4)} stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="20" cy="5" r="1" fill={c} />
        <circle cx="6" cy="20" r="1" fill={c} />
      </pattern>
      <pattern id={`orn-pat-stars-${accent}`} width="22" height="22" patternUnits="userSpaceOnUse">
        <path d={star(6, 6, 4) + star(17, 16, 2.8)} fill={c} />
      </pattern>
      <pattern id={`orn-pat-zigzag-${accent}`} width="18" height="14" patternUnits="userSpaceOnUse">
        <path d="M-1 10 L4.5 3 L9 10 L13.5 3 L19 10" stroke={c} strokeWidth="2.6" fill="none" strokeLinejoin="round" />
      </pattern>
    </>
  );
}

export function OrnamentDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} focusable="false">
      <defs>
        {(Object.keys(PALETTES) as OrnamentColor[]).map((c) => {
          const p = PALETTES[c];
          return (
            <g key={c}>
              <radialGradient id={`orn-body-${c}`} cx="0.42" cy="0.38" r="0.68" fx="0.32" fy="0.26">
                <stop offset="0" stopColor={p.hi} />
                <stop offset="0.3" stopColor={p.base} />
                <stop offset="0.74" stopColor={p.deep} />
                <stop offset="1" stopColor={p.edge} />
              </radialGradient>
              <linearGradient id={`orn-ribbon-${c}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={p.ribbon} />
                <stop offset="1" stopColor={p.ribbonDeep} />
              </linearGradient>
            </g>
          );
        })}
        <PatternDefs accent="gold" />
        <PatternDefs accent="red" />
        <PatternDefs accent="white" />
        <clipPath id="orn-ball-clip" clipPathUnits="userSpaceOnUse">
          <circle cx="50" cy="112" r="50" />
        </clipPath>
        <radialGradient id="orn-pattern-fade" cx="0.4" cy="0.36" r="0.66">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <radialGradient id="orn-rim" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.74" stopColor="#000" stopOpacity="0" />
          <stop offset="0.94" stopColor="#000" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
        <radialGradient id="orn-hl" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="orn-bounce" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orn-cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5a26" />
          <stop offset="0.22" stopColor="#dcbd78" />
          <stop offset="0.38" stopColor="#fff3cf" />
          <stop offset="0.55" stopColor="#c9a45f" />
          <stop offset="0.8" stopColor="#8a6a32" />
          <stop offset="1" stopColor="#5e4520" />
        </linearGradient>
        <linearGradient id="orn-cap-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6da" />
          <stop offset="1" stopColor="#b8954f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type Props = {
  color: OrnamentColor;
  pattern?: OrnamentPattern;
  name?: string;
  /** "full" adds a name band + glitter trims (big preview); "tree" is the compact version */
  detail?: "tree" | "full";
  thread?: boolean;
  className?: string;
  title?: string;
  /** soft cast shadow drawn in-SVG (cheaper than a CSS filter on many ornaments) */
  shadow?: boolean;
  /** hide pin-point glints (when the ornament is being used as a form) */
  plain?: boolean;
  /** fade the pattern so text on top stays readable */
  dimPattern?: boolean;
};

function nameSize(name: string) {
  const n = Math.max(3, name.length);
  return Math.min(30, 84 / (n * 0.46));
}

export const Ornament = memo(function Ornament({ color, pattern = "plain", name, detail = "tree", thread = true, className, title, shadow, plain, dimPattern }: Props) {
  if (!PALETTES[color]) color = "cranberry";
  const p = PALETTES[color];
  const full = detail === "full";
  const accent = ACCENTS[p.accent];
  const vbY = thread ? 0 : 30;
  const fs = name ? nameSize(name) : 0;
  const hasPattern = pattern !== "plain";
  return (
    <svg
      viewBox={`0 ${vbY} ${ORN_VIEW_W} ${ORN_VIEW_H - vbY}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      overflow="visible"
    >
      {thread && <path d="M50 0 C 49 12, 51 22, 50 31" stroke="#c9a45f" strokeWidth={full ? 1 : 2.4} fill="none" opacity="0.9" />}
      <ellipse cx="50" cy="35" rx="4.4" ry="5" fill="none" stroke="url(#orn-cap)" strokeWidth="2.2" />
      {shadow && <circle cx="56" cy={ORN_BALL_CY + 7} r="50" fill="#000" opacity="0.3" />}

      {/* glass */}
      <circle cx="50" cy={ORN_BALL_CY} r="50" fill={`url(#orn-body-${color})`} />

      {/* the guest's design */}
      {hasPattern && (
        <g clipPath="url(#orn-ball-clip)">
          <rect x="0" y="62" width="100" height="100" fill={`url(#orn-pat-${pattern}-${p.accent})`} opacity={dimPattern ? 0.42 : 0.9} />
          <circle cx="50" cy={ORN_BALL_CY} r="50" fill="url(#orn-pattern-fade)" />
        </g>
      )}

      {/* name band */}
      {name && (
        <g clipPath="url(#orn-ball-clip)">
          {hasPattern && <rect x="0" y={ORN_BALL_CY - fs * 0.72} width="100" height={fs * 1.3} fill={p.base} opacity="0.94" />}
          <path d={`M0 ${ORN_BALL_CY - fs * 0.74} H100 M0 ${ORN_BALL_CY + fs * 0.6} H100`} stroke={accent} strokeWidth={full ? 1.1 : 1.6} opacity="0.95" />
        </g>
      )}
      {name && (
        <g fontFamily="'Instrument Serif', Georgia, serif" fontStyle="italic" fontSize={fs} textAnchor="middle">
          <text x="50.6" y={ORN_BALL_CY + fs * 0.28 + 0.9} fill={p.shadow} opacity={color === "frost" || color === "gold" ? 0.8 : 0.5}>
            {name}
          </text>
          <text x="50" y={ORN_BALL_CY + fs * 0.28} fill={p.text}>
            {name}
          </text>
        </g>
      )}

      {/* depth + glass reflections */}
      <circle cx="50" cy={ORN_BALL_CY} r="50" fill="url(#orn-rim)" />
      <ellipse cx="70" cy="146" rx="22" ry="11" transform="rotate(-38 70 146)" fill="url(#orn-bounce)" />
      <path d="M14 96 C 20 76, 36 66, 54 66 C 40 71, 26 82, 20 100 Z" fill="#fff" opacity={color === "frost" ? 0.75 : 0.4} />
      <ellipse cx="33" cy="87" rx="15" ry="9" transform="rotate(-38 33 87)" fill="url(#orn-hl)" opacity={plain ? 0.45 : 1} />
      {!plain && <circle cx="29" cy="83" r="3.6" fill="#fff" />}
      {!plain && <circle cx="38.5" cy="78.5" r="1.4" fill="#fff" opacity="0.85" />}
      <path d="M12 124 C 14 138, 22 150, 34 157" stroke="#fff" strokeWidth="2.2" fill="none" opacity="0.18" strokeLinecap="round" />

      {/* glitter trim: dotted gold borders top and bottom */}
      <path d="M90.8 131 A45 45 0 0 1 9.2 131" fill="none" stroke={accent} strokeWidth="1.9" strokeLinecap="round" strokeDasharray="0.01 3.4" opacity="0.95" />
      <path d="M85.5 136 A40 40 0 0 1 14.5 136" fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" strokeDasharray="0.01 2.6" opacity="0.55" />
      <path d="M17 81 A45 45 0 0 1 83 81" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0.01 3.2" opacity="0.7" />
      {/* faint right-side reflection for extra glassiness */}
      <path d="M93 95 C 99 108, 98 128, 88 144" stroke="#fff" strokeWidth="1.6" fill="none" opacity="0.22" strokeLinecap="round" />

      {/* gold finial at the bottom */}
      <path d="M45.5 159.5 Q50 175 54.5 159.5 Q50 162.5 45.5 159.5Z" fill="url(#orn-cap)" />
      <circle cx="50" cy="168.5" r="1.1" fill="#fff3cf" opacity="0.9" />

      {/* ornate gold crown cap */}
      <ellipse cx="50" cy="64.5" rx="16" ry="3.6" fill="#000" opacity="0.2" />
      <path
        d="M37 46 H63 V57.5 a2.1667 2.6 0 0 1 -4.3333 0 a2.1667 2.6 0 0 1 -4.3333 0 a2.1667 2.6 0 0 1 -4.3333 0 a2.1667 2.6 0 0 1 -4.3333 0 a2.1667 2.6 0 0 1 -4.3333 0 a2.1667 2.6 0 0 1 -4.3333 0 Z"
        fill="url(#orn-cap)"
      />
      {[41.33, 45.67, 50, 54.33, 58.67].map((x) => (
        <line key={x} x1={x} y1="49.5" x2={x} y2="57.5" stroke="#5e4520" strokeWidth="0.6" opacity="0.45" />
      ))}
      <path d="M37 49.2 h26" stroke="#fff3cf" strokeWidth="0.7" opacity="0.7" />
      {[39.17, 43.5, 47.83, 52.17, 56.5, 60.83].map((x) => (
        <circle key={x} cx={x} cy="59.2" r="0.7" fill="#fff3cf" opacity="0.9" />
      ))}
      <rect x="40.5" y="42" width="19" height="4.6" rx="1.6" fill="url(#orn-cap-top)" />
      <rect x="42" y="42.6" width="6.5" height="1.1" rx="0.55" fill="#fff" opacity="0.8" />

      {/* velvet bow on top */}
      <g transform="translate(50 43) scale(0.8)">
        <path d="M0 0 C -6 -7, -15 -6, -13 0 C -12 5, -5 3, 0 0 Z" fill={`url(#orn-ribbon-${color})`} />
        <path d="M0 0 C 6 -7, 15 -6, 13 0 C 12 5, 5 3, 0 0 Z" fill={`url(#orn-ribbon-${color})`} />
        <path d="M-1 1 C -4 6, -6 10, -9 14 L -5.5 13.5 L -4 16.5 C -2 11, -0.5 6, 1 1 Z" fill={p.ribbonDeep} />
        <path d="M1 1 C 4 6, 6 10, 9 14 L 5.5 13.5 L 4 16.5 C 2 11, 0.5 6, -1 1 Z" fill={p.ribbon} />
        <ellipse cx="0" cy="0.3" rx="2.6" ry="2.3" fill={p.ribbon} />
        <path d="M-10 -2.5 C -8 -4.5, -5 -4.5, -3 -2" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" fill="none" />
      </g>
    </svg>
  );
});
