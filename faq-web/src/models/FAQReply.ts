/**
 * src/models/FAQReply.ts
 *
 * Mongoose model for per-FAQ user replies on the revamped FAQ page.
 *
 * Each FAQ entry gets its own reply thread. Replies appear immediately —
 * no review pipeline (unlike community answers). One reply per student
 * per FAQ is enforced by a unique compound index.
 *
 * The `likedBy` array implements the "one like per student" constraint
 * without a separate vote collection.
 */

import mongoose, { Document, Model, Schema } from "mongoose";

// ─── TypeScript interface ─────────────────────────────────────────────────────

export interface IFAQReply extends Document {
  /** The FAQ _id this reply belongs to */
  faqId: string;
  /** Student ID from x-student-id header (client-generated UUID) */
  authorStudentId: string;
  /** Reply body text */
  body: string;
  /** Denormalized like count (synced via $addToSet / $pull on likedBy) */
  likes: number;
  /** Student IDs who have liked this reply — used to track who liked */
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const FAQReplySchema = new Schema<IFAQReply>(
  {
    faqId: {
      type: String,
      required: true,
      index: true,
    },
    authorStudentId: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 1000,
      minlength: 10,
    },
    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
    likedBy: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "faq_replies",
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// One reply per student per FAQ
FAQReplySchema.index(
  { faqId: 1, authorStudentId: 1 },
  { unique: true, name: "faq_replies_unique_per_student" }
);

// Efficient listing: newest first within a given FAQ
FAQReplySchema.index(
  { faqId: 1, createdAt: -1 },
  { name: "faq_replies_listing" }
);

// ─── Pre-save hook: keep `likes` in sync with `likedBy` length ───────────────

FAQReplySchema.pre("save", function () {
  this.likes = this.likedBy.length;
});

// ─── Model (singleton guard for Next.js hot-reload) ───────────────────────────

const FAQReply: Model<IFAQReply> =
  mongoose.models.FAQReply ?? mongoose.model<IFAQReply>("FAQReply", FAQReplySchema);

export default FAQReply;