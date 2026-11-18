import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { OrnamentColor, OrnamentPattern } from "./schema";
import { party } from "@/config/party";

export type RsvpRecord = {
  id: string; // public id (safe to expose)
  editTokenHash: string; // sha256 of the private edit token
  eventId: string;
  fullName: string;
  firstName: string;
  email: string;
  attending: boolean;
  guests: number;
  guestName: string;
  dietary: string;
  song: string;
  color: OrnamentColor;
  pattern?: OrnamentPattern;
  slot: number | null; // ornament position on the tree (null = not hung)
  hungAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Db = { version: 1; rsvps: RsvpRecord[] };

const empty = (): Db => ({ version: 1, rsvps: [] });

interface Adapter {
  read(): Promise<Db>;
  /** Run `fn` with exclusive access; whatever `fn` leaves in `db` is saved. */
  transact<T>(fn: (db: Db) => T | Promise<T>): Promise<T>;
}

/* ───────────────────────── File adapter (default) ───────────────────────── */

class FileAdapter implements Adapter {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  async read(): Promise<Db> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const db = JSON.parse(raw) as Db;
      return db && Array.isArray(db.rsvps) ? db : empty();
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty();
      throw e;
    }
  }

  private async write(db: Db) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, this.file); // atomic replace
  }

  transact<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
    // Serialise all writes within this process.
    const run = this.queue.then(async () => {
      const db = await this.read();
      const before = JSON.stringify(db);
      const result = await fn(db);
      if (JSON.stringify(db) !== before) await this.write(db);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/* ─────────────────── Upstash Redis adapter (serverless) ─────────────────── */

class UpstashAdapter implements Adapter {
  // one key per office, so two sites can safely share a database
  private key = `greenwood-tree:${party.event.id}:db`;
  private lockKey = `greenwood-tree:${party.event.id}:lock`;
  constructor(private url: string, private token: string) {}

  private async cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash error ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: string };
    if (json.error) throw new Error(json.error);
    return json.result as T;
  }

  async read(): Promise<Db> {
    const raw = await this.cmd<string | null>("GET", this.key);
    return raw ? (JSON.parse(raw) as Db) : empty();
  }

  async transact<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
    const owner = crypto.randomUUID();
    const deadline = Date.now() + 8000;
    // Acquire a short-lived lock so concurrent requests can't double-book a slot or an email.
    while ((await this.cmd("SET", this.lockKey, owner, "NX", "PX", 5000)) !== "OK") {
      if (Date.now() > deadline) throw new Error("Storage is busy, please try again.");
      await new Promise((r) => setTimeout(r, 60 + Math.random() * 90));
    }
    try {
      const db = await this.read();
      const before = JSON.stringify(db);
      const result = await fn(db);
      const after = JSON.stringify(db);
      if (after !== before) await this.cmd("SET", this.key, after);
      return result;
    } finally {
      // release only if we still own it
      await this.cmd(
        "EVAL",
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        this.lockKey,
        owner,
      ).catch(() => undefined);
    }
  }
}

/* ──────────────────────────────── Factory ──────────────────────────────── */

const g = globalThis as unknown as { __treeStore?: Adapter };

export function store(): Adapter {
  if (g.__treeStore) return g.__treeStore;
  // Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!(url && token) && process.env.VERCEL) {
    throw new Error(
      "No database connected. In Vercel: Storage → Create → Upstash for Redis, connect it to this project, then redeploy.",
    );
  }
  g.__treeStore =
    url && token
      ? new UpstashAdapter(url, token)
      : new FileAdapter(path.resolve(/* turbopackIgnore: true */ process.env.DATA_FILE ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data", "rsvps.json")));
  return g.__treeStore;
}

export function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}
export function newId() {
  return crypto.randomBytes(9).toString("base64url");
}
export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
