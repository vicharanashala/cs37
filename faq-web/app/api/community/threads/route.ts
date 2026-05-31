/**
 * app/api/community/threads/route.ts
 *
 *   GET /api/community/threads            — returns all community threads
 *   GET /api/community/threads?category=NOC — filtered by category
 *
 * Uses the native MongoDB driver (ConnectDB from mongoClient.ts) to query the
 * `pending_questions` collection in the `samagama` database. Documents use
 * the unified schema (IPendingQuestion) that includes community thread fields
 * (originalAuthor, initialAnswer, replies, views, etc.).
 *
 * Response shape:
 *   { ok: true, threads: Thread[] }
 *
 * Thread document schema (from DB):
 *   { _id, question, category, email (→ originalAuthor), authorRole,
 *     initialAnswer, answeredBy, answeredByRole, createdAt, resolvedAt,
 *     views, status, replies: Reply[] }
 */

import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors } from "@/lib/api";
import type { Thread, Reply } from "@/lib/community/threadModel";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category");

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;

    const docs = await db
      .collection("pending_questions")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const threads: Thread[] = docs.map((d) => ({
      id: String(d._id),
      question: d.question as string,
      category: d.category as string,
      originalAuthor: d.email as string,
      authorRole: "user" as const,
      initialAnswer: (d.initialAnswer as string | null) ?? null,
      answeredBy: (d.answeredBy as string | null) ?? null,
      answeredByRole: (d.answeredByRole as "admin" | "mentor" | null) ?? null,
      createdAt: String(d.createdAt),
      resolvedAt: d.resolvedAt ? String(d.resolvedAt) : null,
      views: (d.views as number) ?? 0,
      status: (d.status as Thread["status"]) ?? "pending",
      replies: ((d.replies as Reply[]) ?? [])
        .filter((r) => r.status !== "rejected")
        .map((r) => ({
          id: r.id,
          author: r.author,
          authorRole: r.authorRole,
          content: r.content,
          timestamp: r.timestamp,
          likes: r.likes ?? 0,
          status: r.status,
          moderation: r.moderation,
        })),
    }));

    return ok({ threads });
  } catch (err) {
    console.error("[/api/community/threads] Query failed:", err);
    return errors.server("Failed to fetch community threads from database");
  }
}
