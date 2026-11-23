import { createRsvp, getOwnRsvp, updateRsvp } from "@/lib/rsvp";
import { rsvpInputSchema } from "@/lib/schema";
import { handleError, json, rateLimited, tokenFrom } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Read your own RSVP (requires your private edit token). */
export async function GET(req: Request) {
  try {
    return json({ rsvp: await getOwnRsvp(tokenFrom(req)) });
  } catch (e) {
    return handleError(e);
  }
}

/** Create an RSVP. Returns the private edit token once. */
export async function POST(req: Request) {
  if (rateLimited(req)) return json({ error: "Too many tries — please wait a minute." }, 429);
  try {
    const input = rsvpInputSchema.parse(await req.json());
    const { token, rsvp } = await createRsvp(input);
    return json({ token, rsvp }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** Edit your RSVP. */
export async function PUT(req: Request) {
  if (rateLimited(req)) return json({ error: "Too many tries — please wait a minute." }, 429);
  try {
    const input = rsvpInputSchema.parse(await req.json());
    return json({ rsvp: await updateRsvp(tokenFrom(req), input) });
  } catch (e) {
    return handleError(e);
  }
}
