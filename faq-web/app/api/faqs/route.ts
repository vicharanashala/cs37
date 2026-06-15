/**
 * app/api/faqs/route.ts
 *
 *   GET /api/faqs              — returns all published FAQs and categories
 *   GET /api/faqs?categoryId=3 — returns FAQs filtered by categoryId
 *
 * Uses the native MongoDB driver (ConnectDB from mongoClient.ts) to query
 * the `faqs` and `categories` collections in the `samagama` database.
 *
 * Response shape:
 *   {
 *     ok: true,
 *     faqs: FAQ[],
 *     categories: Category[]
 *   }
 *
 * FAQ document schema (from DB):
 *   { id, question, answer, category, categoryId, tags, helpful, notHelpful, lastUpdated, isPublished }
 *
 * Category document schema (from DB):
 *   { id, name, icon, description, count }
 */

import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors } from "@/lib/api";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const categoryId = sp.get("categoryId");
  const admin = sp.get("admin") === "true";

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);

    // Build filter — admin mode returns all FAQs, public mode returns only published
    const faqFilter: Record<string, unknown> = {};
    if (!admin) faqFilter.isPublished = { $ne: false };
    if (categoryId) faqFilter.categoryId = Number(categoryId);

    const [faqs, categories] = await Promise.all([
      db
        .collection("faqs")
        .find(faqFilter)
        .sort({ categoryId: 1, id: 1 })
        .toArray(),
      db.collection("categories").find({}).sort({ id: 1 }).toArray(),
    ]);

    return ok({
      faqs: faqs.map((f) => ({
        id: f.id as string,
        question: f.question as string,
        answer: f.answer as string,
        category: f.category as string,
        categoryId: f.categoryId as number,
        tags: (f.tags as string[]) ?? [],
        keywords: (f.keywords as string[]) ?? [],
        helpful: (f.helpful as number) ?? 0,
        notHelpful: (f.notHelpful as number) ?? 0,
        lastUpdated: f.lastUpdated as string,
        isPublished: (f.isPublished as boolean) ?? true,
        version: (f.version as number) ?? 1,
      })),
      categories: categories.map((c) => ({
        id: c.id as number,
        name: c.name as string,
        icon: c.icon as string,
        description: (c.description as string) ?? "",
        count: (c.count as number) ?? 0,
      })),
    });
  } catch (err) {
    console.error("[/api/faqs] Query failed:", err);
    return errors.server("Failed to fetch FAQs from database");
  }
}