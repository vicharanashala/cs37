/**
 * app/api/chat-suggestion/route.ts
 *
 *   POST /api/chat-suggestion
 *
 * Accepts a question submitted from YakshaChat when the RAG confidence is
 * low (i.e., no good FAQ answer was found). Persists it into the
 * `pending_questions` collection with source = "yaksha_chat" so it appears
 * in the admin panel's FAQ Suggestions tab.
 *
 * Flow:
 *   1. Validate + insert into MongoDB with status "pending", source "yaksha_chat"
 *   2. Return { questionId, status: "pending" } immediately to the client
 *   3. After response is sent, fire POST RAG_API/validate-question
 */

import { after, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { created, errors, readJson } from "@/lib/api";
import ConnectDB from "@/lib/mongoClient";
import { validateQuestion as ragValidate } from "@/lib/ai/ragClient";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function POST(req: NextRequest) {
  const body = await readJson<{
    question?: unknown;
    category?: unknown;
  }>(req);

  if (!body) return errors.badRequest("Invalid JSON body");

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

  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  const result = await db.collection("pending_questions").insertOne({
    question,
    category,
    email: "",
    priority: "normal",
    status: "pending",
    answer: null,
    suggestedAnswer: null,
    promotedToFAQ: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    authorRole: "user",
    initialAnswer: null,
    answeredBy: null,
    answeredByRole: null,
    views: 0,
    replies: [],
    source: "yaksha_chat",
    faqSuggestionStatus: "pending",
  });

  const questionId = String(result.insertedId);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2_000, 5_000, 15_000];

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
          console.log(`[chat-suggestion] RAG validated question ${questionId} → ${ragResult.status}`);
          return;
        }
        lastErr = new Error("ragValidate returned null");
      } catch (err) {
        lastErr = err;
      }
    }
    console.error(
      `[chat-suggestion] RAG validation failed permanently for question ${questionId}:`,
      lastErr
    );
  });

  return created({
    questionId,
    status: "pending",
    message: "Question submitted for FAQ review. Our team will check it and add it to the FAQ if appropriate.",
  });
}