/**
 * app/api/faqs/replies/route.ts
 *
 *   GET  /api/faqs/replies?faqId=xxx       — list replies for an FAQ
 *   POST /api/faqs/replies                 — { faqId, content }
 *
 * One reply per student per FAQ (enforced by unique compound index).
 * Replies appear immediately — no review pipeline.
 */

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { FAQReply } from "@/models";
import type { IFAQReply } from "@/models";
import { ok, created, errors, fail, readJson } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";
import { rateLimit } from "@/lib/community/rateLimit";
import { RATE_LIMITS } from "@/lib/community/constants";

// ─── GET /api/faqs/replies?faqId=xxx ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const faqId = req.nextUrl.searchParams.get("faqId");
  if (!faqId) return errors.badRequest("faqId is required");

  await connectDB();

  const replies = await FAQReply.find({ faqId })
    .sort({ createdAt: 1 })
    .lean<IFAQReply[]>();

  return ok({ replies });
}

// ─── POST /api/faqs/replies ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  const rl = rateLimit(`answer:${student.studentId}`, RATE_LIMITS.ANSWER);
  if (!rl.allowed) return errors.rateLimited();

  const body = await readJson<{ faqId?: string; content?: string }>(req);
  const { faqId, content } = body ?? {};

  if (!faqId) return errors.badRequest("faqId is required");
  if (!content || content.trim().length < 10) {
    return errors.badRequest("Reply must be at least 10 characters.");
  }
  if (content.trim().length > 1000) {
    return errors.badRequest("Reply cannot exceed 1000 characters.");
  }

  await connectDB();

  try {
    const doc = await FAQReply.create({
      faqId,
      authorStudentId: student.studentId,
      body: content.trim(),
    });
    return created({
      reply: {
        id: String(doc._id),
        faqId: doc.faqId,
        authorStudentId: doc.authorStudentId,
        body: doc.body,
        likes: 0,
        likedBy: [],
        createdAt: doc.createdAt,
      },
    });
  } catch (err: unknown) {
    // Duplicate key → student already replied to this FAQ
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      return fail("duplicate_reply", "You have already replied to this FAQ.", 409);
    }
    throw err;
  }
}

// ─── PATCH /api/faqs/replies?id=xxx&like=1|0 ─────────────────────────────────

/**
 * Toggle like on a reply.
 * PATCH /api/faqs/replies?id=xxx&like=1   — add like
 * PATCH /api/faqs/replies?id=xxx&like=0   — remove like
 *
 * Uses atomic $addToSet / $pull so concurrent likes don't conflict.
 */
export async function PATCH(req: NextRequest) {
  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  const id = req.nextUrl.searchParams.get("id");
  const likeParam = req.nextUrl.searchParams.get("like");
  if (!id) return errors.badRequest("id is required");
  if (likeParam !== "0" && likeParam !== "1") {
    return errors.badRequest("like must be 0 or 1");
  }

  const doLike = likeParam === "1";

  await connectDB();

  const update = doLike
    ? { $addToSet: { likedBy: student.studentId } }
    : { $pull: { likedBy: student.studentId } };

  const updated = await FAQReply.findOneAndUpdate(
    { _id: id },
    update,
    { new: true }
  ).lean<IFAQReply | null>();

  if (!updated) return errors.notFound("Reply not found");

  return ok({ id: String(updated._id), likes: updated.likedBy.length });
}