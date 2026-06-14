/**
 * src/lib/community/serialize.ts
 *
 * Convert Mongoose lean documents into plain, client-safe JSON.
 *
 * Safety rule (QA_FEATURE.md): rejected/hidden answers are NEVER exposed
 * publicly. The author of an answer may see their own pending/rejected status
 * (for "My Contributions"), and admins see everything — callers pass `viewer`
 * to opt into those wider views.
 */

import type { ICommunityAnswer, ICommunityQuestion } from "@/models";

type Lean<T> = T & { _id: unknown };

export function serializeQuestion(q: Lean<ICommunityQuestion>) {
  return {
    id: String(q._id),
    title: q.title,
    body: q.body,
    tags: q.tags ?? [],
    status: q.status,
    authorStudentId: q.authorStudentId,
    acceptedAnswerId: q.acceptedAnswerId ? String(q.acceptedAnswerId) : null,
    approvedAnswerCount: q.approvedAnswerCount ?? 0,
    viewCount: q.viewCount ?? 0,
    voteScore: q.voteScore ?? 0,
    lastActivityAt: q.lastActivityAt,
    createdAt: q.createdAt,
  };
}

export interface AnswerViewerOptions {
  /** studentId of the requester — unlocks their own non-public answers. */
  studentId?: string | null;
  /** admins see full review details and all statuses. */
  isAdmin?: boolean;
  /** the requester's vote on this answer, if known (-1 | 0 | 1). */
  myVote?: number;
}

export function serializeAnswer(
  a: Lean<ICommunityAnswer>,
  opts: AnswerViewerOptions = {}
) {
  const isOwner = !!opts.studentId && a.authorStudentId === opts.studentId;
  const showReview = opts.isAdmin || isOwner;

  return {
    id: String(a._id),
    questionId: String(a.questionId),
    body: a.body,
    status: a.status,
    authorStudentId: a.authorStudentId,
    authorEmail: a.authorEmail,
    isMine: isOwner,
    voteScore: a.voteScore ?? 0,
    myVote: opts.myVote ?? 0,
    reportCount: opts.isAdmin ? a.reportCount ?? 0 : undefined,
    citations: a.citations ?? [],
    // Review details: full for admin/owner, omitted for the public.
    review: showReview && a.review ? a.review : undefined,
    moderationLog: opts.isAdmin ? a.moderationLog ?? [] : undefined,
    createdAt: a.createdAt,
  };
}
