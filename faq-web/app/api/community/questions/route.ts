/**
 * app/api/community/questions/route.ts
 *
 *   GET  /api/community/questions   — list/search/filter/sort the question feed
 *   POST /api/community/questions   — create a question (rate-limited, dedup'd)
 *
 * POST flow (with FastAPI RAG gate):
 *   1. Validate input + deduplicate
 *   2. Save question to MongoDB with status "pending_rag"
 *   3. Return questionId + pending status to the client immediately
 *   4. After response is sent (via Next.js after()), call FastAPI
 *      POST /validate-question — FastAPI writes the result (approved /
 *      rejected_by_rag) directly back to MongoDB, no round-trip needed here.
 *
 * If the FastAPI service is unavailable, the question stays "pending_rag"
 * and admins can review it manually.
 */

import { after, type NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CommunityQuestion } from "@/models";
import type { ICommunityQuestion } from "@/models";
import { ok, created, errors, readJson } from "@/lib/api";
import { getStudent } from "@/lib/community/identity";
import { rateLimit } from "@/lib/community/rateLimit";
import { validateQuestion } from "@/lib/community/validation";
import { normalizeTitle, questionHash } from "@/lib/community/text";
import { serializeQuestion } from "@/lib/community/serialize";
import { INSTITUTION_ID, RATE_LIMITS } from "@/lib/community/constants";
import { validateQuestion as ragValidate } from "@/lib/ai/ragClient";
import { runBotAnswerGeneration } from "@/lib/community/service";

export async function GET(req: NextRequest) {
  await connectDB();
  const sp = req.nextUrl.searchParams;
  const tag = sp.get("tag")?.trim();
  const q = sp.get("q")?.trim();
  const sort = sp.get("sort") ?? "recent";
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const filter: Record<string, unknown> = {
    institutionId: INSTITUTION_ID,
    // Show questions approved by RAG, or legacy "open" questions.
    status: { $in: ["approved", "open"] },
  };
  if (tag) filter.tags = tag;
  if (sort === "unanswered") filter.approvedAnswerCount = 0;
  if (q) filter.$text = { $search: q };

  const sortSpec: Record<string, 1 | -1> =
    sort === "answered"
      ? { approvedAnswerCount: -1, lastActivityAt: -1 }
      : sort === "trending"
        ? { voteScore: -1, lastActivityAt: -1 }
        : sort === "unanswered"
          ? { createdAt: -1 }
          : { createdAt: -1 }; // recent (default)

  const [items, total] = await Promise.all([
    CommunityQuestion.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<ICommunityQuestion[]>(),
    CommunityQuestion.countDocuments(filter),
  ]);

  return ok({
    questions: items.map((i) => serializeQuestion(i as never)),
    total,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const student = getStudent(req);
  if (!student) return errors.unauthorized("Missing student identity");

  const rl = rateLimit(`ask:${student.studentId}`, RATE_LIMITS.ASK);
  if (!rl.allowed) return errors.rateLimited("You're asking too fast. Try again later.");

  const body = await readJson(req);
  const v = validateQuestion(body);
  if (!v.ok) return errors.badRequest(v.error);

  await connectDB();

  // Exact-duplicate guard (QA_FEATURE.md: "check whether a question exists").
  const hash = questionHash(v.value.title);
  const dup = await CommunityQuestion.findOne({
    institutionId: INSTITUTION_ID,
    questionHash: hash,
    status: { $ne: "deleted" },
  }).lean<ICommunityQuestion>();
  if (dup) {
    return ok(
      {
        duplicate: true,
        question: serializeQuestion(dup as never),
        message: "A very similar question already exists.",
      },
      { status: 409 }
    );
  }

  // Step 1: Save immediately as pending_rag so admins have a full audit trail.
  const doc = await CommunityQuestion.create({
    institutionId: INSTITUTION_ID,
    authorStudentId: student.studentId,
    title: v.value.title,
    body: v.value.body,
    normalizedTitle: normalizeTitle(v.value.title),
    questionHash: hash,
    tags: v.value.tags,
    // Stays pending_rag until FastAPI calls back to MongoDB directly.
    status: "pending_rag",
    lastActivityAt: new Date(),
  });

  const questionId = String(doc._id);

  // Step 2: After the HTTP response is sent, trigger FastAPI RAG validation.
  // FastAPI writes the final status + ragValidation directly to MongoDB.
  // This Next.js app does NOT poll or wait for the result.
  after(async () => {
    try {
      const ragResult = await ragValidate({
        question_id: questionId,
        question_text: `${v.value.title}\n${v.value.body ?? ""}`.trim(),
        category: v.value.tags?.[0],
        institution_id: INSTITUTION_ID,
      });
      if (ragResult?.status === "approved") {
        await runBotAnswerGeneration(questionId);
      }
    } catch (err) {
      // Non-fatal — question stays pending_rag for manual admin review.
      console.error(
        `[questions/route] RAG validation fire failed for ${questionId}:`,
        err
      );
    }
  });

  return created({
    questionId,
    status: "pending_rag",
    message:
      "Your question has been submitted and is being reviewed by our AI system. It will appear publicly once approved.",
    question: serializeQuestion(doc.toObject() as never),
  });
}
