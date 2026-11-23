/** Small hand-drawn decorative pieces used around the page. */

export function HollySprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 54" className={className} aria-hidden>
      <defs>
        <linearGradient id="hl-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f8a5c" />
          <stop offset="1" stopColor="#15402a" />
        </linearGradient>
        <radialGradient id="hl-berry" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#f0788a" />
          <stop offset="0.45" stopColor="#b3223c" />
          <stop offset="1" stopColor="#5e0b1c" />
        </radialGradient>
      </defs>
      <path
        d="M58 30 C 46 18, 30 14, 10 18 C 16 20, 14 25, 19 26 C 17 29, 22 31, 24 30 C 25 34, 30 33, 32 32 C 36 36, 40 34, 42 33 C 47 36, 52 33, 58 30 Z"
        fill="url(#hl-leaf)"
      />
      <path d="M58 30 C 44 24, 30 21, 12 19" stroke="#0e2d1d" strokeWidth="0.9" fill="none" opacity="0.5" />
      <path
        d="M62 30 C 74 18, 90 14, 110 18 C 104 20, 106 25, 101 26 C 103 29, 98 31, 96 30 C 95 34, 90 33, 88 32 C 84 36, 80 34, 78 33 C 73 36, 68 33, 62 30 Z"
        fill="url(#hl-leaf)"
      />
      <path d="M62 30 C 76 24, 90 21, 108 19" stroke="#0e2d1d" strokeWidth="0.9" fill="none" opacity="0.5" />
      <circle cx="54" cy="34" r="7" fill="url(#hl-berry)" />
      <circle cx="66" cy="34" r="7" fill="url(#hl-berry)" />
      <circle cx="60" cy="25" r="7" fill="url(#hl-berry)" />
      <circle cx="52" cy="31.5" r="1.6" fill="#fff" opacity="0.8" />
      <circle cx="64" cy="31.5" r="1.6" fill="#fff" opacity="0.8" />
      <circle cx="58" cy="22.5" r="1.6" fill="#fff" opacity="0.8" />
    </svg>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M2 22 C 2 10, 10 2, 22 2" stroke="#83a29d" strokeWidth="1.2" fill="none" />
      <path d="M7 24 C 7 14, 14 7, 24 7" stroke="#83a29d" strokeWidth="0.7" fill="none" opacity="0.7" />
      <path d="M12 12 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6z" fill="#83a29d" transform="translate(-1 -1) scale(0.9)" />
    </svg>
  );
}

/** Ivory greeting-card shell with a fine gold double rule. */
export function CardFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-[28px] bg-paper p-6 shadow-[0_30px_80px_-30px_rgba(70,45,15,0.55),0_2px_0_rgba(255,255,255,0.8)_inset] sm:p-8 ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 50% 0%, rgba(255,247,226,0.9), transparent 60%), radial-gradient(80% 60% at 100% 100%, rgba(240,226,196,0.45), transparent 70%)",
      }}
    >
      <div className="pointer-events-none absolute inset-2.5 rounded-[22px] border border-sage/55" aria-hidden />
      <div className="pointer-events-none absolute inset-[14px] rounded-[19px] border border-sage/25" aria-hidden />
      <Corner className="pointer-events-none absolute left-4 top-4 h-8 w-8" />
      <Corner className="pointer-events-none absolute right-4 top-4 h-8 w-8 -scale-x-100" />
      <Corner className="pointer-events-none absolute bottom-4 left-4 h-8 w-8 -scale-y-100" />
      <Corner className="pointer-events-none absolute bottom-4 right-4 h-8 w-8 -scale-100" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function Flourish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 18" className={className} aria-hidden>
      <path d="M2 9 H88" stroke="#83a29d" strokeWidth="1" />
      <path d="M132 9 H218" stroke="#83a29d" strokeWidth="1" />
      <path d="M110 1 l2.6 5.4 5.4 2.6 -5.4 2.6 -2.6 5.4 -2.6 -5.4 -5.4 -2.6 5.4 -2.6z" fill="#83a29d" />
      <circle cx="96" cy="9" r="2" fill="#30b566" />
      <circle cx="124" cy="9" r="2" fill="#30b566" />
    </svg>
  );
}

export function TinyStar({ className }: { className?: string }) {
  return (
    <svg viewBox="-10 -10 20 20" className={className} aria-hidden>
      <path d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4Z" fill="currentColor" />
    </svg>
  );
}
