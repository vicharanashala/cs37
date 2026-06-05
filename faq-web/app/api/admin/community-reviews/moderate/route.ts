/**
 * app/api/admin/community-reviews/moderate/route.ts
 *
 *   POST /api/admin/community-reviews/moderate
 *
 * Approve (as-is or rewritten) or reject a single community reply from either
 * of the two review sources.
 *
 * Body:
 *   {
 *     source:      "community_answer" | "pending_reply",
 *     id:          string,                 // reply id
 *     questionId:  string,                 // parent question id
 *     action:      "approve" | "reject",
 *     finalBody?:  string,                 // required when rewriting on approve
 *     note?:       string,                 // optional admin note
 *   }
 *
 * Behaviour (per the agreed design):
 *   - approve  → reply is made public. If `finalBody` is provided the reply's
 *                text is REPLACED with the admin's version and the author is
 *                RE-ATTRIBUTED to the admin (student credit dropped).
 *   - reject   → reply is marked rejected/hidden and never made public.
 *
 * Admin-gated via `x-admin-key` header. The admin's key is used as the
 * `moderatedBy` identifier and recorded in the moderationLog.
 */

import type { NextRequest } from "next/server";
import { ObjectId, WithId, Document, type Db } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { ok, errors, readJson } from "@/lib/api";
import { isAdmin } from "@/lib/community/identity";
import { recomputeQuestionStats, markSummaryStale } from "@/lib/community/service";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";
const COMMUNITY_ANSWERS = "community_answers";
const PENDING_QUESTIONS = "pending_questions";

type AnyDoc = WithId<Document>;

interface ModerateBody {
  source?: "community_answer" | "pending_reply";
  id?: string;
  questionId?: string;
  action?: "approve" | "reject";
  finalBody?: string;
  note?: string;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return errors.forbidden("Admin key required");

  const body = await readJson<ModerateBody>(req);
  if (!body?.source || !body?.id || !body?.questionId || !body?.action) {
    return errors.badRequest(
      "source, id, questionId, and action are required",
    );
  }
  const { source, id, questionId, action, finalBody, note } = body;
  if (action !== "approve" && action !== "reject") {
    return errors.badRequest("action must be 'approve' or 'reject'");
  }
  if (action === "approve" && finalBody !== undefined) {
    const trimmed = finalBody.trim();
    if (trimmed.length < 15) {
      return errors.badRequest(
        "finalBody must be at least 15 characters when rewriting",
      );
    }
  }

  const adminId = req.headers.get("x-admin-key")?.trim() || "admin";
  const now = new Date();

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }
  const db = client.db(DB_NAME);

  if (source === "community_answer") {
    return moderateCommunityAnswer({
      db,
      answerId: id,
      questionId,
      action,
      finalBody: finalBody?.trim(),
      note,
      adminId,
      now,
    });
  }

  if (source === "pending_reply") {
    return moderatePendingReply({
      db,
      replyId: id,
      questionId,
      action,
      finalBody: finalBody?.trim(),
      note,
      adminId,
      now,
    });
  }

  return errors.badRequest("unknown source");
}

// ── Modern: CommunityAnswer ─────────────────────────────────────────────────

async function moderateCommunityAnswer(params: {
  db: Db;
  answerId: string;
  questionId: string;
  action: "approve" | "reject";
  finalBody: string | undefined;
  note: string | undefined;
  adminId: string;
  now: Date;
}) {
  const {
    db,
    answerId,
    questionId,
    action,
    finalBody,
    note,
    adminId,
    now,
  } = params;

  if (!ObjectId.isValid(answerId) || !ObjectId.isValid(questionId)) {
    return errors.badRequest("invalid id");
  }

  const answer = await db
    .collection<AnyDoc>(COMMUNITY_ANSWERS)
    .findOne({ _id: new ObjectId(answerId) });
  if (!answer) return errors.notFound("Answer not found");

  const isRewrite = action === "approve" && finalBody && finalBody.length >= 15;
  const newStatus = action === "approve" ? "approved" : "rejected";

  const moderationEntry = {
    decision: (isRewrite ? "approve" : action) as "approve" | "reject" | "hide",
    adminId,
    note: note ?? (isRewrite ? "Rewritten and approved by admin" : ""),
    at: now,
    rewritten: !!isRewrite,
  };

  const setDoc: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  };
  if (isRewrite && finalBody) {
    setDoc.body = finalBody;
    // Re-attribute to admin per design decision.
    setDoc.authorStudentId = `admin:${adminId}`;
    setDoc.moderationNote = "Rewritten by admin — student credit dropped";
  }
  setDoc.moderationLog = [
    ...((answer.moderationLog as unknown[]) ?? []),
    moderationEntry,
  ];

  await db
    .collection<AnyDoc>(COMMUNITY_ANSWERS)
    .updateOne({ _id: new ObjectId(answerId) }, { $set: setDoc });

  // Recompute question aggregates so the public page reflects the new state.
  try {
    await recomputeQuestionStats(questionId);
    if (newStatus === "approved") await markSummaryStale(questionId);
  } catch (err) {
    console.warn(
      "[community-reviews/moderate] stats recompute failed (non-fatal):",
      err,
    );
  }

  return ok({
    id: answerId,
    status: newStatus,
    rewritten: !!isRewrite,
    message: isRewrite
      ? "Answer rewritten and approved (student credit dropped)"
      : action === "approve"
        ? "Answer approved as-is"
        : "Answer rejected",
  });
}

// ── Legacy: pending_questions.replies[$] ────────────────────────────────────

async function moderatePendingReply(params: {
  db: Db;
  replyId: string;
  questionId: string;
  action: "approve" | "reject";
  finalBody: string | undefined;
  note: string | undefined;
  adminId: string;
  now: Date;
}) {
  const { db, replyId, questionId, action, finalBody, note, adminId, now } =
    params;

  if (!ObjectId.isValid(questionId)) {
    return errors.badRequest("invalid questionId");
  }

  const isRewrite = action === "approve" && finalBody && finalBody.length >= 15;
  const newStatus = action === "approve" ? "approved" : "rejected";

  const replySet: Record<string, unknown> = {
    "replies.$.status": newStatus,
    "replies.$.moderatedBy": adminId,
    "replies.$.moderatedAt": now,
    "replies.$.moderationNote": note ?? "",
  };
  if (isRewrite && finalBody) {
    replySet["replies.$.content"] = finalBody;
    // Re-attribute to admin.
    replySet["replies.$.author"] = `admin:${adminId}`;
    replySet["replies.$.authorRole"] = "admin";
    replySet["replies.$.originalAuthor"] = "student";
  }

  const result = await db
    .collection<AnyDoc>(PENDING_QUESTIONS)
    .updateOne(
      { _id: new ObjectId(questionId), "replies.id": replyId },
      { $set: replySet },
    );

  if (result.matchedCount === 0) {
    return errors.notFound("Reply not found on the parent question");
  }

  return ok({
    id: replyId,
    status: newStatus,
    rewritten: !!isRewrite,
    message: isRewrite
      ? "Reply rewritten and approved (student credit dropped)"
      : action === "approve"
        ? "Reply approved as-is"
        : "Reply rejected",
  });
}
