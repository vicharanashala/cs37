/**
 * src/lib/community/validation.ts
 *
 * Input validation + normalization for community questions and answers.
 * Returns either a typed, cleaned value or a human-readable error string.
 */

import { LIMITS } from "./constants";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface QuestionInput {
  title: string;
  body: string;
  tags: string[];
}

export interface AnswerInput {
  body: string;
}

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .filter((t): t is string => typeof t === "string")
        .map((t) =>
          t
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
        )
        .filter((t) => t.length > 0 && t.length <= LIMITS.TAG_MAX_LEN)
    )
  ).slice(0, LIMITS.TAGS_MAX);
}

export function validateQuestion(body: unknown): Result<QuestionInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const text = typeof b.body === "string" ? b.body.trim() : "";

  if (title.length < LIMITS.TITLE_MIN)
    return {
      ok: false,
      error: `Title must be at least ${LIMITS.TITLE_MIN} characters.`,
    };
  if (title.length > LIMITS.TITLE_MAX)
    return {
      ok: false,
      error: `Title must be at most ${LIMITS.TITLE_MAX} characters.`,
    };
  if (text.length > LIMITS.BODY_MAX)
    return {
      ok: false,
      error: `Details must be at most ${LIMITS.BODY_MAX} characters.`,
    };

  return { ok: true, value: { title, body: text, tags: cleanTags(b.tags) } };
}

export function validateAnswer(body: unknown): Result<AnswerInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = typeof b.body === "string" ? b.body.trim() : "";

  if (text.length < LIMITS.ANSWER_MIN)
    return {
      ok: false,
      error: `Answer must be at least ${LIMITS.ANSWER_MIN} characters.`,
    };
  if (text.length > LIMITS.ANSWER_MAX)
    return {
      ok: false,
      error: `Answer must be at most ${LIMITS.ANSWER_MAX} characters.`,
    };

  return { ok: true, value: { body: text } };
}
