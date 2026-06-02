/**
 * src/lib/community/service.ts
 *
 * Orchestration between the MongoDB product layer and the AI service layer.
 * Route handlers stay thin; the multi-step workflows live here:
 *
 *   - runAnswerReview()        : pending_review → approve/reject/needs_admin_review
 *   - recomputeAnswerScore()   : refresh a single answer's voteScore from votes
 *   - recomputeQuestionStats() : refresh approvedAnswerCount / voteScore / activity
 *   - markSummaryStale()       : invalidate a cached summary
 *   - ensureSummary()          : serve cached or (re)generate a synthesis
 */

import { connectDB } from "@/lib/mongodb";
import {
  CommunityAnswer,
  CommunityQuestion,
  CommunityQuestionSummary,
  CommunityVote,
} from "@/models";
import { reviewCommunityAnswer } from "@/lib/ai/communityReview";
import { generateCommunitySummary } from "@/lib/ai/communitySummary";
import { generateBotAnswer, type AnswerSource } from "@/lib/ai/ragClient";
import { INSTITUTION_ID } from "@/lib/community/constants";

/**
 * Run the AI review for one answer and persist the decision. Idempotent and
 * safe to call from Next's `after()` (it re-establishes the cached DB
 * connection). Failures fall back to `needs_admin_review` so nothing is lost.
 */
export async function runAnswerReview(answerId: string): Promise<void> {
  await connectDB();
  const answer = await CommunityAnswer.findById(answerId);
  if (!answer || answer.status !== "pending_review") return;

  const question = await CommunityQuestion.findById(answer.questionId).lean();
  if (!question) return;

  try {
    const result = await reviewCommunityAnswer({
      institutionId: answer.institutionId,
      question: {
        title: question.title,
        body: question.body,
        tags: question.tags,
      },
      answer: answer.body,
      studentContext: { role: "student" },
    });

    answer.status =
      result.decision === "approve"
        ? "approved"
        : result.decision === "reject"
          ? "rejected"
          : "needs_admin_review";
    answer.review = {
      relevanceScore: result.relevanceScore,
      safetyAllowed: result.safetyAllowed,
      policyGrounded: result.policyGrounded,
      academicIntegrityAllowed: result.academicIntegrityAllowed,
      decision: result.decision,
      reasons: result.reasons,
      model: result.model,
      reviewedAt: new Date(),
    };
    answer.citations = result.citations;
    await answer.save();
  } catch {
    // Never leave an answer stuck in pending_review — escalate to humans.
    answer.status = "needs_admin_review";
    answer.review = {
      relevanceScore: 0,
      safetyAllowed: false,
      policyGrounded: false,
      academicIntegrityAllowed: false,
      decision: "needs_admin_review",
      reasons: ["review_error"],
      model: "error",
      reviewedAt: new Date(),
    };
    await answer.save();
  }

  await recomputeQuestionStats(String(answer.questionId));
  if (answer.status === "approved") await markSummaryStale(String(answer.questionId));
}

/** Recompute one answer's voteScore from the votes collection. */
export async function recomputeAnswerScore(answerId: string): Promise<number> {
  const agg = await CommunityVote.aggregate<{ total: number }>([
    { $match: { answerId: toObjectId(answerId) } },
    { $group: { _id: null, total: { $sum: "$value" } } },
  ]);
  const total = agg[0]?.total ?? 0;
  await CommunityAnswer.updateOne(
    { _id: answerId },
    { $set: { voteScore: total } }
  );
  return total;
}

/** Recompute a question's denormalised counters + activity timestamp. */
export async function recomputeQuestionStats(questionId: string): Promise<void> {
  const approved = await CommunityAnswer.find({
    questionId,
    status: "approved",
    authorStudentId: { $ne: "bot:helper" },
  })
    .select("voteScore")
    .lean();
  const voteScore = approved.reduce((s, a) => s + (a.voteScore ?? 0), 0);
  await CommunityQuestion.updateOne(
    { _id: questionId },
    {
      $set: {
        approvedAnswerCount: approved.length,
        voteScore,
        lastActivityAt: new Date(),
      },
    }
  );
}

/** Flag a question's cached summary as stale (next view regenerates it). */
export async function markSummaryStale(questionId: string): Promise<void> {
  await CommunityQuestionSummary.updateOne(
    { questionId },
    { $set: { status: "stale" } }
  );
}

/** Generate and persist one approved helper-bot answer after RAG approval. */
export async function runBotAnswerGeneration(questionId: string): Promise<void> {
  await connectDB();

  const question = await CommunityQuestion.findById(questionId).lean();
  if (!question || (question.status !== "approved" && question.status !== "open")) {
    return;
  }

  const existing = await CommunityAnswer.exists({
    questionId,
    authorStudentId: "bot:helper",
  });
  if (existing) return;

  const result = await generateBotAnswer({
    question_id: questionId,
    question_text: `${question.title} ${question.body}`.trim(),
    category: question.tags?.[0],
    institution_id: question.institutionId,
  });
  if (!result) return;

  await CommunityAnswer.create({
    institutionId: INSTITUTION_ID,
    questionId,
    authorStudentId: "bot:helper",
    body: result.answer,
    status: "approved",
    review: {
      relevanceScore: 1,
      safetyAllowed: true,
      policyGrounded: result.sources.some((s: AnswerSource) => s.type === "rag"),
      academicIntegrityAllowed: true,
      decision: "approve",
      reasons: ["auto-generated by AI helper bot"],
      model: result.model,
      reviewedAt: new Date(),
    },
    citations: result.sources.map((s: AnswerSource) => ({
      documentId: s.url,
      title: s.title,
      section: "",
      version: "",
      snippet: s.snippet,
      score: s.score,
      sourceType: s.type,
    })),
  });

  await recomputeQuestionStats(questionId);
  await markSummaryStale(questionId);
}

export interface SummaryView {
  summary: string;
  officialNotes: string;
  studentTips: string[];
  uncertainties: string[];
  citations: unknown[];
  status: string;
  model: string;
  generatedAt: Date;
}

/**
 * Return a usable summary for a question, regenerating when missing/stale.
 * Returns null when there are no approved answers to summarize.
 */
export async function ensureSummary(
  questionId: string,
  opts: { force?: boolean } = {}
): Promise<SummaryView | null> {
  await connectDB();
  const question = await CommunityQuestion.findById(questionId).lean();
  if (!question) return null;

  const existing = await CommunityQuestionSummary.findOne({ questionId });
  const fresh =
    existing &&
    existing.status === "fresh" &&
    existing.answerVersion === question.approvedAnswerCount;
  if (fresh && !opts.force) return toView(existing);

  const approved = await CommunityAnswer.find({
    questionId,
    status: "approved",
    authorStudentId: { $ne: "bot:helper" },
  })
    .select("body voteScore")
    .lean();

  if (approved.length === 0) {
    if (existing) {
      existing.status = "stale";
      await existing.save();
    }
    return null;
  }

  const result = await generateCommunitySummary({
    institutionId: question.institutionId,
    question: { title: question.title, body: question.body, tags: question.tags },
    answers: approved.map((a) => ({
      id: String(a._id),
      body: a.body,
      voteScore: a.voteScore ?? 0,
    })),
  });

  const doc = await CommunityQuestionSummary.findOneAndUpdate(
    { questionId },
    {
      $set: {
        institutionId: question.institutionId,
        questionId,
        summary: result.summary,
        officialNotes: result.officialNotes,
        studentTips: result.studentTips,
        uncertainties: result.uncertainties,
        citations: result.citations,
        sourceAnswerIds: result.sourceAnswerIds,
        model: result.model,
        status: "fresh",
        generatedAt: new Date(),
        answerVersion: question.approvedAnswerCount,
      },
    },
    { upsert: true, new: true }
  );

  return toView(doc!);
}

function toView(d: {
  summary: string;
  officialNotes: string;
  studentTips: string[];
  uncertainties: string[];
  citations: unknown[];
  status: string;
  model: string;
  generatedAt: Date;
}): SummaryView {
  return {
    summary: d.summary,
    officialNotes: d.officialNotes,
    studentTips: d.studentTips,
    uncertainties: d.uncertainties,
    citations: d.citations,
    status: d.status,
    model: d.model,
    generatedAt: d.generatedAt,
  };
}

import { Types } from "mongoose";
function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
