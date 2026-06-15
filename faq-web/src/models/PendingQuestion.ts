/**
 * src/models/PendingQuestion.ts
 *
 * Mongoose model for questions submitted by interns via /ask.
 *
 * Lifecycle:
 *   submitted → pending → resolved  (answer added, optionally promoted to FAQ)
 *                       → rejected  (duplicate, spam, off-topic)
 *
 * Maps to the `PendingQuestion` interface in app/resolve/page.tsx.
 */

import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ─── TypeScript interface ─────────────────────────────────────────────────────

export type QuestionStatus =
  | "pending"
  | "pending_rag"
  | "approved"
  | "rejected_by_rag"
  | "open"
  | "resolved"
  | "rejected";
export type QuestionPriority = "normal" | "urgent";
export type QuestionSource = "ask_page" | "yaksha_chat";

export interface IRagValidation {
  decision: "approved" | "rejected";
  reason: string;
  model: string;
  validatedAt: Date;
}

export interface ReplyModeration {
  reason: string;
  categories: string[];
  model: string;
  reviewedAt: string;
}

/** A grounding source attached to an AI helper-bot reply. */
export interface ReplySource {
  type: "rag" | "web";
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface Reply {
  id: string;
  author: string;
  authorEmail?: string;
  /** "bot" is the AI helper answer — rendered like a reply but styled apart. */
  authorRole: "admin" | "user" | "mentor" | "bot";
  content: string;
  timestamp: string;
  likes: number;
  status?: "pending" | "approved" | "rejected";
  moderation?: ReplyModeration;
  /** Present only on bot replies: the RAG/web sources used to ground them. */
  sources?: ReplySource[];
}

export interface IPendingQuestion extends Document {
  question: string;
  category: string;
  email: string;
  priority: QuestionPriority;
  status: QuestionStatus;
  answer?: string | null;
  suggestedAnswer?: string | null;
  promotedToFAQ?: Types.ObjectId | null;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  source?: QuestionSource;
  faqSuggestionStatus?: "pending" | "approved" | "rejected";

  authorRole: "user";
  initialAnswer?: string | null;
  answeredBy?: string | null;
  answeredByRole?: "admin" | "mentor" | null;
  views: number;
  replies: Reply[];
  ragValidation?: IRagValidation;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const RagValidationSchema = new Schema<IRagValidation>(
  {
    decision: { type: String, enum: ["approved", "rejected"], required: true },
    reason:   { type: String, default: "" },
    model:    { type: String, default: "" },
    validatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReplyModerationSchema = new Schema<ReplyModeration>(
  {
    reason:     { type: String, default: "" },
    categories: { type: [String], default: [] },
    model:      { type: String, default: "" },
    reviewedAt: { type: String, default: "" },
  },
  { _id: false }
);

const ReplySourceSchema = new Schema<ReplySource>(
  {
    type:    { type: String, enum: ["rag", "web"], required: true },
    title:   { type: String, default: "" },
    url:     { type: String, default: "" },
    snippet: { type: String, default: "" },
    score:   { type: Number, default: 0 },
  },
  { _id: false }
);

const ReplySchema = new Schema<Reply>(
  {
    id:         { type: String, required: true },
    author:     { type: String, default: "Anonymous Student" },
    authorEmail: { type: String, default: "" },
    authorRole: { type: String, enum: ["admin", "user", "mentor", "bot"], default: "user" },
    content:    { type: String, required: true },
    timestamp:  { type: String, required: true },
    likes:      { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
    },
    moderation: { type: ReplyModerationSchema, default: undefined },
    sources:    { type: [ReplySourceSchema], default: undefined },
  },
  { _id: false }
);

const PendingQuestionSchema = new Schema<IPendingQuestion>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    priority: {
      type: String,
      enum: ["normal", "urgent"] satisfies QuestionPriority[],
      default: "normal",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "pending_rag",
        "approved",
        "rejected_by_rag",
        "open",
        "resolved",
        "rejected",
      ] satisfies QuestionStatus[],
      default: "pending",
      index: true,
    },
    answer: {
      type: String,
      default: null,
    },
    suggestedAnswer: {
      type: String,
      default: null,
    },
    promotedToFAQ: {
      type: Schema.Types.ObjectId,
      ref: "FAQ",
      default: null,
    },
    resolvedBy: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    authorRole: {
      type: String,
      enum: ["user"],
      default: "user",
    },
    initialAnswer: {
      type: String,
      default: null,
    },
    answeredBy: {
      type: String,
      default: null,
    },
    answeredByRole: {
      type: String,
      enum: ["admin", "mentor", null],
      default: null,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    replies: {
      type: [ReplySchema],
      default: [],
    },
    ragValidation: {
      type: RagValidationSchema,
      default: undefined,
    },
    source: {
      type: String,
      enum: ["ask_page", "yaksha_chat"] satisfies QuestionSource[],
      default: "ask_page",
    },
    faqSuggestionStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"] as const,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: "pending_questions",
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Admins filter by status + priority most often
PendingQuestionSchema.index({ status: 1, priority: 1, createdAt: -1 });
// Community page lists by category + recency
PendingQuestionSchema.index({ category: 1, createdAt: -1 });
// FAQ suggestion queries filter by source
PendingQuestionSchema.index({ source: 1, status: 1 });

// ─── Model (singleton guard for Next.js hot-reload) ───────────────────────────

const PendingQuestion: Model<IPendingQuestion> =
  mongoose.models.PendingQuestion ??
  mongoose.model<IPendingQuestion>("PendingQuestion", PendingQuestionSchema);

export default PendingQuestion;
