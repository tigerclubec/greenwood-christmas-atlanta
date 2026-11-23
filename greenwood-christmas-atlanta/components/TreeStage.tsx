"use client";

import { memo, useCallback, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { TREE, getSlots } from "@/lib/slots";
import { mulberry32 } from "@/lib/rand";
import { Ornament, ORN_BALL_CY, ORN_VIEW_H, ORN_VIEW_W } from "./Ornament";
import { TreeArt, Lights, StarFx } from "./TreeArt";
import type { OrnamentColor, OrnamentPattern } from "@/lib/schema";

export type TreeOrnament = { id: string; firstName: string; color: OrnamentColor; pattern: OrnamentPattern; slot: number };

export type TreeStageHandle = {
  /** client-space center + width of the ball for a slot */
  ballTarget(slot: number): { cx: number; cy: number; w: number } | null;
  /** convert client coords → tree units; `inside` if on the tree area */
  toTree(clientX: number, clientY: number): { x: number; y: number; inside: boolean };
  el(): HTMLDivElement | null;
};

const W = TREE.ornamentSize; // ball diameter in tree units (== element width)
const H = (W * ORN_VIEW_H) / ORN_VIEW_W;
const BALL_OFFSET = (W * ORN_BALL_CY) / ORN_VIEW_W;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

function swayFor(slot: number) {
  const r = mulberry32(slot * 9301 + 49297);
  return { dur: 4 + r() * 3.5, delay: -r() * 6, amp: 1.2 + r() * 1.8 };
}

type Props = {
  ornaments: TreeOrnament[];
  festive: number;
  myId?: string | null;
  highlightId?: string | null;
  landedId?: string | null;
  burst: { x: number; y: number; id: number } | null;
  hiddenId?: string | null; // e.g. while flying in
  ghostSlot?: number | null; // drop-target preview while dragging
  ref?: Ref<TreeStageHandle>;
  label: string;
};

export function TreeStage({ ornaments, festive, myId, highlightId, landedId, burst, hiddenId, ghostSlot, ref, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const slots = getSlots();
  const reduce = useReducedMotion();

  useImperativeHandle(ref, () => ({
    ballTarget(slot) {
      const el = box.current;
      const s = slots[slot];
      if (!el || !s) return null;
      const r = el.getBoundingClientRect();
      const k = r.width / TREE.width;
      return { cx: r.left + s.x * k, cy: r.top + s.y * k, w: W * k };
    },
    toTree(clientX, clientY) {
      const el = box.current;
      if (!el) return { x: 0, y: 0, inside: false };
      const r = el.getBoundingClientRect();
      const k = TREE.width / r.width;
      const x = (clientX - r.left) * k;
      const y = (clientY - r.top) * k;
      const t = (y - TREE.apexY) / (TREE.baseY - TREE.apexY);
      const inside = y > TREE.apexY + 40 && y < TREE.baseY + 30 && Math.abs(x - TREE.cx) < t * TREE.baseHalfWidth + 40;
      return { x, y, inside };
    },
    el: () => box.current,
  }));

  // reading order for keyboard navigation
  const ordered = useMemo(
    () => [...ornaments].sort((a, b) => slots[a.slot].y - slots[b.slot].y || slots[a.slot].x - slots[b.slot].x),
    [ornaments, slots],
  );

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (!ordered.length) return;
      let i = focusIdx;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") i = Math.min(ordered.length - 1, i + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") i = Math.max(0, i - 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = ordered.length - 1;
      else if (e.key === "Escape") return setTip(null);
      else return;
      e.preventDefault();
      setFocusIdx(i);
      const btn = box.current?.querySelector<HTMLButtonElement>(`[data-orn="${ordered[i].id}"]`);
      btn?.focus();
    },
    [focusIdx, ordered],
  );

  const tipOrn = ornaments.find((o) => o.id === (tip ?? highlightId));

  return (
    <div
      ref={box}
      className="relative isolate mx-auto w-full select-none"
      style={{ aspectRatio: `${TREE.width} / ${TREE.height}` }}
      onPointerLeave={() => setTip(null)}
    >
      <StarFx festive={festive} />
      <TreeArt festive={festive} />
      <Lights festive={festive} burst={burst} />

      <div role="group" aria-label={label} className="absolute inset-0" onKeyDown={onKey}>
        {ordered.map((o, i) => (
          <TreeOrnamentView
            key={o.id}
            o={o}
            tabIndex={i === Math.min(focusIdx, ordered.length - 1) ? 0 : -1}
            mine={o.id === myId}
            highlighted={o.id === highlightId}
            landed={o.id === landedId}
            hidden={o.id === hiddenId}
            reduce={!!reduce}
            onTip={setTip}
            onFocusIdx={() => setFocusIdx(i)}
            active={tip === o.id}
          />
        ))}
      </div>

      <AnimatePresence>
        {ghostSlot !== null && ghostSlot !== undefined && slots[ghostSlot] && (
          <motion.span
            key="ghost"
            aria-hidden
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1, left: pct(slots[ghostSlot].x, TREE.width), top: pct(slots[ghostSlot].y, TREE.height) }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-none absolute z-[1500] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-frost"
            style={{ width: pct(W * 1.25, TREE.width), aspectRatio: "1", boxShadow: "0 0 18px 6px rgba(255,228,160,0.55), inset 0 0 10px rgba(255,240,200,0.6)" }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tipOrn && !(tipOrn.id === hiddenId) && (
          <NameTip key={tipOrn.id} o={tipOrn} mine={tipOrn.id === myId} />
        )}
      </AnimatePresence>

      <AnimatePresence>{burst && !reduce && <Sparkles key={burst.id} x={burst.x} y={burst.y} />}</AnimatePresence>
    </div>
  );
}

const TreeOrnamentView = memo(function TreeOrnamentView({
  o,
  tabIndex,
  mine,
  highlighted,
  landed,
  hidden,
  reduce,
  onTip,
  onFocusIdx,
  active,
}: {
  o: TreeOrnament;
  tabIndex: number;
  mine: boolean;
  highlighted: boolean;
  landed: boolean;
  hidden: boolean;
  reduce: boolean;
  onTip: (id: string | null) => void;
  onFocusIdx: () => void;
  active: boolean;
}) {
  const s = getSlots()[o.slot];
  const sw = swayFor(o.slot);
  return (
    <button
      type="button"
      data-orn={o.id}
      tabIndex={tabIndex}
      aria-label={`${o.firstName}'s ornament${mine ? " (yours)" : ""}`}
      aria-pressed={active}
      onPointerEnter={(e) => e.pointerType === "mouse" && onTip(o.id)}
      onFocus={() => {
        onFocusIdx();
        onTip(o.id);
      }}
      onBlur={() => onTip(null)}
      onClick={() => onTip(active ? null : o.id)}
      className="absolute rounded-full focus-visible:outline-none"
      style={{
        left: pct(s.x - W / 2, TREE.width),
        top: pct(s.y - BALL_OFFSET, TREE.height),
        width: pct(W, TREE.width),
        height: pct(H, TREE.height),
        zIndex: Math.round(s.y),
        visibility: hidden ? "hidden" : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <motion.span
        className="block h-full w-full"
        style={{ transformOrigin: "50% 0%" }}
        initial={landed && !reduce ? { rotate: 24 } : false}
        animate={landed && !reduce ? { rotate: [24, -16, 10, -6, 3.5, -1.5, 0] } : undefined}
        transition={{ duration: 2.6, ease: "easeOut" }}
      >
        <span
          className="ornament-sway block h-full w-full will-change-transform"
          style={{ ["--dur" as string]: `${sw.dur}s`, ["--delay" as string]: `${sw.delay}s`, ["--amp" as string]: `${sw.amp}deg` }}
        >
          <Ornament color={o.color} pattern={o.pattern} name={o.firstName} shadow className="h-full w-full" />
        </span>
      </motion.span>
      {(highlighted || mine) && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ top: `${(ORN_BALL_CY / ORN_VIEW_H) * 100}%`, width: "150%", aspectRatio: "1" }}
        >
          {highlighted && <span className="find-ring absolute inset-0 rounded-full border-2 border-frost" />}
          {mine && !highlighted && (
            <span className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 14px 4px rgba(255,214,120,0.75)" }} />
          )}
        </span>
      )}
      {/* outline for keyboard focus */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-teal ring-offset-2 ring-offset-ivory [button:focus-visible>&]:block"
        style={{ top: `${(ORN_BALL_CY / ORN_VIEW_H) * 100}%`, width: "115%", aspectRatio: "1" }}
      />
    </button>
  );
});

function NameTip({ o, mine }: { o: TreeOrnament; mine: boolean }) {
  const s = getSlots()[o.slot];
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="pointer-events-none absolute z-[2000] -translate-x-1/2 -translate-y-full"
      style={{ left: pct(s.x, TREE.width), top: pct(s.y - BALL_OFFSET - 4, TREE.height) }}
    >
      <div className="relative whitespace-nowrap rounded-full bg-[#fbf6ec] px-3.5 py-1 text-center shadow-[0_8px_24px_-8px_rgba(60,40,10,0.45)] backdrop-blur">
        <span className="font-serif text-xl italic leading-none text-[#2a0a10]">{o.firstName}</span>
        {mine && <span className="ml-1.5 align-middle text-[11px] font-medium uppercase tracking-wider text-[#8a6a32]">you</span>}
        <span className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-[#fbf6ec]" />
      </div>
    </motion.div>
  );
}

/** A soft flash of light where a new ornament lands. */
function Sparkles({ x, y }: { x: number; y: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute z-[1900]"
      style={{ left: pct(x, TREE.width), top: pct(y, TREE.height) }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute -left-10 -top-10 h-20 w-20 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,240,200,0.95), rgba(255,220,150,0.35) 40%, transparent 70%)" }}
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
    </motion.div>
  );
}
