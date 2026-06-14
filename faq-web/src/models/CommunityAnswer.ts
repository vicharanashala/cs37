/**
 * src/models/CommunityAnswer.ts
 *
 * A student-submitted answer under a CommunityQuestion.
 *
 * Answers are NEVER public until reviewed (see status). The embedded `review`
 * sub-document records the AI decision and is the audit trail for rejected /
 * uncertain answers. `citations` hold the institutional sources the answer was
 * grounded against. `moderationLog` records admin overrides.
 */

import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  ANSWER_STATUS,
  REVIEW_DECISION,
  type AnswerStatus,
  type ReviewDecision,
} from "@/lib/community/constants";

/** Institutional source backing a policy claim (mirrors the FAQ corpus). */
export interface ICitation {
  documentId: string;
  title: string;
  section: string;
  version: string;
  snippet: string;
  score: number;
  sourceType?: "rag" | "web";
}

export interface IAnswerReview {
  relevanceScore: number;
  safetyAllowed: boolean;
  policyGrounded: boolean;
  academicIntegrityAllowed: boolean;
  decision: ReviewDecision;
  reasons: string[];
  model: string;
  reviewedAt: Date;
}

export interface IModerationEntry {
  decision: "approve" | "reject" | "hide";
  adminId: string;
  note: string;
  at: Date;
}

export interface ICommunityAnswer extends Document {
  institutionId: string;
  questionId: Types.ObjectId;
  authorStudentId: string;
  authorEmail?: string;
  body: string;
  status: AnswerStatus;
  review?: IAnswerReview;
  citations: ICitation[];
  voteScore: number;
  reportCount: number;
  moderationLog: IModerationEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const CitationSchema = new Schema<ICitation>(
  {
    documentId: { type: String, required: true },
    title: { type: String, default: "" },
    section: { type: String, default: "" },
    version: { type: String, default: "" },
    snippet: { type: String, default: "" },
    score: { type: Number, default: 0 },
    sourceType: { type: String, enum: ["rag", "web"], default: "rag" },
  },
  { _id: false }
);

const ReviewSchema = new Schema<IAnswerReview>(
  {
    relevanceScore: { type: Number, default: 0 },
    safetyAllowed: { type: Boolean, default: false },
    policyGrounded: { type: Boolean, default: false },
    academicIntegrityAllowed: { type: Boolean, default: false },
    decision: {
      type: String,
      enum: REVIEW_DECISION as unknown as string[],
      required: true,
    },
    reasons: { type: [String], default: [] },
    model: { type: String, default: "" },
    reviewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ModerationEntrySchema = new Schema<IModerationEntry>(
  {
    decision: { type: String, enum: ["approve", "reject", "hide"], required: true },
    adminId: { type: String, default: "admin" },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CommunityAnswerSchema = new Schema<ICommunityAnswer>(
  {
    institutionId: { type: String, required: true },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityQuestion",
      required: true,
      index: true,
    },
    authorStudentId: { type: String, required: true },
    authorEmail: { type: String, default: "" },
    body: { type: String, required: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ANSWER_STATUS as unknown as string[],
      default: "pending_review",
      index: true,
    },
    review: { type: ReviewSchema, default: undefined },
    citations: { type: [CitationSchema], default: [] },
    voteScore: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    moderationLog: { type: [ModerationEntrySchema], default: [] },
  },
  { timestamps: true, collection: "community_answers" }
);

// ─── Indexes (from QA_FEATURE.md) ─────────────────────────────────────────────
CommunityAnswerSchema.index({ questionId: 1, status: 1, voteScore: -1 });
CommunityAnswerSchema.index({ institutionId: 1, status: 1, createdAt: -1 });
CommunityAnswerSchema.index({ authorStudentId: 1, createdAt: -1 });

const CommunityAnswer: Model<ICommunityAnswer> =
  mongoose.models.CommunityAnswer ??
  mongoose.model<ICommunityAnswer>("CommunityAnswer", CommunityAnswerSchema);

export default CommunityAnswer;
