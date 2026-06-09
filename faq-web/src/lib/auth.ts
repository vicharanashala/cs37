/**
 * src/lib/auth.ts
 *
 * Client-side helpers for reading/writing the auth token in localStorage.
 */

export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_ROLE_KEY = "auth_role";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthRole(): "user" | "admin" | null {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem(AUTH_ROLE_KEY);
  if (role === "user" || role === "admin") return role;
  return null;
}

export function setAuthRole(role: "user" | "admin"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_ROLE_KEY, role);
}

export function clearAuthRole(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_ROLE_KEY);
}