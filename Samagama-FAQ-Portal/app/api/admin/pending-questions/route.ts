/**
 * app/api/admin/pending-questions/route.ts
 *
 *   GET  /api/admin/pending-questions          — list pending questions for admin review
 *   POST /api/admin/pending-questions          — resolve or reject a pending question
 *
 * Admin-gated via `x-admin-key` header.
 *
 * The resolve/reject action updates the status and records the answer text
 * when resolving so it can later be promoted to a FAQ entry.
 */

import type { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/mongodb";
import { ok, errors, readJson } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";

const COLLECTION = "pending_questions";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const client = await connectDB();
  const db = client.db("RAG_Project");
  const sp = req.nextUrl.searchParams;
  const filterStatus = sp.get("status") ?? "pending";

  const query: Record<string, unknown> = {};
  if (filterStatus !== "all") query.status = filterStatus;

  const items = await db
    .collection(COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const total = await db.collection(COLLECTION).countDocuments(query);

  return ok({
    questions: items.map((doc) => ({
      id: String(doc._id),
      question: doc.question,
      category: doc.category,
      email: doc.email,
      priority: doc.priority,
      status: doc.status,
      answer: doc.answer ?? null,
      suggestedAnswer: doc.suggestedAnswer ?? null,
      submittedAt: doc.createdAt,
    })),
    total,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const body = await readJson<{
    id?: string;
    action?: string;
    answer?: string;
  }>(req);
  if (!body?.id || !body?.action) {
    return errors.badRequest("id and action are required");
  }

  const { id, action, answer } = body;
  if (action !== "resolve" && action !== "reject") {
    return errors.badRequest("action must be 'resolve' or 'reject'");
  }
  if (action === "resolve" && (!answer || !answer.trim())) {
    return errors.badRequest("answer text is required when resolving");
  }

  const client = await connectDB();
  const db = client.db("RAG_Project");

  const update: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (action === "resolve") {
    update.status = "resolved";
    update.answer = answer.trim();
    update.resolvedAt = new Date();
    update.resolvedBy = req.headers.get("x-admin-key") ?? "admin";
  } else {
    update.status = "rejected";
    update.resolvedAt = new Date();
    update.resolvedBy = req.headers.get("x-admin-key") ?? "admin";
  }

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result) return errors.notFound("Question not found");

  return ok({
    id: String(result._id),
    status: result.status,
    message:
      action === "resolve"
        ? "Question resolved successfully"
        : "Question rejected",
  });
}