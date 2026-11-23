import { exportCsv } from "@/lib/rsvp";
import { handleError, isAdmin, json } from "@/lib/http";
import { getEvent } from "@/config/party";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.ADMIN_KEY) return json({ error: "Set ADMIN_KEY in the environment to enable exports." }, 503);
  if (!isAdmin(req)) return json({ error: "Wrong admin key." }, 401);
  try {
    const ev = new URL(req.url).searchParams.get("event") || undefined;
    if (ev && !getEvent(ev)) return json({ error: "Unknown event." }, 404);
    const csv = await exportCsv(ev);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="greenwood-rsvps-${ev ?? "all"}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
