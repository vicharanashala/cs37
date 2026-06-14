/**
 * app/api/admin/chat-feedback/route.ts
 *
 *   GET    /api/admin/chat-feedback  — List chat feedback for admin review
 *   DELETE /api/admin/chat-feedback  — Dismiss (delete) a chat feedback record
 *
 * Admin-gated via `x-admin-key` header.
 */

import type { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";
const COLLECTION = "chat_feedback";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  const items = await db
    .collection(COLLECTION)
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const total = await db.collection(COLLECTION).countDocuments({});

  return ok({
    feedback: items.map((doc) => ({
      id: String(doc._id),
      studentId: doc.studentId as string,
      question: doc.question as string,
      answer: doc.answer as string,
      feedback: doc.feedback as "up" | "down",
      sources: (doc.sources as string[] | undefined) ?? [],
      confidence: (doc.confidence as number | undefined) ?? 0.0,
      createdAt: doc.createdAt,
    })),
    total,
  });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  if (!id) return errors.badRequest("id parameter is required");

  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  const res = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
  if (res.deletedCount === 0) {
    return errors.notFound("Feedback record not found");
  }

  return ok({ message: "Feedback record deleted successfully" });
}
