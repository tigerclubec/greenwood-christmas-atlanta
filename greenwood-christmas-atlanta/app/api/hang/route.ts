import { hangOrnament } from "@/lib/rsvp";
import { handleError, json, rateLimited, tokenFrom } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (rateLimited(req)) return json({ error: "Too many tries — please wait a minute." }, 429);
  try {
    const body = (await req.json().catch(() => ({}))) as { slot?: unknown; x?: unknown; y?: unknown };
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    const rsvp = await hangOrnament(tokenFrom(req), { slot: num(body.slot), x: num(body.x), y: num(body.y) });
    return json({ rsvp });
  } catch (e) {
    return handleError(e);
  }
}
