/**
 * src/lib/community/rateLimit.ts
 *
 * Minimal in-memory sliding-window rate limiter.
 *
 * QA_FEATURE.md requires rate limits for asking/answering and basic spam
 * control. A production multi-instance deployment would back this with Redis;
 * for this single-process app an in-memory map is sufficient and dependency-
 * free. State is attached to globalThis so it survives Next.js hot reloads.
 */

interface Window {
  count: number;
  resetAt: number;
}

interface Store {
  hits: Map<string, Window>;
}

declare global {
  var _communityRateStore: Store | undefined;
}

const store: Store = globalThis._communityRateStore ?? { hits: new Map() };
globalThis._communityRateStore = store;

export interface RateResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Consume one unit from the bucket `key`. Returns whether the action is
 * allowed and how many remain in the current window.
 */
export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): RateResult {
  const now = Date.now();
  const existing = store.hits.get(key);

  if (!existing || now >= existing.resetAt) {
    const win: Window = { count: 1, resetAt: now + opts.windowMs };
    store.hits.set(key, win);
    return { allowed: true, remaining: opts.max - 1, resetAt: win.resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= opts.max;
  return {
    allowed,
    remaining: Math.max(0, opts.max - existing.count),
    resetAt: existing.resetAt,
  };
}
