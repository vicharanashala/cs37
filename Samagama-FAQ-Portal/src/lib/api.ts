/**
 * src/lib/api.ts
 *
 * Tiny helpers for consistent JSON responses from Route Handlers.
 *
 * Every response is shaped as either:
 *   { ok: true, ...data }
 *   { ok: false, error: { code, message } }
 *
 * Keeps handlers terse and the client parsing predictable.
 */

import { NextResponse } from "next/server";

export function ok<T extends Record<string, unknown>>(
  data: T,
  init?: ResponseInit
) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function created<T extends Record<string, unknown>>(data: T) {
  return ok(data, { status: 201 });
}

export function fail(
  code: string,
  message: string,
  status = 400
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
}

/** Common, reusable error responses. */
export const errors = {
  badRequest: (msg = "Invalid request") => fail("bad_request", msg, 400),
  unauthorized: (msg = "Authentication required") =>
    fail("unauthorized", msg, 401),
  forbidden: (msg = "Not allowed") => fail("forbidden", msg, 403),
  notFound: (msg = "Not found") => fail("not_found", msg, 404),
  rateLimited: (msg = "Too many requests, slow down") =>
    fail("rate_limited", msg, 429),
  server: (msg = "Something went wrong") => fail("server_error", msg, 500),
};

/** Safely parse a JSON body, returning null on failure. */
export async function readJson<T = Record<string, unknown>>(
  req: Request
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
