/**
 * src/lib/ai/retrieval.ts
 *
 * Institutional grounding / retrieval.
 *
 * QA_FEATURE.md grounds policy answers against a Vector DB of official
 * documents. This deployment's authoritative corpus is the published FAQ
 * collection, so we retrieve from it using the existing Mongo `$text` index
 * (with a keyword fallback). Each FAQ maps to a citation shaped exactly like
 * the doc's `citations[]`. Swap this module for a real vector search later;
 * the `retrieveOfficialSources()` contract stays the same.
 *
 * Crucially this only ever reads OFFICIAL FAQ documents — student-generated
 * community content is never mixed into the institutional corpus.
 */

import { FAQ } from "@/models";
import type { ICitation } from "@/models";
import { firstSentences, tokenize } from "@/lib/community/text";

interface FAQLean {
  faqId: string;
  question: string;
  answer: string;
  category: string;
  lastUpdated: string;
  score?: number;
}

/**
 * Retrieve the top official FAQ chunks relevant to `query`.
 * Tries Mongo full-text search first, then falls back to keyword regex so it
 * still works on small/unindexed datasets.
 */
export async function retrieveOfficialSources(
  query: string,
  limit = 4
): Promise<ICitation[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let docs: FAQLean[] = [];

  try {
    docs = await FAQ.find(
      { $text: { $search: trimmed }, isPublished: true },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean<FAQLean[]>();
  } catch {
    // text index may be missing on a fresh DB — fall through to keyword search
    docs = [];
  }

  if (docs.length === 0) {
    const tokens = tokenize(trimmed).slice(0, 8);
    if (tokens.length > 0) {
      const rx = tokens.map((t) => new RegExp(escapeRegex(t), "i"));
      docs = await FAQ.find({
        isPublished: true,
        $or: [{ question: { $in: rx } }, { answer: { $in: rx } }, { tags: { $in: tokens } }],
      })
        .limit(limit)
        .lean<FAQLean[]>();
    }
  }

  return docs.map((d) => toCitation(d, trimmed));
}

/** Normalize a raw textScore (unbounded) into a 0..1 confidence. */
function normScore(raw: number | undefined): number {
  if (!raw || raw <= 0) return 0;
  // Mongo textScore is typically ~0.5–3 for short queries; squash to [0,1].
  return Math.min(1, Number((raw / 3).toFixed(2)));
}

function toCitation(d: FAQLean, query: string): ICitation {
  return {
    documentId: d.faqId,
    title: d.question,
    section: d.category,
    version: d.lastUpdated,
    snippet: firstSentences(d.answer, 2),
    // when we used the keyword fallback there is no textScore — give a modest
    // default so callers can still distinguish "found" from "nothing".
    score: d.score !== undefined ? normScore(d.score) : keywordScore(d, query),
  };
}

function keywordScore(d: FAQLean, query: string): number {
  const q = new Set(tokenize(query));
  const t = new Set(tokenize(`${d.question} ${d.answer}`));
  let hits = 0;
  for (const tok of q) if (t.has(tok)) hits += 1;
  return q.size ? Number(Math.min(1, hits / q.size).toFixed(2)) : 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
