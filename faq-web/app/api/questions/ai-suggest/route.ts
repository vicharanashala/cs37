/**
 * app/api/questions/ai-suggest/route.ts
 *
 *   POST /api/questions/ai-suggest — suggest a reply based on FAQ keyword matching
 *
 * Body: { question: string }
 *
 * Uses simple keyword similarity (Jaccard + TF overlap) from existing FAQ data.
 * No paid APIs. Returns a Yaksha-formatted reply or "No matching FAQ found."
 */

import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors, readJson } from "@/lib/api";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

function keywordOverlap(queryTokens: string[], faqTokens: string[]): number {
  const faqSet = new Set(faqTokens);
  if (queryTokens.length === 0) return 0;
  const matches = queryTokens.filter((t) => faqSet.has(t));
  return matches.length / queryTokens.length;
}

function generateYakshaReply(
  question: string,
  faqQuestion: string,
  faqAnswer: string,
  _confidence: number,
): string {
  const shortIssue = question.length > 120 ? question.slice(0, 117) + "..." : question;

  return `Regarding "${shortIssue}": ${faqAnswer.trim()} This answer was sourced from the FAQ database (matched: "${faqQuestion}"). Please review and edit before submitting.`;
}

export async function POST(req: NextRequest) {
  const body = await readJson<{ question?: string }>(req);
  if (!body?.question || !body.question.trim()) {
    return errors.badRequest("question is required");
  }

  const userQuestion = body.question.trim();
  const queryTokens = tokenize(userQuestion);

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);
    const faqs = await db
      .collection("faqs")
      .find({ isPublished: { $ne: false } })
      .toArray();

    if (faqs.length === 0) {
      return ok({
        found: false,
        message: "No matching FAQ found. Manual review required.",
      });
    }

    let bestScore = 0;
    let bestFaq: (typeof faqs)[0] | null = null;

    for (const faq of faqs) {
      const faqText = [
        (faq.question as string) ?? "",
        (faq.answer as string) ?? "",
        ...(((faq.tags as string[]) ?? [])),
        ...(((faq.keywords as string[]) ?? [])),
      ].join(" ");
      const faqTokens = tokenize(faqText);

      const jac = jaccardSimilarity(queryTokens, faqTokens);
      const kwOverlap = keywordOverlap(queryTokens, faqTokens);

      // Weighted score: 40% Jaccard + 60% keyword overlap
      const score = 0.4 * jac + 0.6 * kwOverlap;

      if (score > bestScore) {
        bestScore = score;
        bestFaq = faq;
      }
    }

    const confidence = Math.round(bestScore * 100);

    if (confidence < 30 || !bestFaq) {
      return ok({
        found: false,
        message: "No matching FAQ found. Manual review required.",
      });
    }

    const suggestedReply = generateYakshaReply(
      userQuestion,
      bestFaq.question as string,
      bestFaq.answer as string,
      confidence,
    );

    return ok({
      found: true,
      confidence,
      matchedFaqId: bestFaq.id as string,
      matchedFaqQuestion: bestFaq.question as string,
      matchedFaqCategory: bestFaq.category as string,
      suggestedReply,
    });
  } catch (err) {
    console.error("[/api/questions/ai-suggest] failed:", err);
    return errors.server("Failed to generate suggestion");
  }
}
