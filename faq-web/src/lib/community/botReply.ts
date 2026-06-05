/**
 * src/lib/community/botReply.ts
 *
 * Generates the AI helper-bot answer for a community question and stores it as
 * a reply on the question document in the `pending_questions` collection.
 *
 * This is the unified flow: the community page reads `pending_questions`, so the
 * bot answer lives there alongside the human replies (just with authorRole
 * "bot" so the UI can style it apart). Called from the /api/ask after() hook
 * once FastAPI has approved a question.
 *
 * Idempotent: a question never gets more than one bot reply.
 */

import { randomUUID } from "node:crypto";
import { ObjectId, type Document, type UpdateFilter } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { generateBotAnswer } from "@/lib/ai/ragClient";
import { INSTITUTION_ID } from "@/lib/community/constants";
import type { Reply } from "@/lib/community/threadModel";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

/** Display name shown on the AI helper reply. */
export const BOT_AUTHOR = "Yaksha AI";

/** Format a Date as "YYYY-MM-DD HH:MM" to match the other reply timestamps. */
function formatTimestamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Generate and persist one AI helper-bot reply for a question. No-op if the
 * question already has a bot reply or the RAG service returns nothing.
 */
export async function generateBotReply(opts: {
  questionId: string;
  questionText: string;
  category?: string;
}): Promise<void> {
  const { questionId, questionText, category } = opts;

  const client = await ConnectDB();
  const coll = client.db(DB_NAME).collection("pending_questions");

  // Idempotent guard — never attach a second bot reply.
  const already = await coll.findOne(
    { _id: new ObjectId(questionId), "replies.authorRole": "bot" },
    { projection: { _id: 1 } }
  );
  if (already) return;

  const result = await generateBotAnswer({
    question_id: questionId,
    question_text: questionText,
    category,
    institution_id: INSTITUTION_ID,
  });
  if (!result) return;

  const reply: Reply = {
    id: `bot-${randomUUID().slice(0, 8)}`,
    author: BOT_AUTHOR,
    authorRole: "bot",
    content: result.answer,
    timestamp: formatTimestamp(new Date()),
    likes: 0,
    status: "approved",
    sources: result.sources.map((s) => ({
      type: s.type,
      title: s.title,
      url: s.url,
      snippet: s.snippet,
      score: s.score,
    })),
  };

  // The collection is untyped (native driver), so $push on the nested array
  // isn't expressible in the generic UpdateFilter — build it and cast.
  const update = {
    $push: { replies: reply },
    $set: { updatedAt: new Date() },
  } as unknown as UpdateFilter<Document>;

  await coll.updateOne({ _id: new ObjectId(questionId) }, update);
}
