/**
 * app/api/admin/pending-questions/route.ts
 *
 *   GET  /api/admin/pending-questions          — list pending questions for admin review
 *   POST /api/admin/pending-questions          — resolve, reject, or promote_faq a pending question
 *
 * Admin-gated via `x-admin-key` header.
 *
 * The resolve/reject action updates the status and records the answer text
 * when resolving so it can later be promoted to a FAQ entry.
 *
 * The promote_faq action creates a new FAQ entry and links it back to the
 * pending question via `resolvedFrom`.
 */

import type { NextRequest } from "next/server";
import { ObjectId, WithId, Document } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors, readJson } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";

const COLLECTION = "pending_questions";
const FAQ_COLLECTION = "faqs";
const DB_NAME = process.env.MONGODB_DB ?? "samagama";

type PendingQuestionDoc = WithId<Document>;

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const client = await ConnectDB();
  const db = client.db(DB_NAME);
  const sp = req.nextUrl.searchParams;
  const filterStatus = sp.get("status") ?? "pending";
  const filterSource = sp.get("source");

  const query: Record<string, unknown> = {};
  if (filterStatus !== "all") query.status = filterStatus;
  if (filterSource) query.source = filterSource;

  const items = await db
    .collection<PendingQuestionDoc>(COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const total = await db.collection(COLLECTION).countDocuments(query);

  return ok({
    questions: items.map((doc) => ({
      id: String(doc._id),
      question: doc.question as string,
      category: doc.category as string,
      email: doc.email as string,
      priority: doc.priority as "normal" | "urgent",
      status: doc.status as "pending" | "resolved" | "rejected",
      answer: (doc.answer as string | null) ?? null,
      suggestedAnswer: (doc.suggestedAnswer as string | null) ?? null,
      submittedAt: doc.createdAt,
      source: (doc.source as string | undefined) ?? "ask_page",
    })),
    total,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const body = await readJson<{
    id?: string;
    action?: string;
    answer?: string;
    promoteFaq?: {
      categoryId?: number;
      tags?: string[];
    };
  }>(req);
  if (!body?.id || !body?.action) {
    return errors.badRequest("id and action are required");
  }

  const { id, action, answer, promoteFaq } = body;
  if (!["resolve", "reject", "promote_faq"].includes(action)) {
    return errors.badRequest("action must be 'resolve', 'reject', or 'promote_faq'");
  }
  if ((action === "resolve" || action === "promote_faq") && (!answer || !answer.trim())) {
    return errors.badRequest("answer text is required when resolving or promoting");
  }

  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  const resolvedAnswer = (answer ?? "").trim();

  if (action === "promote_faq") {
    const pendingDoc = await db
      .collection<PendingQuestionDoc>(COLLECTION)
      .findOne({ _id: new ObjectId(id) });
    if (!pendingDoc) return errors.notFound("Question not found");

    const lastFaq = await db
      .collection<WithId<Document>>(FAQ_COLLECTION)
      .findOne({}, { sort: { createdAt: -1 } });

    let nextNum = 1;
    if (lastFaq) {
      const lastId = (lastFaq.id as string).split(".");
      const lastSection = parseInt(lastId[lastId.length - 1], 10);
      nextNum = lastSection + 1;
    }

    const catId = promoteFaq?.categoryId ?? 1;
    const faqId = `${catId}.${nextNum}`;

    const faqInsert = await db.collection(FAQ_COLLECTION).insertOne({
      id: faqId,
      question: pendingDoc.question,
      answer: resolvedAnswer,
      category: pendingDoc.category,
      categoryId: catId,
      tags: promoteFaq?.tags ?? [],
      helpful: 0,
      notHelpful: 0,
      lastUpdated: new Date().toISOString().split("T")[0],
      isPublished: true,
      version: 1,
      resolvedFrom: new ObjectId(id),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db
      .collection<PendingQuestionDoc>(COLLECTION)
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            updatedAt: new Date(),
            status: "resolved",
            answer: resolvedAnswer,
            initialAnswer: resolvedAnswer,
            answeredBy: req.headers.get("x-admin-key") ?? "admin",
            answeredByRole: "admin",
            resolvedAt: new Date(),
            resolvedBy: req.headers.get("x-admin-key") ?? "admin",
            promotedToFAQ: faqInsert.insertedId,
            faqSuggestionStatus: "approved",
          },
        }
      );

    return ok({
      id,
      status: "resolved",
      faqId,
      message: `FAQ entry '${faqId}' created successfully`,
    });
  }

  const update: Record<string, unknown> = {
    updatedAt: new Date(),
    status: action === "resolve" ? "resolved" : "rejected",
    answer: resolvedAnswer,
    initialAnswer: resolvedAnswer,
    answeredBy: req.headers.get("x-admin-key") ?? "admin",
    answeredByRole: "admin",
    resolvedAt: new Date(),
    resolvedBy: req.headers.get("x-admin-key") ?? "admin",
    faqSuggestionStatus: action === "reject" ? "rejected" : undefined,
  };

  const result = await db
    .collection<PendingQuestionDoc>(COLLECTION)
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );

  if (!result) return errors.notFound("Question not found");

  return ok({
    id: String(result._id),
    status: result.status,
    message:
      action === "resolve"
        ? "Question resolved successfully"
        : "Question rejected",
  });
}