/**
 * app/api/community/questions/route.ts
 *
 *   GET  /api/community/questions   — list/search/filter/sort the question feed
 *   POST /api/community/questions   — create a question (rate-limited, dedup'd)
 */

import type { NextRequest } from "next/server";
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
    status: "open",
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

  const doc = await CommunityQuestion.create({
    institutionId: INSTITUTION_ID,
    authorStudentId: student.studentId,
    title: v.value.title,
    body: v.value.body,
    normalizedTitle: normalizeTitle(v.value.title),
    questionHash: hash,
    tags: v.value.tags,
    status: "open",
    lastActivityAt: new Date(),
  });

  return created({ question: serializeQuestion(doc.toObject() as never) });
}
