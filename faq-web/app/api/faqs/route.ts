/**
 * app/api/faqs/route.ts
 *
 *   GET /api/faqs   — returns all published FAQs and categories
 *
 * Serves the FAQ corpus from MongoDB (faqs + categories collections)
 * in the exact shape that the frontend expects from src/data/faqData.ts:
 *   FAQ  → { id, question, answer, category, categoryId, tags,
 *            helpful, notHelpful, lastUpdated }
 *   Category → { id, name, icon, description, count }
 *
 * The FAQ page (/), Ask page duplicate detection, and YakshaChat all
 * currently import from the static faqData.ts — after this route is
 * live those can be switched to fetch from here.
 */

import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ok, errors } from "@/lib/api";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const categoryId = sp.get("categoryId");

  try {
    await connectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  const { FAQ, Category } = await import("@/models");

  const query: Record<string, unknown> = { isPublished: true };
  if (categoryId) query.categoryId = Number(categoryId);

  const [faqs, categories] = await Promise.all([
    FAQ.find(query)
      .sort({ categoryId: 1, id: 1 })
      .lean(),
    Category.find().sort({ id: 1 }).lean(),
  ]);

  return ok({
    faqs: faqs.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
      categoryId: f.categoryId,
      tags: f.tags ?? [],
      helpful: f.helpful ?? 0,
      notHelpful: f.notHelpful ?? 0,
      lastUpdated: f.lastUpdated,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description ?? "",
      count: c.count ?? 0,
    })),
  });
}