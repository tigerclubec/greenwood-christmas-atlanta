"use client";

import { useEffect, useState } from "react";
import { events, party } from "@/config/party";
import { CardFrame } from "@/components/Decor";

type Row = {
  eventId: string;
  office: string;
  responses: number;
  attending: number;
  guests: number;
  headcount: number;
  declined: number;
  ornaments: number;
  withDietary: number;
};

const KEY = "gs-admin-key";

export default function Admin() {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (k: string) => {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/admin/summary", { headers: { "x-admin-key": k }, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setRows(null);
      setErr(j.error ?? "Could not load.");
      return;
    }
    try {
      sessionStorage.setItem(KEY, k);
    } catch {}
    setRows(j.summary);
  };

  useEffect(() => {
    try {
      const k = sessionStorage.getItem(KEY);
      if (k) {
        setKey(k);
        void load(k);
      }
    } catch {}
  }, []);

  const download = async (eventId?: string) => {
    const r = await fetch(`/api/admin/export${eventId ? `?event=${eventId}` : ""}`, { headers: { "x-admin-key": key } });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? "Export failed.");
      return;
    }
    const blob = await r.blob();
    const name = r.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "rsvps.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 py-12 text-ink">
      <CardFrame>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate">
          {party.companyName} · Christmas {party.year}
        </p>
        <h1 className="mt-1 font-serif text-4xl text-ink">RSVPs</h1>

        {!rows ? (
          <form
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void load(key);
            }}
          >
            <label htmlFor="admin-key" className="sr-only">
              Admin key
            </label>
            <input id="admin-key" type="password" className="field" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />
            <button disabled={busy || !key} className="rounded-full bg-forest px-6 py-3 font-semibold text-paper disabled:opacity-60">
              {busy ? "Checking…" : "Open"}
            </button>
          </form>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-soft">
                  <tr className="border-b border-sage/30">
                    <th className="py-2 pr-3">Office</th>
                    <th className="py-2 pr-3">Responses</th>
                    <th className="py-2 pr-3">Attending</th>
                    <th className="py-2 pr-3">+1s</th>
                    <th className="py-2 pr-3">Headcount</th>
                    <th className="py-2 pr-3">Declined</th>
                    <th className="py-2 pr-3">Dietary notes</th>
                    <th className="py-2 pr-3">Ornaments</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.eventId} className="border-b border-sage/15">
                      <td className="py-2.5 pr-3 font-medium">{r.office}</td>
                      <td className="py-2.5 pr-3">{r.responses}</td>
                      <td className="py-2.5 pr-3">{r.attending}</td>
                      <td className="py-2.5 pr-3">{r.guests}</td>
                      <td className="py-2.5 pr-3 font-semibold text-teal">{r.headcount}</td>
                      <td className="py-2.5 pr-3">{r.declined}</td>
                      <td className="py-2.5 pr-3">{r.withDietary}</td>
                      <td className="py-2.5 pr-3">{r.ornaments}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => download(r.eventId)} className="font-medium text-forest underline decoration-sage/60 underline-offset-4">
                          CSV
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => download()} className="rounded-full bg-brand px-6 py-3 font-semibold text-paper ring-1 ring-sage/60">
                Download all RSVPs (CSV)
              </button>
              <button onClick={() => load(key)} className="rounded-full border border-sage/50 px-5 py-3 font-medium">
                Refresh
              </button>
            </div>
            <p className="mt-4 text-xs text-ink-soft">
              The CSV includes emails and +1s. Only first names appear on the public tree.
              {events.length > 1 ? " Each office has its own tree and RSVP list." : ""}
            </p>
          </>
        )}
        {err && (
          <p role="alert" className="mt-4 text-sm text-teal">
            {err}
          </p>
        )}
      </CardFrame>
    </main>
  );
}
