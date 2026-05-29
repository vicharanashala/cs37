/**
 * app/api/community/answers/[answerId]/report/route.ts
 *
 *   POST /api/community/answers/:answerId/report   body: { reason, note? }
 *
 * Flags an answer for moderator attention. One report per student per answer.
 * When an approved answer crosses a report threshold it is moved back to
 * `needs_admin_review` so it leaves public view pending re-moderation.
 */

import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CommunityAnswer, CommunityReport } from "@/models";
import { REPORT_REASONS, type ReportReason } from "@/models/CommunityReport";
import { ok, errors, readJson } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";
import { rateLimit } from "@/lib/community/rateLimit";
import { recomputeQuestionStats, markSummaryStale } from "@/lib/community/service";
import { RATE_LIMITS } from "@/lib/community/constants";

const REPORT_THRESHOLD = 3;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ answerId: string }> }
) {
  const { answerId } = await ctx.params;

  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  const rl = rateLimit(`report:${student.studentId}`, RATE_LIMITS.REPORT);
  if (!rl.allowed) return errors.rateLimited();

  const body = await readJson<{ reason?: string; note?: string }>(req);
  const reason = (body?.reason ?? "other") as ReportReason;
  if (!REPORT_REASONS.includes(reason))
    return errors.badRequest("Invalid report reason");

  await connectDB();
  const answer = await CommunityAnswer.findById(answerId);
  if (!answer) return errors.notFound("Answer not found");

  try {
    await CommunityReport.create({
      answerId,
      questionId: answer.questionId,
      reporterStudentId: student.studentId,
      reason,
      note: (body?.note ?? "").slice(0, 1000),
    });
  } catch {
    // Duplicate report (unique index) — treat as idempotent success.
    return ok({ answerId, reported: true, alreadyReported: true });
  }

  const reportCount = await CommunityReport.countDocuments({ answerId });
  answer.reportCount = reportCount;

  // Auto-pull a heavily-reported approved answer out of public view.
  let pulled = false;
  if (answer.status === "approved" && reportCount >= REPORT_THRESHOLD) {
    answer.status = "needs_admin_review";
    pulled = true;
  }
  await answer.save();

  if (pulled) {
    await recomputeQuestionStats(String(answer.questionId));
    await markSummaryStale(String(answer.questionId));
  }

  return ok({ answerId, reported: true, reportCount, pulledForReview: pulled });
}
