"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/** Gentle falling snow on a single canvas. Off for reduced-motion users. */
export function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // pre-render one soft flake; drawImage is far cheaper than shadowBlur per flake
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sc = sprite.getContext("2d")!;
    const g = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.95)");
    g.addColorStop(0.62, "rgba(170,150,120,0.28)");
    g.addColorStop(1, "rgba(170,150,120,0)");
    sc.fillStyle = g;
    sc.fillRect(0, 0, 32, 32);
    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    type F = { x: number; y: number; r: number; s: number; d: number; p: number };
    let flakes: F[] = [];
    const make = (y?: number): F => ({
      x: Math.random() * w,
      y: y ?? Math.random() * h,
      r: 0.6 + Math.random() * 1.6,
      s: 0.25 + Math.random() * 0.6,
      d: Math.random() * 0.6 - 0.3,
      p: Math.random() * Math.PI * 2,
    });
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(55, (w * h) / 24000));
      flakes = Array.from({ length: n }, () => make());
    };
    resize();
    window.addEventListener("resize", resize);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.p += 0.01 * dt;
        f.y += f.s * dt;
        f.x += (Math.sin(f.p) * 0.35 + f.d) * dt;
        if (f.y > h + 6) Object.assign(f, make(-6));
        if (f.x < -6) f.x = w + 6;
        if (f.x > w + 6) f.x = -6;
        const d = f.r * 3.2;
        ctx.drawImage(sprite, f.x - d / 2, f.y - d / 2, d, d);
      }
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduce]);

  if (reduce) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[5] h-full w-full" />;
}
