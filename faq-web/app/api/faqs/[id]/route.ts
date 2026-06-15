/**
 * app/api/faqs/[id]/route.ts
 *
 *   GET    /api/faqs/:id   — get a single FAQ by its string id
 *   PUT    /api/faqs/:id   — update FAQ (admin rewrite)
 *   DELETE /api/faqs/:id   — delete FAQ (admin)
 *
 * PUT body: { question?, answer?, category?, categoryId?, tags?, keywords?, isPublished? }
 * DELETE requires no body.
 */

import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors, readJson } from "@/lib/api";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);
    const faq = await db.collection("faqs").findOne({ id });
    if (!faq) return errors.notFound("FAQ not found");

    return ok({
      faq: {
        id: faq.id as string,
        question: faq.question as string,
        answer: faq.answer as string,
        category: faq.category as string,
        categoryId: faq.categoryId as number,
        tags: (faq.tags as string[]) ?? [],
        keywords: (faq.keywords as string[]) ?? [],
        helpful: (faq.helpful as number) ?? 0,
        notHelpful: (faq.notHelpful as number) ?? 0,
        lastUpdated: faq.lastUpdated as string,
        isPublished: (faq.isPublished as boolean) ?? true,
        version: (faq.version as number) ?? 1,
      },
    });
  } catch (err) {
    console.error("[/api/faqs/:id] GET failed:", err);
    return errors.server("Failed to fetch FAQ");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await readJson<{
    question?: string;
    answer?: string;
    category?: string;
    categoryId?: number;
    tags?: string[];
    keywords?: string[];
    isPublished?: boolean;
  }>(req);

  if (!body || Object.keys(body).length === 0) {
    return errors.badRequest("At least one field to update is required");
  }

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);

    const updateFields: Record<string, unknown> = {};
    if (body.question !== undefined) updateFields.question = body.question;
    if (body.answer !== undefined) updateFields.answer = body.answer;
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.categoryId !== undefined) updateFields.categoryId = body.categoryId;
    if (body.tags !== undefined) updateFields.tags = body.tags;
    if (body.keywords !== undefined) updateFields.keywords = body.keywords;
    if (body.isPublished !== undefined) updateFields.isPublished = body.isPublished;

    updateFields.lastUpdated = new Date().toISOString().split("T")[0];
    updateFields.updatedAt = new Date();

    // Bump version
    const current = await db.collection("faqs").findOne({ id });
    if (!current) return errors.notFound("FAQ not found");
    updateFields.version = ((current.version as number) ?? 1) + 1;

    const result = await db
      .collection("faqs")
      .findOneAndUpdate(
        { id },
        { $set: updateFields },
        { returnDocument: "after" }
      );

    if (!result) return errors.notFound("FAQ not found");

    return ok({
      faq: {
        id: result.id as string,
        question: result.question as string,
        answer: result.answer as string,
        category: result.category as string,
        categoryId: result.categoryId as number,
        tags: (result.tags as string[]) ?? [],
        keywords: (result.keywords as string[]) ?? [],
        helpful: (result.helpful as number) ?? 0,
        notHelpful: (result.notHelpful as number) ?? 0,
        lastUpdated: result.lastUpdated as string,
        isPublished: (result.isPublished as boolean) ?? true,
        version: (result.version as number) ?? 1,
      },
      message: "FAQ updated successfully",
    });
  } catch (err) {
    console.error("[/api/faqs/:id] PUT failed:", err);
    return errors.server("Failed to update FAQ");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(DB_NAME);
    const result = await db.collection("faqs").deleteOne({ id });

    if (result.deletedCount === 0) return errors.notFound("FAQ not found");

    return ok({ message: "FAQ deleted successfully" });
  } catch (err) {
    console.error("[/api/faqs/:id] DELETE failed:", err);
    return errors.server("Failed to delete FAQ");
  }
}
