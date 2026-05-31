/**
 * app/api/community/threads/[id]/replies/route.ts
 *
 *   POST /api/community/threads/:id/replies
 *
 * Appends a reply to a specific thread (question) in the `pending_questions`
 * collection of the `samagama` database. The reply is `$push`ed onto the
 * document's nested `replies` array.
 *
 * Flow:
 *   1. Validate + `$push` the reply with status "pending".
 *   2. Return { reply } (status "pending") immediately to the client.
 *   3. After the response is sent (Next `after()`), POST the reply to the
 *      FastAPI RAG service /validate-reply for malicious/malpractice
 *      moderation, then write the verdict (status + moderation) back onto
 *      the nested reply via arrayFilters.
 *
 * If the RAG service is unreachable, the reply is left "pending" (fail open).
 *
 * Request body:
 *   { content: string, author?: string, authorRole?: "admin" | "mentor" | "user" }
 *
 * Response shape:
 *   { ok: true, reply: Reply }   (201 Created)
 *
 * Reply schema (stored in DB):
 *   { id, author, authorRole, content, timestamp, likes,
 *     status: "pending" | "approved" | "rejected",
 *     moderation?: { reason, categories, model, reviewedAt } }
 */

import { randomUUID } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { ObjectId, type UpdateFilter } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { created, errors, readJson } from "@/lib/api";
import { validateReply } from "@/lib/ai/ragClient";
import type { Reply } from "@/lib/community/threadModel";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";
const MAX_CONTENT_LENGTH = 4000;
const ROLES = ["admin", "mentor", "user"] as const;

interface ThreadDoc {
  _id: ObjectId;
  question: string;
  replies: Reply[];
}

/** Format a Date as "YYYY-MM-DD HH:MM" to match the seeded reply timestamps. */
function formatTimestamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const body = await readJson<{
    content?: unknown;
    author?: unknown;
    authorRole?: unknown;
  }>(req);

  if (!body) return errors.badRequest("Invalid JSON body");

  // Validate content
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return errors.badRequest("Reply content is required");
  if (content.length > MAX_CONTENT_LENGTH) {
    return errors.badRequest(
      `Reply is too long (max ${MAX_CONTENT_LENGTH} characters)`
    );
  }

  // Optional author + role, with safe defaults for anonymous student replies
  const author =
    typeof body.author === "string" && body.author.trim()
      ? body.author.trim()
      : "Anonymous Student";
  const authorRole = ROLES.includes(body.authorRole as (typeof ROLES)[number])
    ? (body.authorRole as Reply["authorRole"])
    : "user";

  const reply: Reply = {
    id: `r-${randomUUID().slice(0, 8)}`,
    author,
    authorRole,
    content,
    timestamp: formatTimestamp(new Date()),
    likes: 0,
    status: "pending", // flipped to approved/rejected by RAG moderation
  };

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);
    // Push the reply and grab the thread's question text for moderation context.
    const thread = await db
      .collection<ThreadDoc>("pending_questions")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $push: { replies: reply } },
        { returnDocument: "before", projection: { question: 1 } }
      );

    if (!thread) {
      return errors.notFound("Thread not found");
    }

    // ── Moderate after the response is sent; write the verdict back to DB ────
    after(async () => {
      const verdict = await validateReply({
        reply_id: reply.id,
        thread_id: id,
        content,
        question: thread.question,
      });

      

      // Fail open: if the RAG service is down, leave the reply "pending".
      if (!verdict) return;

      try {
        // Positional array update — dotted `$[r]` keys aren't expressible in
        // the typed UpdateFilter, so build the $set and cast.
        const update = {
          $set: {
            "replies.$[r].status": verdict.status,
            "replies.$[r].moderation": {
              reason: verdict.reason,
              categories: verdict.categories,
              model: verdict.model,
              reviewedAt: new Date().toISOString(),
            },
          },
        } as unknown as UpdateFilter<ThreadDoc>;

        await db
          .collection<ThreadDoc>("pending_questions")
          .updateOne({ _id: new ObjectId(id) }, update, {
            arrayFilters: [{ "r.id": reply.id }],
          });
      } catch (err) {
        console.error(
          `[replies] Failed to write moderation verdict for reply ${reply.id}:`,
          err
        );
      }
    });

    return created({ reply });
  } catch (err) {
    console.error("[/api/community/threads/:id/replies] Insert failed:", err);
    return errors.server("Failed to save reply to database");
  }
}
