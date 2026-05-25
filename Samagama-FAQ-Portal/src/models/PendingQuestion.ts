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

export type QuestionStatus = "pending" | "resolved" | "rejected";
export type QuestionPriority = "normal" | "urgent";

export interface IPendingQuestion extends Document {
  question: string;
  /** Category name selected by the submitter (optional) */
  category: string;
  /** Email for notification — not required */
  email: string;
  priority: QuestionPriority;
  status: QuestionStatus;
  /** Admin's typed answer when resolving */
  answer?: string;
  /** AI-suggested answer pre-filled in the resolve panel */
  suggestedAnswer?: string;
  /**
   * If this question was promoted to an FAQ entry, this holds the
   * ObjectId of the resulting FAQ document.
   */
  promotedToFAQ?: Types.ObjectId;
  /** Admin who resolved/rejected this question */
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

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
      enum: ["pending", "resolved", "rejected"] satisfies QuestionStatus[],
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
  },
  {
    timestamps: true,
    collection: "pending_questions",
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Admins filter by status + priority most often
PendingQuestionSchema.index({ status: 1, priority: 1, createdAt: -1 });

// ─── Model (singleton guard for Next.js hot-reload) ───────────────────────────

const PendingQuestion: Model<IPendingQuestion> =
  mongoose.models.PendingQuestion ??
  mongoose.model<IPendingQuestion>("PendingQuestion", PendingQuestionSchema);

export default PendingQuestion;
