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
import { ObjectId } from "mongodb";
import { created, errors, readJson } from "@/lib/api";
import ConnectDB from "@/lib/mongoClient";
import { validateQuestion as ragValidate } from "@/lib/ai/ragClient";
import { generateBotReply } from "@/lib/community/botReply";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

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
  const db = client.db(DB_NAME);

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
    // Unified community thread fields
    authorRole: "user",
    initialAnswer: null,
    answeredBy: null,
    answeredByRole: null,
    views: 0,
    replies: [],
  });

  const questionId = String(result.insertedId);

  // ── Step 2: Fire FastAPI RAG validation after the response is sent ─────────
  // FastAPI will call MongoDB directly to update status → "approved" or
  // "rejected_by_rag" and write ragValidation details. This app does not
  // need to poll or wait. On failure, retry up to MAX_RETRIES with backoff.
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2_000, 5_000, 15_000]; // 2s, 5s, 15s

  after(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
      }
      try {
        const ragResult = await ragValidate({
          question_id: questionId,
          question_text: question,
          category,
          institution_id: process.env.INSTITUTION_ID ?? "iit-ropar-vicharanashala",
        });
        if (ragResult !== null) {
          console.log(`[ask/route] RAG validated question ${questionId} → ${ragResult.status}`);
          // Once approved, generate the AI helper-bot answer and store it as a
          // reply on the question so it shows on the community page.
          if (ragResult.status === "approved") {
            try {
              await generateBotReply({
                questionId,
                questionText: question,
                category,
              });
            } catch (botErr) {
              console.error(
                `[ask/route] Bot reply generation failed for ${questionId}:`,
                botErr
              );
            }
          }
          return; // success
        }
        // null = network/timeout error, retry
        lastErr = new Error("ragValidate returned null");
      } catch (err) {
        lastErr = err;
      }
    }

    // All retries exhausted — mark as needing manual review so it doesn't get stuck
    console.error(
      `[ask/route] RAG validation failed permanently for question ${questionId}:`,
      lastErr
    );
    try {
      const client = await ConnectDB();
      await client.db(DB_NAME).collection("pending_questions").updateOne(
        { _id: new ObjectId(questionId) },
        { $set: { status: "pending_manual_review", updatedAt: new Date() } }
      );
    } catch (dbErr) {
      console.error(`[ask/route] Failed to mark question ${questionId} for manual review:`, dbErr);
    }
  });

  return created({
    questionId,
    status: "pending",
    message:
      "Your question has been submitted. Our AI system is reviewing it — it will appear publicly once approved.",
  });
}
