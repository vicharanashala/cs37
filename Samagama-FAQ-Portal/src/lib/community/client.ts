/**
 * src/lib/community/client.ts
 *
 * Browser-side helpers for the Community Q&A pages.
 *
 * Identity mirrors the existing Yaksha chat pattern: a stable id is generated
 * once and kept in localStorage, then sent on every request as `x-student-id`.
 * The admin key (for the moderation page) is likewise stored locally.
 *
 * `api()` is a thin fetch wrapper that attaches those headers and returns the
 * parsed `{ ok, ... }` envelope produced by src/lib/api.ts.
 */

const STUDENT_KEY = "samagama_student_id";
const ADMIN_KEY = "samagama_admin_key";

/** Get or lazily create this browser's student id. */
export function getStudentId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STUDENT_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `stu_${Math.random().toString(36).slice(2)}${Date.now()}`;
    localStorage.setItem(STUDENT_KEY, id);
  }
  return id;
}

export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY) ?? "";
}

export function setAdminKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_KEY, key);
}

export interface ApiEnvelope {
  ok: boolean;
  error?: { code: string; message: string };
  [key: string]: unknown;
}

export async function api<T extends ApiEnvelope = ApiEnvelope>(
  path: string,
  init: RequestInit & { admin?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-student-id", getStudentId());
  if (init.body) headers.set("content-type", "application/json");
  if (init.admin) headers.set("x-admin-key", getAdminKey());

  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({ ok: false }))) as T;
  return data;
}
