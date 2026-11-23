/**
 * ─────────────────────────────────────────────────────────────
 *  EDIT ME — all party details live here.
 * ─────────────────────────────────────────────────────────────
 *
 * This site is for ONE office's party. (The other office has its own copy of the site.)
 *
 * `startsAt` / `endsAt` are ISO-8601 with the venue's UTC offset.
 * `timeZone` is used to show the time in the venue's local zone.
 */

export type PartyEvent = {
  id: string; // storage-safe id — don't change after RSVPs start
  office: string;
  title: string; // used for calendar invites
  startsAt: string;
  endsAt: string;
  timeZone: string;
  venueName: string;
  venueAddress: string;
  rsvpBy?: string; // display only
  /** the fun stuff, shown under the title */
  highlights: { icon: "cocktail" | "cards" | "music" | "food" | "photo" | "gift"; label: string }[];
  /** most guests one person can bring */
  maxGuests: number;
};

export const party = {
  companyName: "Greenwood Star",
  year: 2026,
  event: {
    id: "atlanta",
    office: "Atlanta",
    title: "Greenwood Star Christmas Party",
    startsAt: "2026-12-10T18:00:00-05:00",
    endsAt: "2026-12-10T22:00:00-05:00",
    timeZone: "America/New_York",
    venueName: "Sapphire 786",
    venueAddress: "7130 Buford Hwy NE, Suite A-100, Atlanta, GA 30340",
    rsvpBy: "December 4",
    highlights: [
      { icon: "food", label: "Christmas dinner" },
      { icon: "cocktail", label: "Cocktails" },
      { icon: "cards", label: "Casino games" },
      { icon: "gift", label: "Prizes" },
    ],
    maxGuests: 1,
  } satisfies PartyEvent as PartyEvent,
};

/* ── helpers (no need to edit below) ── */

export const events: PartyEvent[] = [party.event];
export const hasMultipleEvents = false;

export function getEvent(id: string | null | undefined): PartyEvent | undefined {
  return events.find((e) => e.id === id);
}

export function formatEventDate(e: PartyEvent) {
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: e.timeZone,
  }).format(start);
  const t = (d: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: e.timeZone }).format(d);
  return { date, time: `${t(start)} – ${t(end)}` };
}
