/**
 * src/models/FAQ.ts
 *
 * Mongoose model for FAQ entries.
 *
 * Schema fields match the `FAQ` interface in src/data/faqData.ts:
 *   { id, question, answer, category, categoryId, tags, helpful, notHelpful, lastUpdated }
 *
 * Additional DB-only fields:
 *   - `isPublished`  — soft-publish flag (admins can draft before publishing)
 *   - `version`      — incrementing edit version for audit purposes
 *   - `resolvedFrom` — optional reference to PendingQuestion that became this FAQ
 */

import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ─── TypeScript interface ─────────────────────────────────────────────────────

export interface IFAQ extends Document {
  /**
   * Human-readable ID (e.g. "1.1", "12.4").
   * Named `id` to match the existing frontend FAQ interface exactly.
   */
  id: string;
  question: string;
  answer: string;
  /** Display name of the parent category */
  category: string;
  /** Numeric foreign key matching Category.id */
  categoryId: number;
  tags: string[];
  keywords: string[];
  helpful: number;
  notHelpful: number;
  /** ISO date string, e.g. "2026-05-24" */
  lastUpdated: string;
  isPublished: boolean;
  /** Edit version, incremented on each update */
  version: number;
  /** Optional back-reference to the PendingQuestion this FAQ was resolved from */
  resolvedFrom?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const FAQSchema = new Schema<IFAQ>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: Number,
      required: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    keywords: {
      type: [String],
      default: [],
    },
    helpful: {
      type: Number,
      default: 0,
      min: 0,
    },
    notHelpful: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: String,
      default: () => new Date().toISOString().split("T")[0], // "YYYY-MM-DD"
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    resolvedFrom: {
      type: Schema.Types.ObjectId,
      ref: "PendingQuestion",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "faqs",
  }
);

// ─── Text index for full-text search (used by Yaksha chat fallback) ───────────
FAQSchema.index(
  { question: "text", answer: "text", tags: "text" },
  { weights: { question: 5, tags: 3, answer: 1 }, name: "faq_text_search" }
);

// ─── Compound index: category + published (common list query) ─────────────────
FAQSchema.index({ categoryId: 1, isPublished: 1 });

// ─── Model (singleton guard for Next.js hot-reload) ───────────────────────────

const FAQ: Model<IFAQ> =
  mongoose.models.FAQ ?? mongoose.model<IFAQ>("FAQ", FAQSchema);

export default FAQ;
