import "server-only";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RsvpError } from "./rsvp";
import { zodMessage } from "./schema";

export const noStore = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return json({ error: "Please check the highlighted fields.", fields: zodMessage(e) }, 422);
  }
  if (e instanceof RsvpError) return json({ error: e.message, code: e.code }, e.status);
  console.error(e);
  return json({ error: "Something went wrong saving your RSVP. Please try again." }, 500);
}

export function tokenFrom(req: Request) {
  return req.headers.get("x-rsvp-token") ?? "";
}

/** Tiny in-memory limiter — enough to slow down accidental loops / naive bots. */
const hits = new Map<string, number[]>();
export function rateLimited(req: Request, limit = 30, windowMs = 60_000) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > limit;
}

export function isAdmin(req: Request) {
  const key = process.env.ADMIN_KEY;
  const given = req.headers.get("x-admin-key") ?? "";
  if (!key || key.length < 8) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(key).digest("hex"));
  const b = Buffer.from(crypto.createHash("sha256").update(given).digest("hex"));
  return crypto.timingSafeEqual(a, b);
}
