/**
 * app/api/ai/review-community-answer/route.ts
 *
 *   POST /review-community-answer  (QA_FEATURE.md → owned by the AI service)
 *
 * In the PRD this lives in a separate Python service. Here it is the AI-service
 * boundary inside the same app: a thin HTTP wrapper over the rule-based review
 * engine. The product layer (service.ts) calls the engine directly for
 * reliability, but exposing it as an endpoint keeps the documented contract
 * real and independently testable. Gated by `x-admin-key` so it isn't a public
 * abuse surface.
 */

import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ok, errors, readJson } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";
import {
  reviewCommunityAnswer,
  type ReviewInput,
} from "@/lib/ai/communityReview";

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("AI service is internal");

  const body = await readJson<Partial<ReviewInput>>(req);
  if (!body?.question?.title || typeof body.answer !== "string")
    return errors.badRequest("question.title and answer are required");

  await connectDB(); // grounding retrieval reads the FAQ corpus
  const result = await reviewCommunityAnswer({
    institutionId: body.institutionId ?? "default",
    question: {
      title: body.question.title,
      body: body.question.body ?? "",
      tags: body.question.tags ?? [],
    },
    answer: body.answer,
    studentContext: body.studentContext ?? { role: "student" },
  });

  return ok({ ...result });
}
