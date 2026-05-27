/**
 * app/api/ask/route.ts
 *
 *   POST /api/ask
 *
 * Accepts a question submitted from /ask, validates it, and persists it
 * into the `pending_questions` collection using the native MongoDB driver
 * (collection.insertOne()) — exactly as shown in the MongoDB documentation.
 *
 * The admin resolve page (/resolve) reads this collection and lets admins
 * answer, reject, or promote questions to the FAQ.
 */

import type { NextRequest } from "next/server";
import { created, errors, readJson } from "@/lib/api";
import  ConnectDB  from "@/lib/mongoClient";

/** The database name to use. Set MONGODB_DB in .env to override. */
// const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function POST(req: NextRequest) {
  const body = await readJson<{
    question?: unknown;
    category?: unknown;
    email?: unknown;
    priority?: unknown;
  }>(req);

  if (!body) return errors.badRequest("Invalid JSON body");

  // ── Validate ──────────────────────────────────────────────────────────────
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 10)
    return errors.badRequest("Question must be at least 10 characters.");
  if (question.length > 2000)
    return errors.badRequest("Question must be at most 2000 characters.");

  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "General";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const priority =
    body.priority === "urgent" ? ("urgent" as const) : ("normal" as const);

  // ── Persist via native MongoDB driver (insertOne) ─────────────────────────
  // Following the MongoDB Node.js driver documentation:
  //   const client = await clientPromise;
  //   const db = client.db("dbName");
  //   await db.collection("collectionName").insertOne({ ... });
  const client = await ConnectDB();
  const db = client.db("RAG_Project");

  const result = await db.collection("pending_questions").insertOne({
    question,
    category,
    email,
    priority,
    status: "pending",
    answer: null,
    suggestedAnswer: null,
    promotedToFAQ: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return created({
    id: String(result.insertedId),
    message: "Your question has been submitted and will be reviewed shortly.",
  });
}
