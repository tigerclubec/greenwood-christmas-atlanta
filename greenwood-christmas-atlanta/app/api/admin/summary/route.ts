import { adminSummary } from "@/lib/rsvp";
import { handleError, isAdmin, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.ADMIN_KEY) return json({ error: "Set ADMIN_KEY in the environment to enable the admin page." }, 503);
  if (!isAdmin(req)) return json({ error: "Wrong admin key." }, 401);
  try {
    return json({ summary: await adminSummary() });
  } catch (e) {
    return handleError(e);
  }
}
