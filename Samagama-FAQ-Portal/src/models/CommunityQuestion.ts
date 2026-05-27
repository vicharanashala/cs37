/**
 * src/models/CommunityQuestion.ts
 *
 * A student-created discussion topic in the Community Q&A module.
 *
 * Mirrors the `communityQuestions` shape in QA_FEATURE.md. Denormalised
 * counters (approvedAnswerCount, voteScore, lastActivityAt) keep list/sort
 * queries cheap; they are recomputed by the community service when answers
 * change state.
 */

import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { QUESTION_STATUS, type QuestionStatus } from "@/lib/community/constants";

export interface ICommunityQuestion extends Document {
  institutionId: string;
  authorStudentId: string;
  title: string;
  body: string;
  /** Lowercased, punctuation-stripped title for duplicate detection. */
  normalizedTitle: string;
  /** SHA-1 of normalizedTitle — exact-duplicate guard. */
  questionHash: string;
  tags: string[];
  status: QuestionStatus;
  acceptedAnswerId?: Types.ObjectId | null;
  approvedAnswerCount: number;
  viewCount: number;
  voteScore: number;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityQuestionSchema = new Schema<ICommunityQuestion>(
  {
    institutionId: { type: String, required: true, index: true },
    authorStudentId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, default: "", maxlength: 5000 },
    normalizedTitle: { type: String, required: true },
    questionHash: { type: String, required: true },
    tags: { type: [String], default: [] },
    status: {
      type: String,
      enum: QUESTION_STATUS as unknown as string[],
      default: "open",
      index: true,
    },
    acceptedAnswerId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityAnswer",
      default: null,
    },
    approvedAnswerCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    voteScore: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "community_questions" }
);

// ─── Indexes (from QA_FEATURE.md) ─────────────────────────────────────────────
CommunityQuestionSchema.index({ institutionId: 1, createdAt: -1 });
CommunityQuestionSchema.index({ institutionId: 1, questionHash: 1 });
CommunityQuestionSchema.index({ institutionId: 1, tags: 1 });
CommunityQuestionSchema.index({ institutionId: 1, lastActivityAt: -1 });
CommunityQuestionSchema.index({ authorStudentId: 1, createdAt: -1 });
// Full-text search across the community question feed.
CommunityQuestionSchema.index(
  { title: "text", body: "text", tags: "text" },
  { weights: { title: 5, tags: 3, body: 1 }, name: "community_question_search" }
);

const CommunityQuestion: Model<ICommunityQuestion> =
  mongoose.models.CommunityQuestion ??
  mongoose.model<ICommunityQuestion>(
    "CommunityQuestion",
    CommunityQuestionSchema
  );

export default CommunityQuestion;
