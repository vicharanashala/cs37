/**
 * app/api/community/threads/route.ts
 *
 *   GET /api/community/threads            — returns all community threads
 *   GET /api/community/threads?category=NOC — filtered by category
 *
 * Uses the native MongoDB driver (ConnectDB from mongoClient.ts) to query the
 * `community` collection in the `samagama` database — the collection seeded by
 * src/lib/db/seedCommunity.ts. Each document is a full Thread, including its
 * nested `replies` array.
 *
 * Response shape:
 *   { ok: true, threads: Thread[] }
 *
 * Thread document schema (from DB):
 *   { id, question, category, originalAuthor, authorRole, initialAnswer,
 *     answeredBy, answeredByRole, createdAt, resolvedAt, views, status,
 *     replies: Reply[] }
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
      .collection("community")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const threads: Thread[] = docs.map((d) => ({
      id: d.id as string,
      question: d.question as string,
      category: d.category as string,
      originalAuthor: d.originalAuthor as string,
      authorRole: "user",
      initialAnswer: d.initialAnswer as string,
      answeredBy: d.answeredBy as string,
      answeredByRole: d.answeredByRole as "admin" | "mentor",
      createdAt: d.createdAt as string,
      resolvedAt: d.resolvedAt as string,
      views: (d.views as number) ?? 0,
      status: (d.status as "open" | "resolved") ?? "resolved",
      replies: ((d.replies as Reply[]) ?? []).map((r) => ({
        id: r.id,
        author: r.author,
        authorRole: r.authorRole,
        content: r.content,
        timestamp: r.timestamp,
        likes: r.likes ?? 0,
      })),
    }));

    return ok({ threads });
  } catch (err) {
    console.error("[/api/community/threads] Query failed:", err);
    return errors.server("Failed to fetch community threads from database");
  }
}
