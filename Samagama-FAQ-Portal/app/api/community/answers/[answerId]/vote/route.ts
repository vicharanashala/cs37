/**
 * app/api/community/answers/[answerId]/vote/route.ts
 *
 *   POST /api/community/answers/:answerId/vote   body: { value: -1 | 0 | 1 }
 *
 * One vote per student per answer (enforced by a unique index). Re-posting
 * updates the vote; value 0 clears it. Only approved answers are votable.
 * A large vote shift can change ranking, so the question summary is marked
 * stale (QA_FEATURE.md: "regenerate when an answer receives many upvotes").
 */

import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CommunityAnswer, CommunityVote } from "@/models";
import type { ICommunityAnswer } from "@/models";
import { ok, errors, readJson } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";
import { rateLimit } from "@/lib/community/rateLimit";
import {
  recomputeAnswerScore,
  recomputeQuestionStats,
  markSummaryStale,
} from "@/lib/community/service";
import { RATE_LIMITS } from "@/lib/community/constants";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ answerId: string }> }
) {
  const { answerId } = await ctx.params;

  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  const rl = rateLimit(`vote:${student.studentId}`, RATE_LIMITS.VOTE);
  if (!rl.allowed) return errors.rateLimited();

  const body = await readJson<{ value?: number }>(req);
  const value = Number(body?.value);
  if (![-1, 0, 1].includes(value))
    return errors.badRequest("value must be -1, 0, or 1");

  await connectDB();
  const answer = await CommunityAnswer.findById(answerId).lean<ICommunityAnswer>();
  if (!answer) return errors.notFound("Answer not found");
  if (answer.status !== "approved")
    return errors.forbidden("Only approved answers can be voted on");

  await CommunityVote.updateOne(
    { answerId, voterStudentId: student.studentId },
    { $set: { value, questionId: answer.questionId } },
    { upsert: true }
  );

  const voteScore = await recomputeAnswerScore(answerId);
  await recomputeQuestionStats(String(answer.questionId));
  await markSummaryStale(String(answer.questionId));

  return ok({ answerId, voteScore, myVote: value });
}
