/**
 * app/api/community/questions/[id]/answers/route.ts
 *
 * POST /api/community/questions/:id/answers
 *
 * Appends a student reply to the pending_questions document's replies array.
 * Delegates to the same pattern as threads/[id]/replies/route.ts so the two
 * inboxes stay consistent.
 */

import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return errors.notFound("Question not found");
  }

  let body: { body?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Invalid request body");
  }

  const content = body?.body?.trim();
  if (!content || content.length < 5) {
    return errors.badRequest("Answer body must be at least 5 characters");
  }

  const student = getStudent(req);
  const authorEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const author = authorEmail || student?.studentId || "anonymous";

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);
    const col = db.collection("pending_questions");

    const reply = {
      id: new ObjectId().toHexString(),
      author,
      authorEmail,
      authorRole: "user",
      content,
      timestamp: new Date().toISOString(),
      likes: 0,
      status: "pending",
    };

    const result = await col.updateOne(
      {
        _id: new ObjectId(id),
        status: { $in: ["approved", "open", "resolved"] },
      },
      { $push: { replies: reply as never } }
    );

    if (result.matchedCount === 0) {
      return errors.notFound("Question not found");
    }

    return ok({ answer: { ...reply, questionId: id } });
  } catch (err) {
    console.error("[/api/community/questions/:id/answers] Failed:", err);
    return errors.server("Failed to submit answer");
  }
}
