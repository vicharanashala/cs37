import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors, readJson } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const body = await readJson<{ question?: string }>(req);
  if (!body?.question?.trim()) {
    return errors.badRequest("question is required");
  }

  const question = body.question.trim();
  const tokens = question
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) {
    return ok({ matches: [] });
  }

  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const patterns = escaped.map((t) => new RegExp(t, "i"));

  const matches = await db
    .collection("faqs")
    .find({
      isPublished: { $ne: false },
      $or: [
        { question: { $in: patterns } },
        { answer: { $in: patterns } },
        { tags: { $in: tokens } },
      ],
    })
    .sort({ categoryId: 1, id: 1 })
    .limit(5)
    .toArray();

  return ok({
    matches: matches.map((f) => ({
      id: f.id as string,
      question: f.question as string,
      answer: f.answer as string,
      category: f.category as string,
      tags: (f.tags as string[]) ?? [],
    })),
  });
}
