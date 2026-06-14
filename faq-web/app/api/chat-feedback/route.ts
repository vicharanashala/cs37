/**
 * app/api/chat-feedback/route.ts
 *
 *   POST /api/chat-feedback
 *
 * Public endpoint that logs user feedback (thumbs up/down) for Yaksha Chat.
 */

import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors, readJson } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";
const COLLECTION = "chat_feedback";

export async function POST(req: NextRequest) {
  const body = await readJson<{
    question?: unknown;
    answer?: unknown;
    feedback?: unknown;
    sources?: unknown;
    confidence?: unknown;
  }>(req);

  if (!body) return errors.badRequest("Invalid JSON body");

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  const confidence = typeof body.confidence === "number" ? body.confidence : 0.0;
  const sources = Array.isArray(body.sources) ? body.sources.map(String) : [];

  if (!question) return errors.badRequest("question is required");
  if (!answer) return errors.badRequest("answer is required");
  if (!["up", "down"].includes(feedback)) {
    return errors.badRequest("feedback must be 'up' or 'down'");
  }

  const student = getStudent(req);
  const studentId = student?.studentId ?? "anonymous";

  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  await db.collection(COLLECTION).insertOne({
    studentId,
    question,
    answer,
    feedback,
    sources,
    confidence,
    createdAt: new Date(),
  });

  return ok({ message: "Feedback logged successfully" });
}
