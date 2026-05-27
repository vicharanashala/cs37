/**
 * app/api/ai/generate-community-summary/route.ts
 *
 *   POST /generate-community-summary  (QA_FEATURE.md → owned by the AI service)
 *
 * AI-service boundary for the RAG summary, mirroring review-community-answer.
 * Thin wrapper over the rule-based synthesizer; the product layer normally
 * calls it through ensureSummary(). Gated by `x-admin-key`.
 */

import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ok, errors, readJson } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";
import {
  generateCommunitySummary,
  type SummaryInput,
} from "@/lib/ai/communitySummary";

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("AI service is internal");

  const body = await readJson<Partial<SummaryInput>>(req);
  if (!body?.question?.title || !Array.isArray(body.answers))
    return errors.badRequest("question.title and answers[] are required");

  await connectDB(); // grounding retrieval reads the FAQ corpus
  const result = await generateCommunitySummary({
    institutionId: body.institutionId ?? "default",
    question: {
      title: body.question.title,
      body: body.question.body ?? "",
      tags: body.question.tags ?? [],
    },
    answers: body.answers,
  });

  return ok({ ...result });
}
