/**
 * app/api/community/my-contributions/route.ts
 *
 *   GET /api/community/my-contributions
 *
 * The signed-in student's own questions and answers (with review status),
 * powering the "My Contributions" page. Identity comes from the
 * `x-student-id` header.
 */

import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CommunityAnswer, CommunityQuestion } from "@/models";
import type { ICommunityAnswer, ICommunityQuestion } from "@/models";
import { ok, errors } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";
import { serializeAnswer, serializeQuestion } from "@/lib/community/serialize";

export async function GET(req: NextRequest) {
  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  await connectDB();

  const [questions, answers] = await Promise.all([
    CommunityQuestion.find({
      authorStudentId: student.studentId,
      status: { $ne: "deleted" },
    })
      .sort({ createdAt: -1 })
      .lean<ICommunityQuestion[]>(),
    CommunityAnswer.find({
      authorStudentId: student.studentId,
      status: { $ne: "deleted" },
    })
      .sort({ createdAt: -1 })
      .lean<ICommunityAnswer[]>(),
  ]);

  // Map answers to their question titles for display.
  const qTitles = new Map<string, string>();
  const qIds = answers.map((a) => String(a.questionId));
  if (qIds.length) {
    const qs = await CommunityQuestion.find({ _id: { $in: qIds } })
      .select("title")
      .lean<{ _id: unknown; title: string }[]>();
    for (const q of qs) qTitles.set(String(q._id), q.title);
  }

  return ok({
    questions: questions.map((q) => serializeQuestion(q as never)),
    answers: answers.map((a) => ({
      ...serializeAnswer(a as never, { studentId: student.studentId }),
      questionTitle: qTitles.get(String(a.questionId)) ?? "(removed)",
    })),
  });
}
