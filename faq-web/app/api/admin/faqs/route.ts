import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors, readJson } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return errors.forbidden("Admin key required");
  }

  const body = await readJson<{
    question?: string;
    answer?: string;
    category?: string;
    tags?: string[];
  }>(req);

  if (!body?.question?.trim() || !body?.answer?.trim() || !body?.category?.trim()) {
    return errors.badRequest("question, answer, and category are required");
  }

  const question = body.question.trim();
  const answer = body.answer.trim();
  const category = body.category.trim();
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => t.trim()).filter(Boolean)
    : [];

  let client;
  try {
    client = await ConnectDB();
  } catch (err) {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);

    // Find category to get categoryId
    const categoryDoc = await db.collection("categories").findOne({ name: category });
    if (!categoryDoc) {
      return errors.badRequest(`Category '${category}' not found`);
    }
    const categoryId = Number(categoryDoc.id);

    // Query existing FAQs under this categoryId to determine the next sequential ID suffix
    const faqs = await db.collection("faqs").find({ categoryId }).toArray();
    let maxSuffix = 0;
    faqs.forEach((faq) => {
      const parts = String(faq.id).split(".");
      if (parts.length === 2) {
        const suffix = parseInt(parts[1], 10);
        if (!isNaN(suffix) && suffix > maxSuffix) {
          maxSuffix = suffix;
        }
      }
    });

    const nextId = `${categoryId}.${maxSuffix + 1}`;

    const newFaq = {
      id: nextId,
      question,
      answer,
      category,
      categoryId,
      tags,
      helpful: 0,
      notHelpful: 0,
      lastUpdated: new Date().toISOString().split("T")[0],
      isPublished: true,
    };

    // Insert the new FAQ
    await db.collection("faqs").insertOne(newFaq);

    // Increment count on corresponding category
    await db.collection("categories").updateOne(
      { id: categoryId },
      { $inc: { count: 1 } }
    );

    return ok({
      message: "Manual FAQ created successfully",
      faq: newFaq,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/faqs] Failed to create FAQ:", err);
    return errors.server("Failed to save manual FAQ to database");
  }
}
