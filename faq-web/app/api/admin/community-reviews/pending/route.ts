/**
 * app/api/admin/community-reviews/pending/route.ts
 *
 *   GET /api/admin/community-reviews/pending
 *
 * Unified inbox of community replies awaiting admin review. Merges two sources:
 *
 *   1. Modern `community_answers` collection (CommunityAnswer model)
 *      — statuses `pending_review` and `needs_admin_review`, excluding the
 *      AI helper bot's auto-generated answers.
 *
 *   2. Legacy `pending_questions.replies` array (the system the existing
 *      /admin page already operates on)
 *      — any reply whose `status` is `"pending"`.
 *
 * Returns a single normalised shape so the admin tab can render one list:
 *   { id, source, questionId, questionTitle, body, author, createdAt, aiReview? }
 *
 * Admin-gated via the `x-admin-key` header (same as /api/admin/pending-questions).
 */

import type { NextRequest } from "next/server";
import { ObjectId, WithId, Document } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";
const COMMUNITY_ANSWERS = "community_answers";
const PENDING_QUESTIONS = "pending_questions";

type AnyDoc = WithId<Document>;

export interface PendingReview {
  /** Stable id within its source system. */
  id: string;
  source: "community_answer" | "pending_reply";
  questionId: string;
  questionTitle: string;
  body: string;
  author: string;
  createdAt: string;
  /** Populated only for community_answer. */
  aiReview?: {
    decision: string;
    relevanceScore: number;
    safetyAllowed: boolean;
    policyGrounded: boolean;
    reasons: string[];
    model: string;
  };
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  const db = client.db(DB_NAME);

  // ── 1. CommunityAnswer (new system) ────────────────────────────────────────
  const answerDocs = await db
    .collection<AnyDoc>(COMMUNITY_ANSWERS)
    .find({
      status: { $in: ["pending_review", "needs_admin_review"] },
      authorStudentId: { $ne: "bot:helper" },
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  // Bulk-load the questions these answers belong to so we can show the title.
  const questionIds = Array.from(
    new Set(
      answerDocs
        .map((a) => a.questionId)
        .filter((q): q is ObjectId => q instanceof ObjectId)
        .map((q) => q.toHexString()),
    ),
  );
  const questionDocs = questionIds.length
    ? await db
        .collection<AnyDoc>(COMMUNITY_ANSWERS.replace("answers", "questions"))
        .find({ _id: { $in: questionIds.map((s) => new ObjectId(s)) } })
        .project({ title: 1, normalizedTitle: 1 })
        .toArray()
    : [];
  const questionTitleById = new Map<string, string>(
    questionDocs.map((q) => [String(q._id), (q.title as string) ?? ""]),
  );

  const fromAnswers: PendingReview[] = answerDocs.map((a) => {
    const review = a.review as
      | {
          decision?: string;
          relevanceScore?: number;
          safetyAllowed?: boolean;
          policyGrounded?: boolean;
          reasons?: string[];
          model?: string;
        }
      | undefined;
    return {
      id: String(a._id),
      source: "community_answer",
      questionId: a.questionId ? String(a.questionId) : "",
      questionTitle:
        (a.questionId ? questionTitleById.get(String(a.questionId)) : "") ||
        "Untitled question",
      body: (a.body as string) ?? "",
      author: (a.authorStudentId as string) ?? "anonymous",
      createdAt: String(a.createdAt ?? new Date().toISOString()),
      aiReview: review
        ? {
            decision: review.decision ?? "needs_admin_review",
            relevanceScore: review.relevanceScore ?? 0,
            safetyAllowed: review.safetyAllowed ?? false,
            policyGrounded: review.policyGrounded ?? false,
            reasons: Array.isArray(review.reasons) ? review.reasons : [],
            model: review.model ?? "",
          }
        : undefined,
    };
  });

  // ── 2. pending_questions.replies (legacy system) ───────────────────────────
  const legacyDocs = await db
    .collection<AnyDoc>(PENDING_QUESTIONS)
    .find({ "replies.status": "pending" })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  const fromLegacy: PendingReview[] = [];
  for (const doc of legacyDocs) {
    const replies = (doc.replies as Array<Record<string, unknown>>) ?? [];
    for (const r of replies) {
      if (r.status !== "pending") continue;
      fromLegacy.push({
        id: String(r.id ?? ""),
        source: "pending_reply",
        questionId: String(doc._id),
        questionTitle: (doc.question as string) ?? "Untitled question",
        body: String(r.content ?? ""),
        author: String(r.author ?? "anonymous"),
        createdAt: String(r.timestamp ?? doc.updatedAt ?? new Date().toISOString()),
      });
    }
  }

  // Newest first, interleave by createdAt.
  const merged = [...fromAnswers, ...fromLegacy].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return ok({ reviews: merged, total: merged.length });
}
