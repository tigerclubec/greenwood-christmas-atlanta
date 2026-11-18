import "server-only";
import { store, newId, newToken, hashToken, type RsvpRecord, type Db } from "./store";
import { ORNAMENT_COLORS, ORNAMENT_PATTERNS, firstNameOf, type OrnamentPattern, type RsvpInput } from "./schema";
import { firstFreeSlot, getSlots, nearestFreeSlot } from "./slots";
import { events, getEvent } from "@/config/party";

export type PublicOrnament = { id: string; firstName: string; color: RsvpRecord["color"]; pattern: OrnamentPattern; slot: number };

export type OwnRsvp = Omit<RsvpRecord, "editTokenHash">;

export class RsvpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const own = ({ editTokenHash: _h, ...rest }: RsvpRecord): OwnRsvp => rest;

function takenSlots(db: Db, eventId: string, exceptId?: string) {
  return new Set(
    db.rsvps
      .filter((r) => r.eventId === eventId && r.slot !== null && r.id !== exceptId)
      .map((r) => r.slot as number),
  );
}

function byToken(db: Db, token: string) {
  if (!token || token.length < 16) return undefined;
  const h = hashToken(token);
  return db.rsvps.find((r) => r.editTokenHash === h);
}

/** Only first name + colour + slot ever leave the server for the shared tree. */
export async function getPublicTree(eventId: string) {
  if (!getEvent(eventId)) throw new RsvpError(404, "unknown_event", "Unknown event.");
  const db = await store().read();
  const ornaments: PublicOrnament[] = db.rsvps
    .filter((r) => r.eventId === eventId && r.attending && r.slot !== null)
    .map((r) => ({ id: r.id, firstName: r.firstName, color: (ORNAMENT_COLORS as readonly string[]).includes(r.color) ? r.color : "cranberry", pattern: (ORNAMENT_PATTERNS as readonly string[]).includes(r.pattern ?? "") ? (r.pattern as OrnamentPattern) : "plain", slot: r.slot as number }))
    .sort((a, b) => a.slot - b.slot);
  return { eventId, ornaments, count: ornaments.length, capacity: getSlots().length };
}

export async function createRsvp(input: RsvpInput) {
  return store().transact((db) => {
    if (db.rsvps.some((r) => r.email === input.email)) {
      throw new RsvpError(
        409,
        "duplicate",
        "Looks like you've already RSVP'd with this email. Use your personal edit link to make changes, or contact the party team.",
      );
    }
    const token = newToken();
    const now = new Date().toISOString();
    const rec: RsvpRecord = {
      id: newId(),
      editTokenHash: hashToken(token),
      eventId: input.eventId,
      fullName: input.fullName,
      firstName: firstNameOf(input.fullName),
      email: input.email,
      attending: input.attending,
      guests: input.guests,
      guestName: input.guestName,
      dietary: input.dietary,
      song: input.song,
      color: input.color,
      pattern: input.pattern,
      slot: null,
      hungAt: null,
      createdAt: now,
      updatedAt: now,
    };
    if (rec.attending) autoHang(db, rec);
    db.rsvps.push(rec);
    return { token, rsvp: own(rec) };
  });
}

export async function getOwnRsvp(token: string) {
  const db = await store().read();
  const rec = byToken(db, token);
  if (!rec) throw new RsvpError(404, "not_found", "We couldn't find that RSVP. Your link may be incomplete.");
  return own(rec);
}

export async function updateRsvp(token: string, input: RsvpInput) {
  return store().transact((db) => {
    const rec = byToken(db, token);
    if (!rec) throw new RsvpError(404, "not_found", "We couldn't find that RSVP. Your link may be incomplete.");
    if (input.email !== rec.email && db.rsvps.some((r) => r.email === input.email)) {
      throw new RsvpError(409, "duplicate", "Another RSVP already uses that email address.");
    }
    const eventChanged = input.eventId !== rec.eventId;
    Object.assign(rec, {
      eventId: input.eventId,
      fullName: input.fullName,
      firstName: firstNameOf(input.fullName),
      email: input.email,
      attending: input.attending,
      guests: input.guests,
      guestName: input.guestName,
      dietary: input.dietary,
      song: input.song,
      color: input.color,
      pattern: input.pattern,
      updatedAt: new Date().toISOString(),
    });
    // Declining or switching office takes the ornament off this tree.
    if (!rec.attending || eventChanged) {
      rec.slot = null;
      rec.hungAt = null;
    }
    if (rec.attending && rec.slot === null) autoHang(db, rec);
    return own(rec);
  });
}

/** RSVPing "yes" hangs the ornament straight away on the next free branch. */
function autoHang(db: Db, rec: RsvpRecord) {
  const slot = firstFreeSlot(takenSlots(db, rec.eventId, rec.id));
  if (slot === null) return; // tree full — RSVP still saved
  rec.slot = slot;
  rec.hungAt = new Date().toISOString();
}

/**
 * Hang the ornament. `preferredSlot` comes from a drag-and-drop; if it's taken
 * (someone else got there first), the nearest free slot is used instead —
 * an existing ornament is never overwritten.
 */
export async function hangOrnament(token: string, preferred?: { slot?: number; x?: number; y?: number }) {
  return store().transact((db) => {
    const rec = byToken(db, token);
    if (!rec) throw new RsvpError(404, "not_found", "We couldn't find that RSVP.");
    if (!rec.attending) throw new RsvpError(400, "not_attending", "Ornaments are for guests who are attending.");
    if (rec.slot !== null) return own(rec); // idempotent

    const taken = takenSlots(db, rec.eventId, rec.id);
    const slots = getSlots();
    let slot: number | null = null;
    const p = preferred?.slot;
    if (typeof p === "number" && Number.isInteger(p) && p >= 0 && p < slots.length && !taken.has(p)) {
      slot = p;
    } else if (typeof p === "number" && slots[p]) {
      slot = nearestFreeSlot(slots[p].x, slots[p].y, taken);
    } else if (typeof preferred?.x === "number" && typeof preferred?.y === "number") {
      slot = nearestFreeSlot(preferred.x, preferred.y, taken);
    } else {
      slot = firstFreeSlot(taken);
    }
    if (slot === null) {
      throw new RsvpError(409, "tree_full", "Our tree is completely full! Your RSVP is saved — we'll find you a spot.");
    }
    rec.slot = slot;
    rec.hungAt = new Date().toISOString();
    rec.updatedAt = rec.hungAt;
    return own(rec);
  });
}

/* ─────────────────────────────── Admin ─────────────────────────────── */

function csvCell(v: unknown) {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(eventId?: string) {
  const db = await store().read();
  const rows = db.rsvps
    .filter((r) => !eventId || r.eventId === eventId)
    .sort((a, b) => a.eventId.localeCompare(b.eventId) || a.fullName.localeCompare(b.fullName));
  const header = [
    "Office",
    "Full name",
    "Email",
    "Attending",
    "Additional guests",
    "Guest name",
    "Dietary / allergies",
    "Song request",
    "Ornament color",
    "Ornament pattern",
    "Ornament hung",
    "RSVP created",
    "Last updated",
  ];
  const lines = rows.map((r) =>
    [
      getEvent(r.eventId)?.office ?? r.eventId,
      r.fullName,
      r.email,
      r.attending ? "Yes" : "No",
      r.attending ? r.guests : 0,
      r.guestName,
      r.dietary,
      r.song,
      r.attending ? r.color : "",
      r.attending ? (r.pattern ?? "plain") : "",
      r.slot !== null ? "Yes" : "No",
      r.createdAt,
      r.updatedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return "﻿" + [header.join(","), ...lines].join("\r\n");
}

export async function adminSummary() {
  const db = await store().read();
  return events.map((e) => {
    const rs = db.rsvps.filter((r) => r.eventId === e.id);
    const yes = rs.filter((r) => r.attending);
    return {
      eventId: e.id,
      office: e.office,
      responses: rs.length,
      attending: yes.length,
      guests: yes.reduce((n, r) => n + r.guests, 0),
      headcount: yes.length + yes.reduce((n, r) => n + r.guests, 0),
      declined: rs.length - yes.length,
      ornaments: rs.filter((r) => r.slot !== null).length,
      withDietary: yes.filter((r) => r.dietary).length,
    };
  });
}
