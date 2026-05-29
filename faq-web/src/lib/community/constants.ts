/**
 * src/lib/community/constants.ts
 *
 * Shared constants for the Community Q&A module.
 *
 * The wider PRD imagines a multi-institution platform, so every community
 * document carries an `institutionId`. This single deployment serves one
 * institution (Vicharanashala / IIT Ropar), so we default it here and allow
 * an env override without forcing auth/tenant plumbing that doesn't exist yet.
 */

/** Default tenant for this single-institution deployment. */
export const INSTITUTION_ID =
  process.env.INSTITUTION_ID ?? "iit-ropar-vicharanashala";

/**
 * Admin key for moderation endpoints. The existing /resolve admin panel ships
 * with no auth, so we keep a low-friction shared key (overridable via env).
 * Sent by the admin UI as the `x-admin-key` header.
 */
export const ADMIN_KEY = process.env.COMMUNITY_ADMIN_KEY ?? "dev-admin";

/** Validation bounds for user-submitted content. */
export const LIMITS = {
  TITLE_MIN: 10,
  TITLE_MAX: 160,
  BODY_MIN: 0,
  BODY_MAX: 5000,
  ANSWER_MIN: 15,
  ANSWER_MAX: 5000,
  TAGS_MAX: 6,
  TAG_MAX_LEN: 24,
} as const;

/**
 * Rate limits (per studentId) for spam control. In-memory only — see
 * rateLimit.ts. Tune via env in a real multi-instance deployment.
 */
export const RATE_LIMITS = {
  ASK: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 questions / hour
  ANSWER: { max: 15, windowMs: 60 * 60 * 1000 }, // 15 answers / hour
  VOTE: { max: 120, windowMs: 60 * 60 * 1000 },
  REPORT: { max: 30, windowMs: 60 * 60 * 1000 },
} as const;

/** Answer lifecycle states (mirrors QA_FEATURE.md). */
export const ANSWER_STATUS = [
  "pending_review",
  "approved",
  "rejected",
  "needs_admin_review",
  "hidden",
  "deleted",
] as const;
export type AnswerStatus = (typeof ANSWER_STATUS)[number];

/**
 * Question lifecycle states.
 *
 * pending_rag     → question saved, awaiting FastAPI /validate-question response
 * approved        → FastAPI approved; shown publicly (treated as "open")
 * rejected_by_rag → FastAPI rejected; hidden from public but kept for admin audit
 * open            → legacy / admin-bypass state
 * closed          → answered / resolved
 * hidden          → admin-hidden
 * deleted         → soft-deleted
 */
export const QUESTION_STATUS = [
  "pending_rag",
  "approved",
  "rejected_by_rag",
  "open",
  "closed",
  "hidden",
  "deleted",
] as const;
export type QuestionStatus = (typeof QUESTION_STATUS)[number];

/** Summary cache states. */
export const SUMMARY_STATUS = ["fresh", "stale", "failed"] as const;
export type SummaryStatus = (typeof SUMMARY_STATUS)[number];

/** AI review decisions. */
export const REVIEW_DECISION = [
  "approve",
  "reject",
  "needs_admin_review",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISION)[number];

/**
 * Identifier reported in `review.model` / `summary.model`. This deployment
 * uses a deterministic rule-based engine in place of the PRD's Python LLM
 * service; swap this (and the implementations in src/lib/ai) for a real model.
 */
export const REVIEW_ENGINE = "rule-based-reviewer-v1";
export const SUMMARY_ENGINE = "rule-based-synthesizer-v1";
