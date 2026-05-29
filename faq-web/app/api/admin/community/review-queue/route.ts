/**
 * app/api/admin/community/review-queue/route.ts
 *
 *   GET /api/admin/community/review-queue
 *
 * Answers awaiting human moderation: everything the AI sent to
 * `needs_admin_review`, plus (optionally) recently rejected answers for audit.
 * Each item carries the question, the LLM decision/reasons, and retrieved
 * citations so the moderator has full context. Admin-gated via `x-admin-key`.
 */

import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CommunityAnswer, CommunityQuestion } from "@/models";
import type { ICommunityAnswer, ICommunityQuestion } from "@/models";
import { ok, errors } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";
import { serializeAnswer } from "@/lib/community/serialize";
import { INSTITUTION_ID, type AnswerStatus } from "@/lib/community/constants";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const includeRejected = sp.get("includeRejected") === "1";

  const statuses: AnswerStatus[] = includeRejected
    ? ["needs_admin_review", "rejected"]
    : ["needs_admin_review"];

  const answers = await CommunityAnswer.find({
    institutionId: INSTITUTION_ID,
    status: { $in: statuses },
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean<ICommunityAnswer[]>();

  // Attach the parent question to each queued answer.
  const qIds = Array.from(new Set(answers.map((a) => String(a.questionId))));
  const questions = await CommunityQuestion.find({ _id: { $in: qIds } })
    .lean<ICommunityQuestion[]>();
  const qMap = new Map(questions.map((q) => [String(q._id), q]));

  const items = answers.map((a) => {
    const q = qMap.get(String(a.questionId));
    return {
      answer: serializeAnswer(a as never, { isAdmin: true }),
      question: q
        ? { id: String(q._id), title: q.title, body: q.body, tags: q.tags }
        : null,
    };
  });

  return ok({ queue: items, count: items.length });
}
