/**
 * src/models/Category.ts
 *
 * Mongoose model for FAQ categories.
 *
 * Maps to the existing `Category` interface in src/data/faqData.ts:
 *   { id, name, icon, description, count }
 *
 * `count` is a derived/denormalised field kept in sync whenever
 * FAQs in a category are added/removed.
 */

import mongoose, { Document, Model, Schema } from "mongoose";

// ─── TypeScript interface ─────────────────────────────────────────────────────

export interface ICategory extends Document {
  /** Numeric ID matching Category.id in src/data/faqData.ts */
  id: number;
  name: string;
  /** Emoji icon, e.g. "📋" */
  icon: string;
  description: string;
  /** Denormalised count of active FAQs in this category */
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const CategorySchema = new Schema<ICategory>(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
    collection: "categories",
  }
);

// ─── Model (singleton guard for Next.js hot-reload) ───────────────────────────

const Category: Model<ICategory> =
  mongoose.models.Category ??
  mongoose.model<ICategory>("Category", CategorySchema);

export default Category;
