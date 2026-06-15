/**
 * app/api/community/questions/route.ts
 *
 *   GET /api/community/questions            — returns all visible community threads
 *   GET /api/community/questions?category=X — filtered by category
 *
 * Reads from the `pending_questions` collection (same data as the old
 * /api/community/threads route, now consolidated under the /questions prefix).
 *
 * Response shape:
 *   { ok: true, threads: Thread[] }
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

    const filter: Record<string, unknown> = {
      status: { $in: ["approved", "open", "resolved"] },
    };
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
          authorEmail: r.authorEmail,
          authorRole: r.authorRole,
          content: r.content,
          timestamp: r.timestamp,
          likes: r.likes ?? 0,
          status: r.status,
          moderation: r.moderation,
          sources: r.sources,
        })),
    }));

    return ok({ threads });
  } catch (err) {
    console.error("[/api/community/questions] Query failed:", err);
    return errors.server("Failed to fetch community questions from database");
  }
}
