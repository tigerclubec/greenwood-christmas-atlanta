"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { events, getEvent, hasMultipleEvents, formatEventDate, party, type PartyEvent } from "@/config/party";
import { getSlots } from "@/lib/slots";
import { COLOR_LABELS, ORNAMENT_COLORS, ORNAMENT_PATTERNS, PATTERN_LABELS, firstNameOf, rsvpInputSchema, zodMessage, type OrnamentColor, type OrnamentPattern } from "@/lib/schema";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar";
import { TreeStage, type TreeOrnament, type TreeStageHandle } from "./TreeStage";
import { Ornament, ORN_BALL_CY, PALETTES } from "./Ornament";
import { Snow } from "./Snow";
import { api } from "@/lib/client-api";

/* ───────────────────────── types & helpers ───────────────────────── */

type OwnRsvp = {
  id: string;
  eventId: string;
  fullName: string;
  firstName: string;
  attending: boolean;
  guests: number;
  guestName: string;
  color: OrnamentColor;
  pattern?: OrnamentPattern;
  slot: number | null;
};

type Phase = "form" | "sealing" | "flying" | "done" | "declined";
type Pt = { cx: number; cy: number; w: number };
type Flight = { from: Pt; to: Pt; color: OrnamentColor; pattern: OrnamentPattern; name: string };
type Form = { fullName: string; eventId: string; attending: boolean | null; plusOne: boolean | null; guestName: string; color: OrnamentColor; pattern: OrnamentPattern };

const TOKEN_KEY = `gs-holiday-${party.year}-rsvp`;
const store = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, v);
    } catch {}
  },
};

/* friendlier words for validation */
const CUTE: Record<string, string> = {
  fullName: "Add your name.",
  guestName: "Add your guest’s name.",
  eventId: "Pick your office.",
  attending: "Are you going?",
};

/* per-colour palette for the inputs that live on the glass */
const glass = (ink: string, onInk: string, fill: number, strong: number, line: string, soft: string, glow: string) =>
  ({
    ["--o-ink" as string]: ink,
    ["--o-on-ink" as string]: onInk,
    ["--o-fill" as string]: `rgba(255,255,255,${fill})`,
    ["--o-fill-strong" as string]: `rgba(255,255,255,${strong})`,
    ["--o-line" as string]: line,
    ["--o-soft" as string]: soft,
    ["--o-glow" as string]: glow,
  }) as React.CSSProperties;

const GLASS: Record<OrnamentColor, React.CSSProperties> = {
  cranberry: glass("#fff6e4", "#b3182f", 0.2, 0.32, "rgba(255,231,173,.55)", "rgba(255,236,210,.82)", "rgba(255,231,173,.25)"),
  gold: glass("#7d0d22", "#fff6e4", 0.45, 0.65, "rgba(125,13,34,.35)", "rgba(125,13,34,.62)", "rgba(255,255,255,.4)"),
  green: glass("#ffffff", "#15723f", 0.2, 0.32, "rgba(255,255,255,.5)", "rgba(240,255,246,.85)", "rgba(255,255,255,.22)"),
  frost: glass("#b3182f", "#ffffff", 0.6, 0.85, "rgba(179,24,47,.3)", "rgba(179,24,47,.6)", "rgba(179,24,47,.14)"),
  teal: glass("#fff6e4", "#13786a", 0.18, 0.3, "rgba(255,231,173,.5)", "rgba(255,240,215,.8)", "rgba(255,231,173,.22)"),
  midnight: glass("#fff6e4", "#24396d", 0.18, 0.3, "rgba(255,231,173,.5)", "rgba(255,240,215,.8)", "rgba(255,231,173,.22)"),
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ───────────────────────── main ───────────────────────── */

export function Experience({ initialTrees, initialEventId }: { initialTrees: Record<string, TreeOrnament[]>; initialEventId: string }) {
  const reduce = useReducedMotion();
  const [eventId, setEventId] = useState(initialEventId);
  const [trees, setTrees] = useState(initialTrees);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<OwnRsvp | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [form, setForm] = useState<Form>({ fullName: "", eventId: hasMultipleEvents ? "" : events[0].id, attending: null, plusOne: null, guestName: "", color: "cranberry", pattern: "plain" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  const [treeShift, setTreeShift] = useState({ x: 0, y: 0 });
  // the tree starts just below the title so the star never sits behind text
  const headerRef = useRef<HTMLDivElement>(null);
  const [treeTop, setTreeTop] = useState(250);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setTreeTop(Math.round(r.bottom + window.scrollY + 110));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const stage = useRef<TreeStageHandle>(null);
  const baubleRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const flightDone = useRef<() => void>(() => {});

  const event = getEvent(eventId) ?? events[0];
  const ornaments = trees[eventId] ?? [];
  const festive = Math.min(1, ornaments.length / 120);

  const refresh = useCallback(async (id: string) => {
    const r = await api<{ ornaments: TreeOrnament[] }>(`/api/tree?event=${encodeURIComponent(id)}`);
    if (r.ok) setTrees((t) => ({ ...t, [id]: r.data.ornaments }));
  }, []);

  const fillFrom = (r: OwnRsvp) =>
    setForm({ fullName: r.fullName, eventId: r.eventId, attending: r.attending, plusOne: (r.guests ?? 0) > 0, guestName: r.guestName ?? "", color: (ORNAMENT_COLORS as readonly string[]).includes(r.color) ? r.color : "cranberry", pattern: r.pattern ?? "plain" });

  /* restore from edit link or this browser */
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromLink = url.searchParams.get("edit");
    if (fromLink) {
      store.set(fromLink);
      url.searchParams.delete("edit");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const t = fromLink ?? store.get();
    if (!t) return;
    api<{ rsvp: OwnRsvp }>("/api/rsvp", { token: t }).then((r) => {
      if (!r.ok) return;
      setToken(t);
      setMe(r.data.rsvp);
      fillFrom(r.data.rsvp);
      setEventId(r.data.rsvp.eventId);
      setPhase(fromLink ? "form" : r.data.rsvp.attending ? "done" : "declined");
    });
  }, []);

  /* keep the shared tree fresh */
  useEffect(() => {
    if (phase === "flying" || phase === "sealing") return;
    const id = setInterval(() => !document.hidden && refresh(eventId), 25000);
    const onFocus = () => refresh(eventId);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [eventId, phase, refresh]);

  useEffect(() => {
    if (!trees[eventId]) refresh(eventId);
  }, [eventId, trees, refresh]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setMessage(null);
    if (k === "eventId" && v) setEventId(v as string); // picking an office shows that office's tree
  };

  /* ───────── submit: save, then the ornament hangs itself ───────── */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || phase !== "form") return;
    const bringing = !!form.attending && !!form.plusOne;
    const payload = {
      fullName: form.fullName,
      eventId: form.eventId,
      attending: form.attending ?? undefined,
      guests: bringing ? 1 : 0,
      guestName: bringing ? form.guestName : "",
      color: form.color,
      pattern: form.pattern,
    };
    const check = rsvpInputSchema.safeParse(payload);
    if (!check.success) {
      const f = zodMessage(check.error);
      setErrors(f);
      const first = ["fullName", "eventId", "attending", "guestName"].find((k) => f[k]);
      setMessage(first ? CUTE[first] : Object.values(f)[0]);
      setShakeKey((k) => k + 1);
      return;
    }

    setSaving(true);
    setMessage(null);
    const editing = !!(token && me);
    const prev = me;
    const r = editing
      ? await api<{ rsvp: OwnRsvp }>("/api/rsvp", { method: "PUT", body: JSON.stringify(payload), token })
      : await api<{ rsvp: OwnRsvp; token: string }>("/api/rsvp", { method: "POST", body: JSON.stringify(payload) });
    setSaving(false);
    if (!r.ok) {
      setMessage(r.error);
      if (r.fields) setErrors(r.fields);
      setShakeKey((k) => k + 1);
      return;
    }

    const rsvp = r.data.rsvp;
    const newToken = (r.data as { token?: string }).token;
    if (newToken) {
      store.set(newToken);
      setToken(newToken);
    }
    setMe(rsvp);
    setEventId(rsvp.eventId);
    if (prev && prev.eventId !== rsvp.eventId) refresh(prev.eventId);

    if (!rsvp.attending) {
      refresh(rsvp.eventId);
      setPhase("declined");
      return;
    }
    // Already hanging in the same spot (e.g. just changed colour or +1) — no need to fly again.
    if (rsvp.slot === null || (prev?.slot === rsvp.slot && prev?.eventId === rsvp.eventId)) {
      await refresh(rsvp.eventId);
      setJustUpdated(!!prev);
      setPhase("done");
      return;
    }
    await flyToTree(rsvp);
  };

  const flyToTree = async (rsvp: OwnRsvp) => {
    const slot = rsvp.slot!;
    const s = getSlots()[slot];
    const mine: TreeOrnament = { id: rsvp.id, firstName: rsvp.firstName, color: rsvp.color, pattern: rsvp.pattern ?? "plain", slot };

    const land = () => {
      setFlight(null);
      setTrees((t) => ({ ...t, [rsvp.eventId]: [...(t[rsvp.eventId] ?? []).filter((o) => o.id !== mine.id), mine] }));
      setLandedId(mine.id);
      setHighlightId(mine.id);
      setTimeout(() => setHighlightId((h) => (h === mine.id ? null : h)), 7000);
      if (!reduce) setBurst({ x: s.x, y: s.y, id: Date.now() });
      setTimeout(() => setBurst(null), 2200);
      setTimeout(
        () => {
          setJustUpdated(false);
          setPhase("done");
        },
        reduce ? 0 : 1000,
      );
      refresh(rsvp.eventId);
    };

    if (reduce) return land();

    // 1. the name appears on the glass
    setPhase("sealing");
    await wait(800);

    // 2. fly from the big ornament into the tree. The close-up crops the tree,
    //    so if this branch is off-screen, nudge the tree until it's in view first.
    const box = baubleRef.current?.getBoundingClientRect();
    let to = stage.current?.ballTarget(slot);
    if (to) {
      const m = 70;
      const dx = to.cx < m ? m - to.cx : to.cx > window.innerWidth - m ? window.innerWidth - m - to.cx : 0;
      const dy = to.cy < m ? m - to.cy : to.cy > window.innerHeight - m ? window.innerHeight - m - to.cy : 0;
      if (dx || dy) {
        setTreeShift({ x: dx, y: dy });
        await wait(900);
        to = stage.current?.ballTarget(slot);
      }
    }
    if (!box || !to) return land();
    // bauble box uses the thread-less ornament viewBox (y 30 → 170)
    const from = { cx: box.left + box.width / 2, cy: box.top + ((ORN_BALL_CY - 30) / 140) * box.height, w: box.width };
    flightDone.current = land;
    setFlight({ from, to, color: rsvp.color, pattern: rsvp.pattern ?? "plain", name: rsvp.firstName });
    setPhase("flying");
  };

  useEffect(() => {
    if (phase === "done" || phase === "declined") {
      setCardOpen(true);
      setTreeShift({ x: 0, y: 0 });
    }
  }, [phase]);

  const edit = () => {
    if (me) fillFrom(me);
    setErrors({});
    setMessage(null);
    setPhase("form");
  };

  const findMine = () => {
    if (!me || me.slot === null) return;
    if (eventId !== me.eventId) setEventId(me.eventId);
    setHighlightId(me.id);
  };

  const editLink = token && typeof window !== "undefined" ? `${window.location.origin}/?edit=${token}` : "";
  const name = firstNameOf(form.fullName);
  const showForm = phase === "form" || phase === "sealing" || phase === "flying";

  const treeLit = phase === "done" || phase === "declined" || phase === "flying";

  return (
    <MotionConfig reducedMotion="user">
      {/* ───── the tree, always in the background ───── */}
      <div className="fixed inset-0 z-0 flex justify-center overflow-hidden">
        <div
          className={`tree-wrap ${phase === "done" || phase === "declined" ? "revealed" : ""}`}
          style={{ top: treeTop, ["--sx" as string]: `${treeShift.x}px`, ["--sy" as string]: `${treeShift.y}px` }}
        >
          <TreeStage
            ref={stage}
            ornaments={ornaments}
            festive={festive}
            myId={me?.id}
            highlightId={highlightId}
            landedId={landedId}
            burst={burst}
            label={`Ornaments on the ${event.office} tree. Use arrow keys to move between them.`}
          />
        </div>
      </div>
      {/* darkens the middle of the tree while the form is up, then lifts to reveal it */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] transition-opacity duration-[1200ms] lg:[--vx:64%]"
        style={{
          opacity: treeLit ? 0 : 1,
          background: "radial-gradient(ellipse 34% 55% at var(--vx, 50%) 55%, rgba(40,2,10,0.55), rgba(40,2,10,0.2) 60%, rgba(40,2,10,0) 100%)",
        }}
      />
      <Snow />

      {/* ───── foreground ───── */}
      <main className={`pointer-events-none relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center px-5 pb-0 pt-[max(0.75rem,env(safe-area-inset-top))] lg:max-w-none ${showForm ? "lg:flex lg:h-dvh lg:min-h-0 lg:w-full lg:flex-col lg:items-center lg:justify-center lg:px-6 lg:py-4" : "lg:pt-5"} [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_img]:pointer-events-auto`}>
        <div ref={headerRef} className="flex w-full flex-col items-center">
        <img src="/greenwood-star-logo-white.png" alt={party.companyName} width={900} height={160} className="h-5 w-auto sm:h-7" />

        <AnimatePresence>
          {showForm && (
            <motion.div
              key="title"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="w-full"
            >
              <Header event={event} />
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.form
              key="form"
              onSubmit={submit}
              noValidate
              aria-label="RSVP"
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex w-full flex-col items-center lg:flex-row lg:justify-center lg:gap-10"
            >
              <div className="relative order-1 lg:order-2">
              <Bauble
                refEl={baubleRef}
                form={form}
                set={set}
                errors={errors}
                sealed={phase !== "form"}
                hidden={phase === "flying"}
                name={name}
                shakeKey={shakeKey}
                paused={focused}
                onFocusChange={setFocused}
              />
              </div>
              {form.attending !== false && (
                <>
                  <div className="order-2 mt-2 lg:hidden">
                    <Designer form={form} set={set} />
                  </div>
                  <div className="order-1 hidden lg:flex lg:self-center">
                    <Designer form={form} set={set} vertical />
                  </div>
                </>
              )}
              <Controls
                form={form}
                set={set}
                saving={saving}
                busy={phase !== "form"}
                message={message}
                editing={!!me}
                onCancel={me ? () => setPhase(me.attending ? "done" : "declined") : undefined}
              />
            </motion.form>
          )}
        </AnimatePresence>

        {false && (
          <div className="mt-6 lg:hidden">
            <TreeFooter ornaments={ornaments} eventId={eventId} onSwitch={(id) => { setEventId(id); setHighlightId(null); refresh(id); }} onFind={setHighlightId} highlightId={highlightId} />
          </div>
        )}
      </main>

      {/* tree tools: count, office, find */}
      <div className="fixed right-4 top-4 z-20 hidden lg:block">
        <TreeFooter ornaments={ornaments} eventId={eventId} onSwitch={(id) => { setEventId(id); setHighlightId(null); refresh(id); }} onFind={setHighlightId} highlightId={highlightId} />
      </div>

      {/* confirmation sits in a corner so the tree is fully visible */}
      <AnimatePresence>
        {!showForm && me && !cardOpen && (
          <motion.button
            key="pill"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setCardOpen(true)}
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink shadow-2xl sm:left-6 sm:translate-x-0"
          >
            {me.attending ? "You’re going ✓" : "RSVP saved"} · View
          </motion.button>
        )}
        {!showForm && me && cardOpen && (
          <motion.div
            ref={tagRef}
            key={phase}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[360px]"
          >
            <Confirmation me={me} event={getEvent(me.eventId) ?? event} updated={justUpdated} editLink={editLink} onEdit={edit} onFind={findMine} onClose={() => setCardOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{flight && <FlyingOrnament key="flight" f={flight} onDone={() => flightDone.current()} />}</AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {phase === "done" ? "RSVP saved. Your ornament is on the tree." : phase === "declined" ? "RSVP saved." : ""}
      </p>
    </MotionConfig>
  );
}

/* ───────────────────────── header ───────────────────────── */


/** "a, b & c" — reads like an invitation rather than a feature list */
function joinNicely(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`;
}

function Header({ event }: { event: PartyEvent }) {
  const { date, time } = formatEventDate(event);
  return (
    <header className="mt-2 flex flex-col items-center text-center sm:mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-gold sm:text-[11px]">You’re invited</p>
      <h1 className="font-script -mb-1 mt-0.5 whitespace-nowrap text-[3.2rem] font-normal leading-[1.08] sm:mt-1 sm:text-[4.3rem] lg:mb-3 lg:whitespace-normal lg:text-[4.3rem] lg:leading-[0.98] text-cream drop-shadow-[0_3px_14px_rgba(60,0,10,0.55)]">
        Christmas Party
      </h1>
      <p className="text-[14px] leading-snug text-cream/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.7)] sm:text-[16px]">
        {date.replace(/, \d{4}$/, "")} · {time}
        <br className="sm:hidden" />
        <span className="hidden sm:inline"> · </span>
        {event.venueName}, {event.office}
      </p>
      <p className="hide-short mt-1 max-w-[22rem] font-serif text-[1rem] italic leading-snug sm:mt-2.5 sm:text-[1.15rem] text-cream/80 [text-shadow:0_1px_8px_rgba(40,0,10,0.6)] sm:max-w-none">
        {joinNicely(event.highlights.map((h, i) => (i === 0 ? h.label : h.label.charAt(0).toLowerCase() + h.label.slice(1))))}
      </p>
      {event.rsvpBy && <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-gold/90 sm:mt-2 sm:text-[11px]">RSVP by {event.rsvpBy}</p>}
    </header>
  );
}

/* ───────────────────────── the ornament form ───────────────────────── */

function Bauble({
  refEl,
  form,
  set,
  errors,
  sealed,
  hidden,
  name,
  shakeKey,
  paused,
  onFocusChange,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  errors: Record<string, string>;
  sealed: boolean;
  hidden: boolean;
  name: string;
  shakeKey: number;
  paused: boolean;
  onFocusChange: (f: boolean) => void;
}) {
  return (
    <div
      className={`bauble-size bauble-sway relative pt-7 lg:pt-9 ${paused || sealed ? "paused" : ""}`}
      style={{ visibility: hidden ? "hidden" : undefined }}
    >
      {/* hanging ribbon */}
      <div aria-hidden className="absolute left-1/2 top-0 h-[40px] w-[5px] lg:h-[50px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#5a0614] via-[#b51d36] to-[#5a0614]" />

      <div key={shakeKey} ref={refEl} className={`relative ${shakeKey ? "shake" : ""}`} style={{ aspectRatio: "100 / 140" }}>
        <motion.div className="absolute inset-0" animate={sealed ? { scale: [1, 1.04, 1] } : { scale: 1 }} transition={{ duration: 0.5 }}>
          <Ornament
            color={form.color}
            pattern={form.pattern}
            thread={false}
            detail={sealed ? "full" : "tree"}
            plain={!sealed}
            dimPattern={!sealed}
            artisan={!hidden}
            name={sealed ? name || "You" : undefined}
            className="absolute inset-0 h-full w-full drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)]"
          />
        </motion.div>

        <AnimatePresence>
          {!sealed && (
            <motion.div
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-x-0 flex flex-col items-center justify-center text-center"
              style={{ top: `${(32 / 140) * 100}%`, height: `${(100 / 140) * 100}%`, containerType: "inline-size", ...GLASS[form.color] }}
              onFocus={() => onFocusChange(true)}
              onBlur={() => onFocusChange(false)}
            >
              <div className="flex w-full flex-col items-center" style={{ gap: "2.6cqw", paddingTop: "2cqw" }}>
                <input
                  className="glass-input font-medium"
                  style={{ width: "72cqw", height: "11.5cqw", fontSize: "6cqw", paddingInline: "4cqw" }}
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  aria-invalid={!!errors.fullName}
                  aria-label="Full name"
                  maxLength={80}
                />
                {hasMultipleEvents && (
                  <Pills
                    label="Office"
                    value={form.eventId}
                    onChange={(v) => set("eventId", v)}
                    invalid={!!errors.eventId}
                    options={events.map((e) => ({ value: e.id, label: e.office }))}
                  />
                )}
                <Pills
                  label="Going?"
                  value={form.attending === null ? "" : form.attending ? "yes" : "no"}
                  onChange={(v) => set("attending", v === "yes")}
                  invalid={!!errors.attending}
                  options={[
                    { value: "yes", label: "Going" },
                    { value: "no", label: "Can’t go" },
                  ]}
                />
                {form.attending && (
                  <div className="flex flex-col items-center" style={{ gap: "1.6cqw" }}>
                    <p className="font-medium" style={{ fontSize: "4.4cqw" }}>Bringing a +1?</p>
                    <Pills
                      label="Bringing a +1?"
                      value={form.plusOne === null ? "" : form.plusOne ? "yes" : "no"}
                      onChange={(v) => set("plusOne", v === "yes")}
                      invalid={!!errors.guests}
                      options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                      ]}
                    />
                  </div>
                )}
                {form.attending && form.plusOne && (
                  <div className="flex w-full items-center justify-center">
                    <input
                      className="glass-input font-medium"
                      style={{ width: "72cqw", height: "10.5cqw", fontSize: "5.1cqw", paddingInline: "4cqw" }}
                      value={form.guestName}
                      onChange={(e) => set("guestName", e.target.value)}
                      placeholder="Guest’s name"
                      autoComplete="off"
                      aria-invalid={!!errors.guestName}
                      aria-label="Guest's name"
                      maxLength={80}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Pills({
  label,
  value,
  onChange,
  options,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  invalid?: boolean;
}) {
  const cur = options.findIndex((o) => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid} className="flex justify-center" style={{ gap: "2cqw" }}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (cur < 0 && i === 0) ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
              e.preventDefault();
              const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
              const n = options[(Math.max(0, cur) + d + options.length) % options.length];
              onChange(n.value);
              (e.currentTarget.parentElement?.querySelector(`[data-v="${n.value}"]`) as HTMLElement | null)?.focus();
            }
          }}
          data-v={o.value}
          className={`glass-pill whitespace-nowrap font-medium ${invalid ? "invalid" : ""}`}
          style={{ fontSize: "4.8cqw", height: "9.4cqw", minWidth: "28cqw", paddingInline: "4cqw" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** flat swatch: the glass colour with an optional pattern */
function Swatch({ color, pattern }: { color: OrnamentColor; pattern: OrnamentPattern }) {
  const accent = PALETTES[color].accent;
  return (
    <svg viewBox="0 62 100 100" className="h-6 w-6 lg:h-7 lg:w-7" aria-hidden>
      <circle cx="50" cy="112" r="50" fill={`url(#orn-body-${color})`} />
      {pattern !== "plain" && (
        <g clipPath="url(#orn-ball-clip)">
          <rect x="0" y="62" width="100" height="100" fill={`url(#orn-pat-${pattern}-${accent})`} />
        </g>
      )}
    </svg>
  );
}

function SwatchRow<T extends string>({
  label,
  items,
  value,
  onChange,
  name,
  render,
  vertical,
}: {
  label: string;
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  name: (v: T) => string;
  render: (v: T) => React.ReactNode;
  vertical?: boolean;
}) {
  return (
    <div className={vertical ? "flex flex-col items-center gap-2" : "flex items-center justify-center gap-3"}>
      <span className={`text-[11px] uppercase tracking-[0.16em] text-cream-soft ${vertical ? "" : "w-16 text-right"}`}>{label}</span>
      <div role="radiogroup" aria-label={label} className={vertical ? "flex flex-col gap-1.5" : "flex gap-1.5"}>
        {items.map((c, i) => {
          const on = value === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={name(c)}
              title={name(c)}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(c)}
              onKeyDown={(e) => {
                if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
                  e.preventDefault();
                  const n = items[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
                  onChange(n);
                  (e.currentTarget.parentElement?.querySelector(`[title="${name(n)}"]`) as HTMLElement | null)?.focus();
                }
              }}
              className={`rounded-full p-[3px] ring-1 transition ${on ? "ring-gold" : "ring-transparent hover:ring-cream/30"}`}
            >
              {render(c)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Designer({ form, set, vertical }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void; vertical?: boolean }) {
  return (
    <div className={`flex rounded-2xl bg-[#1a0408]/55 ring-1 ring-white/10 backdrop-blur-md ${vertical ? "flex-row gap-3 px-3 py-4" : "flex-col gap-1 px-3 py-2"}`}>
      <SwatchRow
        vertical={vertical}
        label="Color"
        items={ORNAMENT_COLORS}
        value={form.color}
        onChange={(c) => set("color", c)}
        name={(c) => COLOR_LABELS[c]}
        render={(c) => <Swatch color={c} pattern="plain" />}
      />
      <SwatchRow
        vertical={vertical}
        label="Pattern"
        items={ORNAMENT_PATTERNS}
        value={form.pattern}
        onChange={(pt) => set("pattern", pt)}
        name={(pt) => PATTERN_LABELS[pt]}
        render={(pt) => <Swatch color={form.color} pattern={pt} />}
      />
    </div>
  );
}

function Controls({
  form,
  set,
  saving,
  busy,
  message,
  editing,
  onCancel,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  saving: boolean;
  busy: boolean;
  message: string | null;
  editing: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className={`order-3 mt-2 flex w-full flex-col items-center gap-1.5 transition-opacity duration-300 lg:mt-0 lg:w-auto lg:gap-3 lg:self-center ${busy ? "pointer-events-none opacity-0" : ""}`}>
      <button
        type="submit"
        disabled={saving || busy}
        className="mt-1 inline-flex h-11 min-w-[200px] items-center justify-center lg:mt-2 lg:h-12 gap-2 rounded-full bg-red px-8 text-[17px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(200,34,62,0.8)] transition hover:bg-[#d93350] active:scale-[0.98] disabled:opacity-70"
      >
        {saving ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-label="Saving" />
        ) : editing ? (
          "Update RSVP"
        ) : (
          "Send RSVP"
        )}
      </button>

      <div className="min-h-[1.1rem] text-center text-[13px] lg:min-h-[1.25rem] lg:text-sm" aria-live="assertive">
        {message ? (
          <p role="alert" className="text-[#ffd98a]">
            {message}
          </p>
        ) : form.attending !== false && !editing ? (
          <p className="hidden text-cream/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)] lg:block">Your ornament goes on the tree.</p>
        ) : null}
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-sm text-cream-soft underline underline-offset-4 hover:text-cream">
          Cancel
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── flight ───────────────────────── */

function FlyingOrnament({ f, onDone }: { f: Flight; onDone: () => void }) {
  const w = f.from.w;
  const h = w * 1.7;
  const originY = (ORN_BALL_CY / 170) * 100;
  const lift = Math.max(90, Math.abs(f.from.cx - f.to.cx) * 0.25);
  const mid = { cx: (f.from.cx + f.to.cx) / 2, cy: Math.min(f.from.cy, f.to.cy) - lift };
  const k = f.to.w / w;
  const pos = (p: { cx: number; cy: number }) => ({ x: p.cx - w / 2, y: p.cy - w * (ORN_BALL_CY / 100) });
  const a = pos(f.from);
  const m = pos(mid);
  const b = pos(f.to);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[80]"
      style={{ width: w, height: h, transformOrigin: `50% ${originY}%` }}
      initial={{ x: a.x, y: a.y, scale: 1, rotate: 0 }}
      animate={{ x: [a.x, m.x, b.x], y: [a.y, m.y, b.y], scale: [1, Math.max(k * 3, 0.45), k], rotate: [0, -10, 6, 0] }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 1.3, ease: [0.45, 0, 0.2, 1], times: [0, 0.45, 1] }}
      onAnimationComplete={onDone}
    >
      <Ornament color={f.color} pattern={f.pattern} name={f.name} detail="full" className="relative h-full w-full drop-shadow-[0_12px_16px_rgba(0,0,0,0.35)]" />
    </motion.div>
  );
}

/* ───────────────────────── after RSVP ───────────────────────── */

function Confirmation({
  me,
  event,
  updated,
  editLink,
  onEdit,
  onFind,
  onClose,
}: {
  me: OwnRsvp;
  event: PartyEvent;
  updated: boolean;
  editLink: string;
  onEdit: () => void;
  onFind: () => void;
  onClose: () => void;
}) {
  const { date, time } = formatEventDate(event);
  const going = me.attending;
  return (
    <div className="relative rounded-3xl bg-paper p-7 text-ink shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)]">
      <button onClick={onClose} aria-label="Hide" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink">
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-red">{updated ? "RSVP updated" : "RSVP received"}</p>
      <h2 className="mt-2 font-serif text-[2.4rem] leading-[1]">
        {going ? (
          <>
            See you there, <span className="italic">{me.firstName}.</span>
          </>
        ) : (
          <>
            Sorry you’ll miss it, <span className="italic">{me.firstName}.</span>
          </>
        )}
      </h2>
      {going && (
        <>
          <p className="mt-3 text-[15px] text-ink-soft">
            {date.replace(/, \d{4}$/, "")} · {time}
            <br />
            {event.venueName}
            {me.guests ? ` · You + ${me.guests} ${me.guests === 1 ? "guest" : "guests"}` : ""}
            <br />
            <a
              className="underline decoration-ink/25 underline-offset-2 hover:decoration-ink"
              href={`https://maps.google.com/?q=${encodeURIComponent(`${event.venueName}, ${event.venueAddress}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {event.venueAddress}
            </a>
          </p>
          {me.slot === null && <p className="mt-2 text-sm text-ink-soft">The tree is full, but your RSVP is saved.</p>}
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <a className="rounded-full bg-night px-4 py-2 font-medium text-cream hover:bg-[#3d1018]" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
              Google Calendar
            </a>
            <a className="rounded-full border border-ink/15 px-4 py-2 font-medium hover:border-ink/40" href={outlookCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
              Outlook
            </a>
            <button className="rounded-full border border-ink/15 px-4 py-2 font-medium hover:border-ink/40" onClick={() => downloadIcs(event)}>
              Apple
            </button>
          </div>
        </>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 whitespace-nowrap border-t border-ink/10 pt-4 text-sm">
        {going && me.slot !== null && (
          <button onClick={onFind} className="font-medium underline underline-offset-4">
            Find my ornament
          </button>
        )}
        <button onClick={onEdit} className="font-medium underline underline-offset-4">
          {going ? "Edit RSVP" : "Change to going"}
        </button>
        <EditLink link={editLink} />
      </div>
    </div>
  );
}

function EditLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  if (!link) return null;
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="ml-auto text-ink-soft hover:text-ink"
      title="A private link to edit your RSVP from another device"
    >
      {copied ? "Copied" : "Copy edit link"}
    </button>
  );
}

/* ───────────────────────── under the tree ───────────────────────── */

function TreeFooter({
  ornaments,
  eventId,
  onSwitch,
  onFind,
  highlightId,
}: {
  ornaments: TreeOrnament[];
  eventId: string;
  onSwitch: (id: string) => void;
  onFind: (id: string | null) => void;
  highlightId: string | null;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const n = ornaments.length;
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return ornaments
      .filter((o) => o.firstName.toLowerCase().includes(s))
      .sort((a, b) => Number(!a.firstName.toLowerCase().startsWith(s)) - Number(!b.firstName.toLowerCase().startsWith(s)) || a.firstName.localeCompare(b.firstName))
      .slice(0, 8);
  }, [q, ornaments]);
  const pick = (o: TreeOrnament) => {
    onFind(o.id);
    setQ(o.firstName);
    setOpen(false);
  };
  return (
    <div className="relative z-20 -mt-2 flex w-full max-w-lg flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
      <p className="text-cream-soft" aria-live="polite">
        {n === 0 ? "No ornaments yet" : `${n} ${n === 1 ? "ornament" : "ornaments"}`}
      </p>
      {hasMultipleEvents && (
        <div role="tablist" aria-label="Which tree" className="flex rounded-full bg-white/5 p-0.5 ring-1 ring-white/10">
          {events.map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={e.id === eventId}
              onClick={() => onSwitch(e.id)}
              className={`rounded-full px-3 py-1 transition ${e.id === eventId ? "bg-cream text-night" : "text-cream-soft hover:text-cream"}`}
            >
              {e.office}
            </button>
          ))}
        </div>
      )}
      {n > 0 && (
        <div className="relative w-40">
          <label htmlFor="find-orn" className="sr-only">
            Find an ornament by name
          </label>
          <input
            id="find-orn"
            role="combobox"
            aria-expanded={open && matches.length > 0}
            aria-controls="find-orn-list"
            aria-autocomplete="list"
            aria-activedescendant={open && matches[active] ? `find-${matches[active].id}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
              if (!e.target.value) onFind(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(matches.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && matches[active]) {
                e.preventDefault();
                pick(matches[active]);
              } else if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Find a name"
            className="w-full rounded-full bg-white/5 px-4 py-1.5 text-center text-cream ring-1 ring-white/10 placeholder:text-cream-soft/60 focus:outline-none focus:ring-gold/60"
          />
          <AnimatePresence>
            {open && q.trim() && (
              <motion.ul
                id="find-orn-list"
                role="listbox"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute bottom-full left-1/2 mb-2 max-h-64 w-56 -translate-x-1/2 overflow-auto rounded-2xl bg-paper p-1 text-ink shadow-2xl"
              >
                {matches.length === 0 ? (
                  <li className="px-3 py-2 text-center text-ink-soft">No match</li>
                ) : (
                  matches.map((o, i) => (
                    <li
                      key={o.id}
                      id={`find-${o.id}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(o)}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 ${i === active || o.id === highlightId ? "bg-ink/5" : ""}`}
                    >
                      <Ornament color={o.color} pattern={o.pattern} thread={false} className="h-6 w-auto" />
                      <span className="font-serif text-lg italic">{o.firstName}</span>
                    </li>
                  ))
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
