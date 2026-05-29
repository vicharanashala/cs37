/**
 * src/lib/community/identity.ts
 *
 * Lightweight request identity for the Community module.
 *
 * The product has no auth system yet (the existing chat uses a client-generated
 * sessionId in the same spirit). So we identify a "student" by an opaque,
 * client-generated id sent in the `x-student-id` header and persisted in the
 * browser's localStorage. This is enough to:
 *   - attribute questions/answers to an author
 *   - enforce one-vote-per-user
 *   - power the "My Contributions" page
 *
 * It is NOT a security boundary. When real auth lands, replace `getStudent()`
 * with the authenticated session lookup — call sites won't change.
 *
 * Admin actions are gated by a shared `x-admin-key` header (see constants.ts).
 */

import { ADMIN_KEY } from "./constants";

export interface Student {
  /** Stable per-browser identifier (client-generated UUID). */
  studentId: string;
  role: "student";
}

/**
 * Resolve the calling student from request headers.
 * Returns null when no id is present (anonymous read-only access).
 */
export function getStudent(req: Request): Student | null {
  const id = req.headers.get("x-student-id")?.trim();
  if (!id || id.length < 8 || id.length > 100) return null;
  return { studentId: id, role: "student" };
}

/** True when the request carries the correct admin key. */
export function isAdmin(req: Request): boolean {
  const key = req.headers.get("x-admin-key")?.trim();
  return !!key && key === ADMIN_KEY;
}
