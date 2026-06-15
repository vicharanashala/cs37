/**
 * app/api/ai/resolve-assistant/route.ts
 *
 *   POST /api/ai/resolve-assistant — help admin resolve a question
 *
 * Uses a two-layer approach:
 *   1. FAQ keyword matching (same knowledge as Yaksha's FAQ data)
 *   2. RAG generate-answer fallback (Gemini + web search)
 *
 * Returns Yaksha-style formatted replies.
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

function formatFaqReply(question: string, faqQuestion: string, faqAnswer: string): string {
  const shortQuestion = question.length > 120 ? question.slice(0, 117) + "..." : question;
  return `Regarding "${shortQuestion}": This relates to a commonly addressed topic (matched FAQ: "${faqQuestion}"). ${faqAnswer.trim()} This answer was sourced from the FAQ database. Please review before submitting.`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  const body = await readJson<{ question?: string }>(req);
  if (!body?.question || body.question.trim().length < 5) {
    return errors.badRequest("Question must be at least 5 characters");
  }

  const question = body.question.trim();
  const queryTokens = tokenize(question);

  // Layer 1: FAQ keyword matching
  try {
    const client = await ConnectDB();
    const db = client.db(DB_NAME);
    const faqs = await db
      .collection("faqs")
      .find({ isPublished: { $ne: false } })
      .toArray();

    if (faqs.length > 0) {
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
        const score = 0.4 * jac + 0.6 * kwOverlap;

        if (score > bestScore) {
          bestScore = score;
          bestFaq = faq;
        }
      }

      const confidence = Math.round(bestScore * 100);

      if (confidence >= 30 && bestFaq) {
        const answer = formatFaqReply(question, bestFaq.question as string, bestFaq.answer as string);
        return ok({
          answer,
          sources: [{ title: bestFaq.question as string, snippet: (bestFaq.answer as string).slice(0, 150) }],
          model: "faq-matching",
          confidence,
        });
      }
    }
  } catch (err) {
    console.error("[resolve-assistant] FAQ matching failed, falling back to RAG:", err);
  }

  // Layer 2: RAG generate-answer fallback
  try {
    const RAG_BASE = process.env.RAG_API ?? "http://localhost:8000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(`${RAG_BASE}/generate-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: `resolve-${Date.now()}`,
        question_text: question,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return ok({
        answer: stripMarkdown(data.answer),
        sources: (data.sources ?? []).map((s: { title: string; snippet: string }) => ({
          title: s.title,
          snippet: s.snippet,
        })),
        model: data.model ?? "rag-generate",
      });
    }
  } catch (err) {
    console.error("[resolve-assistant] RAG generate-answer failed:", err);
  }

  // Final fallback: simple FAQ search
  try {
    const client = await ConnectDB();
    const db = client.db(DB_NAME);
    const words = question.split(/\s+/).filter((w) => w.length > 2);

    if (words.length > 0) {
      const regex = words
        .map((w) => `(?=.*${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`)
        .join("");

      const faqs = await db
        .collection("faqs")
        .find({
          isPublished: { $ne: false },
          $or: [
            { question: { $regex: regex, $options: "i" } },
            { answer: { $regex: regex, $options: "i" } },
          ],
        })
        .limit(3)
        .toArray();

      if (faqs.length > 0) {
        const answer = faqs
          .map((f) => `Q: ${f.question as string}\nA: ${f.answer as string}`)
          .join("\n\n---\n\n");
        return ok({
          answer,
          sources: faqs.map((f) => ({
            title: f.question as string,
            snippet: (f.answer as string).slice(0, 150),
          })),
          model: "faq-keyword-fallback",
        });
      }
    }
  } catch (err) {
    console.error("[resolve-assistant] FAQ keyword fallback failed:", err);
  }

  return ok({
    answer: "I couldn't find a relevant answer in the FAQ database or knowledge base. Try rephrasing your question or check the FAQ page for existing answers.",
    sources: [],
    model: "no-match",
  });
}
