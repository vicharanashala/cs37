/**
 * app/api/community/questions/[questionId]/route.ts
 *
 *   GET /api/community/questions/:questionId
 *
 * Returns the question, its public (approved) answers, the viewer's own
 * answers regardless of status, the current synthesized summary, and what the
 * viewer is allowed to do. Bumps viewCount. A missing/stale summary is
 * regenerated in the background (Next `after()`) so the response stays fast.
 */

import { after, type NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import {
  CommunityAnswer,
  CommunityQuestion,
  CommunityQuestionSummary,
  CommunityVote,
} from "@/models";
import type { ICommunityAnswer, ICommunityQuestion } from "@/models";
import { ok, errors } from "@/lib/api";
import { getStudent, isAdmin } from "@/lib/community/identity";
import { serializeAnswer, serializeQuestion } from "@/lib/community/serialize";
import { ensureSummary } from "@/lib/community/service";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await ctx.params;
  await connectDB();

  const question = await CommunityQuestion.findOneAndUpdate(
    { _id: questionId, status: { $ne: "deleted" } },
    { $inc: { viewCount: 1 } },
    { new: true }
  ).lean<ICommunityQuestion>();
  if (!question) return errors.notFound("Question not found");

  const student = getStudent(req);
  const admin = isAdmin(req);

  // Public (approved) answers, best first.
  const approved = await CommunityAnswer.find({
    questionId,
    status: "approved",
  })
    .sort({ voteScore: -1, createdAt: 1 })
    .lean<ICommunityAnswer[]>();

  // The viewer's own answers (any status) so they can track their submissions.
  const own = student
    ? await CommunityAnswer.find({
        questionId,
        authorStudentId: student.studentId,
        status: { $ne: "deleted" },
      }).lean<ICommunityAnswer[]>()
    : [];

  // Merge unique (own approved answers already appear in `approved`).
  const seen = new Set(approved.map((a) => String(a._id)));
  const merged = [...approved, ...own.filter((a) => !seen.has(String(a._id)))];

  // The viewer's votes on the visible answers.
  const myVotes = new Map<string, number>();
  if (student) {
    const votes = await CommunityVote.find({
      voterStudentId: student.studentId,
      answerId: { $in: merged.map((a) => a._id) },
    }).lean();
    for (const vt of votes) myVotes.set(String(vt.answerId), vt.value);
  }

  const answers = merged.map((a) =>
    serializeAnswer(a as never, {
      studentId: student?.studentId ?? null,
      isAdmin: admin,
      myVote: myVotes.get(String(a._id)) ?? 0,
    })
  );

  // Summary: serve cached if fresh; otherwise regenerate in the background.
  const summaryDoc = await CommunityQuestionSummary.findOne({ questionId }).lean();
  const summaryFresh =
    summaryDoc &&
    summaryDoc.status === "fresh" &&
    summaryDoc.answerVersion === question.approvedAnswerCount;
  if (!summaryFresh && question.approvedAnswerCount > 0) {
    after(async () => {
      try {
        await ensureSummary(questionId, { force: true });
      } catch {
        /* background best-effort */
      }
    });
  }

  return ok({
    question: serializeQuestion(question as never),
    answers,
    summary: summaryDoc
      ? {
          summary: summaryDoc.summary,
          officialNotes: summaryDoc.officialNotes,
          studentTips: summaryDoc.studentTips,
          uncertainties: summaryDoc.uncertainties,
          citations: summaryDoc.citations,
          status: summaryFresh ? "fresh" : "regenerating",
          model: summaryDoc.model,
          generatedAt: summaryDoc.generatedAt,
        }
      : null,
    capabilities: {
      canAnswer: !!student && question.status === "open",
      canVote: !!student,
      canReport: !!student,
      isAuthor: student?.studentId === question.authorStudentId,
      isAdmin: admin,
    },
  });
}
