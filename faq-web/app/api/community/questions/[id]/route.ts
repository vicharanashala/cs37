/**
 * app/api/community/questions/[id]/route.ts
 *
 * GET /api/community/questions/:id
 *
 * Returns a single question (from pending_questions) shaped as the
 * QuestionDTO + AnswerDTO[] + Capabilities that the detail page expects.
 *
 * The question lives in `pending_questions` (same collection as the thread
 * list). Replies stored on the document are mapped to AnswerDTOs so the
 * detail page can render them with votes, citations, etc.
 */

import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors } from "@/lib/api";
import { getStudent, isAdmin } from "@/lib/community/identity";
import type { Reply } from "@/lib/community/threadModel";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate the id is a 24-char hex ObjectId.
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return errors.notFound("Question not found");
  }

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);
    const col = db.collection("pending_questions");

    const doc = await col.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        status: { $in: ["approved", "open", "resolved"] },
      },
      { $inc: { views: 1 } },
      { returnDocument: "after" }
    );

    if (!doc) {
      return errors.notFound("Question not found");
    }

    const student = getStudent(req);
    const admin = isAdmin(req);

    // Map the document to the QuestionDTO shape the frontend expects.
    const question = {
      id: String(doc._id),
      title: (doc.question as string) ?? "",
      body: (doc.question as string) ?? "",   // pending_questions has no separate body
      tags: doc.category ? [doc.category as string] : [],
      status: doc.status as string,
      authorStudentId: (doc.email as string) ?? "anonymous",
      acceptedAnswerId: null,
      approvedAnswerCount: 0,
      viewCount: (doc.views as number) ?? 0,
      voteScore: 0,
      lastActivityAt: String(doc.createdAt ?? new Date()),
      createdAt: String(doc.createdAt ?? new Date()),
    };

    // Map replies → AnswerDTOs, splitting out the bot reply.
    const rawReplies: Reply[] = (doc.replies as Reply[]) ?? [];
    const visibleReplies = rawReplies.filter((r) => {
      if (r.status === "rejected") return false;
      if (r.status === "pending") {
        // Author can see their own pending; admin sees all.
        return admin || (!!student && r.author === student.studentId);
      }
      return true; // approved / undefined (legacy)
    });

    // Separate the AI bot reply from human replies.
    const botReply = visibleReplies.find((r) => r.authorRole === "bot");
    const humanReplies = visibleReplies.filter((r) => r.authorRole !== "bot");

    const toAnswerDTO = (r: Reply, idx: number) => ({
      id: r.id ?? String(idx),
      questionId: id,
      body: r.content,
      status: r.status ?? "approved",
      authorStudentId: r.author,
      isMine: !!student && r.author === student.studentId,
      voteScore: r.likes ?? 0,
      myVote: 0,
      reportCount: admin ? 0 : undefined,
      citations: Array.isArray(r.sources)
        ? r.sources.map((s) => ({
            documentId: s.url ?? "",
            title: s.title ?? "",
            section: "",
            version: "",
            snippet: s.snippet ?? "",
            score: s.score ?? 0,
          }))
        : [],
      createdAt: r.timestamp ?? String(doc.createdAt ?? new Date()),
    });

    const answers = humanReplies.map((r, idx) => toAnswerDTO(r, idx));

    // Shape the bot reply as a SuggestedAnswerDTO if one exists.
    const suggestedAnswer = botReply ? toAnswerDTO(botReply, -1) : null;
    const suggestedAnswerStatus = botReply ? "ready" : "unavailable";

    // Capabilities: anonymous users can read; auth needed to answer/vote.
    const capabilities = {
      canAnswer: true,
      canVote: !!student,
      canReport: !!student,
      isAuthor:
        !!student && (doc.email as string) === student.studentId,
      isAdmin: admin,
    };

    return ok({
      question,
      answers,
      suggestedAnswer,
      suggestedAnswerStatus,
      summary: null,
      capabilities,
    });
  } catch (err) {
    console.error("[/api/community/questions/:id] Query failed:", err);
    return errors.server("Failed to fetch question");
  }
}
