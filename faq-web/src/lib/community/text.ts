/**
 * src/lib/community/text.ts
 *
 * Pure text utilities shared by validation, duplicate detection, and the
 * rule-based AI engine (relevance / grounding). No DB or framework imports so
 * it stays trivially testable.
 */

import { createHash } from "node:crypto";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "for",
  "is", "are", "am", "be", "been", "do", "does", "did", "i", "you", "my",
  "me", "we", "it", "this", "that", "these", "those", "how", "what", "when",
  "where", "why", "who", "can", "could", "would", "should", "will", "with",
  "as", "at", "by", "from", "about", "into", "than", "then", "so", "not",
  "no", "yes", "have", "has", "had", "get", "got", "there", "their", "your",
]);

/** Lowercase, collapse whitespace, strip surrounding punctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable normalized form of a question title for duplicate detection. */
export function normalizeTitle(title: string): string {
  return normalize(title)
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** SHA-1 hash of the normalized title — cheap exact-duplicate guard. */
export function questionHash(title: string): string {
  return createHash("sha1").update(normalizeTitle(title)).digest("hex");
}

/** Tokenize to lowercase content words, dropping stopwords and short tokens. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Unique token set. */
export function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/**
 * Coverage of `query` tokens found in `target`, in [0,1].
 * Asymmetric on purpose: "how many of the question's keywords does the answer
 * touch" is more meaningful here than symmetric Jaccard similarity.
 */
export function coverage(query: string, target: string): number {
  const q = tokenSet(query);
  if (q.size === 0) return 0;
  const t = tokenSet(target);
  let hits = 0;
  for (const tok of q) if (t.has(tok)) hits += 1;
  return hits / q.size;
}

/** Symmetric Jaccard similarity of two texts in [0,1]. */
export function jaccard(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const tok of sa) if (sb.has(tok)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** First N sentences of a block of text, trimmed. */
export function firstSentences(text: string, n = 1): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]?/g);
  if (!sentences) return text.trim();
  return sentences.slice(0, n).join(" ").trim();
}
