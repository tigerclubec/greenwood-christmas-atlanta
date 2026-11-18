import type { PartyEvent } from "@/config/party";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(e: PartyEvent) {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.startsAt)}/${stamp(e.endsAt)}`,
    location: `${e.venueName}, ${e.venueAddress}`,
    details: `${e.highlights.map((h) => h.label).join(" · ")}\n${e.venueAddress}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookCalendarUrl(e: PartyEvent) {
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.startsAt).toISOString(),
    enddt: new Date(e.endsAt).toISOString(),
    location: `${e.venueName}, ${e.venueAddress}`,
    body: e.highlights.map((h) => h.label).join(" · "),
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${q}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function icsFile(e: PartyEvent) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Greenwood Star//Holiday Party//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}-${stamp(e.startsAt)}@greenwoodstar-holiday`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(`${e.venueName}, ${e.venueAddress}`)}`,
    `DESCRIPTION:${esc(e.highlights.map((h) => h.label).join(" · "))}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Holiday party tomorrow!",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function downloadIcs(e: PartyEvent) {
  const blob = new Blob([icsFile(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `greenwood-star-holiday-party-${e.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
