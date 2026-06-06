import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CommunityQuestion, CommunityAnswer } from "@/models";
import type { ICommunityQuestion, ICommunityAnswer } from "@/models";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";
import type { Reply } from "@/lib/community/threadModel";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function GET(req: NextRequest) {
  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  const email = req.headers.get("x-student-email") ?? "";

  await connectDB();

  const myQuestions = await CommunityQuestion.find({
    authorStudentId: student.studentId,
    status: { $ne: "deleted" },
  })
    .select("_id title approvedAnswerCount lastActivityAt createdAt")
    .lean<ICommunityQuestion[]>();

  const myAnswers = await CommunityAnswer.find({
    authorStudentId: student.studentId,
    status: { $ne: "deleted" },
  })
    .select("_id questionId status voteScore")
    .lean<ICommunityAnswer[]>();

  const qIds = myAnswers.map((a) => String(a.questionId));
  const qTitles = new Map<string, string>();
  if (qIds.length) {
    const qs = await CommunityQuestion.find({ _id: { $in: qIds } })
      .select("_id title")
      .lean<{ _id: unknown; title: string }[]>();
    for (const q of qs) qTitles.set(String(q._id), q.title);
  }

  type ThreadDoc = {
    _id: unknown;
    question: string;
    email?: string;
    replies?: Reply[];
  };

  let threadReplies: {
    id: string;
    questionTitle: string;
    replyCount: number;
    lastReplyTime: string;
  }[] = [];

  if (email) {
    try {
      const client = await ConnectDB();
      const db = client.db(DB_NAME);
      const threads = await db
        .collection("pending_questions")
        .find({ email: email.toLowerCase().trim() })
        .project({ _id: 1, question: 1, replies: 1 })
        .toArray() as ThreadDoc[];

      threadReplies = threads
        .map((t) => {
          const validReplies = (t.replies ?? []).filter(
            (r) => r.status !== "rejected"
          );
          return {
            id: String(t._id),
            questionTitle: t.question,
            replyCount: validReplies.length,
            lastReplyTime:
              validReplies.slice(-1)[0]?.timestamp ?? new Date().toISOString(),
          };
        })
        .filter((t) => t.replyCount > 0);
    } catch {
      // Non-fatal
    }
  }

  return ok({
    questions: myQuestions.map((q) => ({
      id: String(q._id),
      title: q.title,
      approvedAnswerCount: q.approvedAnswerCount ?? 0,
      lastActivityAt: String(q.lastActivityAt ?? q.createdAt ?? ""),
    })),
    answers: myAnswers.map((a) => ({
      id: String(a._id),
      questionId: String(a.questionId),
      questionTitle: qTitles.get(String(a.questionId)) ?? "(removed)",
      status: a.status,
      voteScore: a.voteScore ?? 0,
    })),
    threadReplies,
  });
}
