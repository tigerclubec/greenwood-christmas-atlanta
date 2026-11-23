import { z } from "zod";
import { events, hasMultipleEvents, party } from "@/config/party";

export const ORNAMENT_COLORS = ["cranberry", "gold", "green", "frost", "teal", "midnight"] as const;
export const ORNAMENT_PATTERNS = ["plain", "stripes", "dots", "snow", "stars", "zigzag"] as const;
export type OrnamentPattern = (typeof ORNAMENT_PATTERNS)[number];
export const PATTERN_LABELS: Record<OrnamentPattern, string> = {
  plain: "Plain glass",
  stripes: "Candy stripes",
  dots: "Polka dots",
  snow: "Snowflakes",
  stars: "Little stars",
  zigzag: "Zigzag",
};
export type OrnamentColor = (typeof ORNAMENT_COLORS)[number];

export const COLOR_LABELS: Record<OrnamentColor, string> = {
  cranberry: "Cranberry Red",
  gold: "Golden",
  green: "Greenwood Green",
  frost: "Frosty White",
  teal: "Spruce Teal",
  midnight: "Midnight Blue",
};

const eventIds = events.map((e) => e.id) as [string, ...string[]];

const trimmed = (max: number) => z.string().trim().max(max);

export const rsvpInputSchema = z
  .object({
    fullName: trimmed(80).min(2, "Please enter your full name."),
    eventId: hasMultipleEvents
      ? z.enum(eventIds, { message: "Please choose your office." })
      : z.enum(eventIds).default(eventIds[0]),
    attending: z.boolean({ message: "Let us know if you can make it." }),
    guests: z.number().int().min(0).max(party.event.maxGuests).default(0),
    guestName: trimmed(80).optional().default(""),
    dietary: trimmed(400).optional().default(""),
    song: trimmed(120).optional().default(""),
    color: z.enum(ORNAMENT_COLORS).default("cranberry"),
    pattern: z.enum(ORNAMENT_PATTERNS).default("plain"),
    // honeypot: real people never fill this in
    website: z.string().max(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.attending && v.guests > 0 && v.guestName.length < 2) {
      ctx.addIssue({ code: "custom", path: ["guestName"], message: "Add your guest's name." });
    }
  })
  .transform((v) => {
    // Only keep fields that are relevant to the answers.
    if (!v.attending) return { ...v, guests: 0, guestName: "", dietary: "", song: "" };
    if (v.guests === 0) return { ...v, guestName: "" };
    return v;
  });

export type RsvpInput = z.infer<typeof rsvpInputSchema>;

export function firstNameOf(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 14);
}

export function zodMessage(err: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!fields[k]) fields[k] = issue.message;
  }
  return fields;
}
