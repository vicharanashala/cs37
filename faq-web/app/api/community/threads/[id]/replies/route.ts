/**
 * app/api/community/threads/[id]/replies/route.ts
 *
 *   POST /api/community/threads/:id/replies
 *
 * Appends a reply to a specific thread (question) in the `community`
 * collection of the `samagama` database — the collection seeded by
 * src/lib/db/seedCommunity.ts. The reply is `$push`ed onto the document's
 * nested `replies` array, so it is persisted exactly like the seeded replies.
 *
 * Request body:
 *   { content: string, author?: string, authorRole?: "admin" | "mentor" | "user" }
 *
 * Response shape:
 *   { ok: true, reply: Reply }   (201 Created)
 *
 * Reply schema (stored in DB):
 *   { id, author, authorRole, content, timestamp, likes }
 */

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { created, errors, readJson } from "@/lib/api";
import type { Reply } from "@/lib/community/threadModel";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";
const MAX_CONTENT_LENGTH = 4000;
const ROLES = ["admin", "mentor", "user"] as const;

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
  };

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);
    // Typed collection so $push knows `replies` is an array and `_id` is a string.
    const result = await db
      .collection<{ _id: string; replies: Reply[] }>("community")
      .updateOne({ _id: id }, { $push: { replies: reply } });

    if (result.matchedCount === 0) {
      return errors.notFound("Thread not found");
    }

    return created({ reply });
  } catch (err) {
    console.error("[/api/community/threads/:id/replies] Insert failed:", err);
    return errors.server("Failed to save reply to database");
  }
}
