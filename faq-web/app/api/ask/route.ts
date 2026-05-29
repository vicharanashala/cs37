/**
 * app/api/ask/route.ts
 *
 *   POST /api/ask
 *
 * Accepts a question submitted from /ask, validates it, and persists it
 * into the `pending_questions` collection using the native MongoDB driver.
 *
 * Flow:
 *   1. Validate + insert into MongoDB with status "pending"
 *   2. Return { questionId, status: "pending" } immediately to the client
 *   3. After response is sent, fire POST RAG_API/validate-question
 *      FastAPI updates the document's status directly in MongoDB.
 *      (approved / rejected_by_rag written by FastAPI, not by this route)
 *
 * The resolve page (/resolve) reads this collection and lets admins see
 * all questions including pending_rag ones for the full audit trail.
 */

import { after, type NextRequest } from "next/server";
import { created, errors, readJson } from "@/lib/api";
import ConnectDB from "@/lib/mongoClient";
import { validateQuestion as ragValidate } from "@/lib/ai/ragClient";

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

  // ── Step 1: Persist via native MongoDB driver (insertOne) ─────────────────
  const client = await ConnectDB();
  const db = client.db("RAG_Project");

  const result = await db.collection("pending_questions").insertOne({
    question,
    category,
    email,
    priority,
    // "pending" = received, not yet validated by RAG.
    status: "pending",
    answer: null,
    suggestedAnswer: null,
    promotedToFAQ: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const questionId = String(result.insertedId);

  // ── Step 2: Fire FastAPI RAG validation after the response is sent ─────────
  // FastAPI will call MongoDB directly to update status → "approved" or
  // "rejected_by_rag" and write ragValidation details. This app does not
  // need to poll or wait.
  after(async () => {
    try {
      await ragValidate({
        question_id: questionId,
        question_text: question,
        category,
        institution_id: process.env.INSTITUTION_ID ?? "iit-ropar-vicharanashala",
      });
    } catch (err) {
      // Non-fatal — question stays "pending" for manual admin review.
      console.error(
        `[ask/route] RAG validation fire failed for question ${questionId}:`,
        err
      );
    }
  });

  return created({
    questionId,
    status: "pending",
    message:
      "Your question has been submitted. Our AI system is reviewing it — it will appear publicly once approved.",
  });
}
