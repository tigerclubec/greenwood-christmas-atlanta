/** Browser → API helper. (Swapped for an in-browser mock in the demo build.) */
export async function api<T>(url: string, init?: RequestInit & { token?: string | null }) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.token ? { "x-rsvp-token": init.token } : {}) },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, error: (body.error as string) ?? "Something went wrong. Try again.", fields: body.fields as Record<string, string> | undefined };
    return { ok: true as const, data: body as T };
  } catch {
    return { ok: false as const, error: "Couldn't connect. Try again." };
  }
}
