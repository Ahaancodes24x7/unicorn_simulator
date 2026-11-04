import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GameError } from "@/game/engine";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps a route handler: maps domain errors to JSON responses and enforces same-origin writes. */
export function handler<A extends unknown[]>(fn: (req: Request, ...args: A) => Promise<Response>) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      return await fn(req, ...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      if (err instanceof ZodError) {
        return NextResponse.json({ error: err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") }, { status: 400 });
      }
      console.error(JSON.stringify({ level: "error", msg: "unhandled", path: new URL(req.url).pathname, err: String(err) }));
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

// CSRF defence in depth (cookies are also SameSite=Lax): writes must be JSON from our own origin.
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request blocked");
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new HttpError(415, "Expected application/json");
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

// Simple in-memory fixed-window rate limiter (per process). Use a shared store if you run multiple instances.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  if (++b.count > limit) throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
}
