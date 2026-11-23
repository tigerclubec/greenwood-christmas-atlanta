import { getPublicTree } from "@/lib/rsvp";
import { handleError, json } from "@/lib/http";
import { events } from "@/config/party";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("event") ?? events[0].id;
    return json(await getPublicTree(id));
  } catch (e) {
    return handleError(e);
  }
}
