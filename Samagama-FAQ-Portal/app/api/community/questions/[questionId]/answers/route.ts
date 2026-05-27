/**
 * app/api/community/questions/[questionId]/answers/route.ts
 *
 *   POST /api/community/questions/:questionId/answers
 *
 * Creates an answer as `pending_review` and returns immediately. The AI review
 * runs in the background (Next `after()`), keeping the request fast and making
 * the review architecturally asynchronous, exactly as QA_FEATURE.md describes.
 * The answer never becomes public until review approves it.
 */

import { after, type NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CommunityAnswer, CommunityQuestion } from "@/models";
import type { ICommunityQuestion } from "@/models";
import { created, errors, readJson } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";
import { rateLimit } from "@/lib/community/rateLimit";
import { validateAnswer } from "@/lib/community/validation";
import { runAnswerReview } from "@/lib/community/service";
import { INSTITUTION_ID, RATE_LIMITS } from "@/lib/community/constants";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await ctx.params;

  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  const rl = rateLimit(`answer:${student.studentId}`, RATE_LIMITS.ANSWER);
  if (!rl.allowed)
    return errors.rateLimited("You're answering too fast. Try again later.");

  const body = await readJson(req);
  const v = validateAnswer(body);
  if (!v.ok) return errors.badRequest(v.error);

  await connectDB();
  const question = await CommunityQuestion.findOne({
    _id: questionId,
    status: "open",
  }).lean<ICommunityQuestion>();
  if (!question) return errors.notFound("Question not found or not open");

  const answer = await CommunityAnswer.create({
    institutionId: INSTITUTION_ID,
    questionId,
    authorStudentId: student.studentId,
    body: v.value.body,
    status: "pending_review",
  });

  // Bump activity now; counters update after review.
  await CommunityQuestion.updateOne(
    { _id: questionId },
    { $set: { lastActivityAt: new Date() } }
  );

  // Fire-and-forget review after the response is sent.
  const answerId = String(answer._id);
  after(async () => {
    try {
      await runAnswerReview(answerId);
    } catch {
      /* runAnswerReview already self-heals to needs_admin_review */
    }
  });

  return created({ answerId, status: "pending_review" });
}
