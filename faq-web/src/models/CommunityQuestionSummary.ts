/**
 * src/models/CommunityQuestionSummary.ts
 *
 * Cached AI synthesis of the approved answers under one question.
 *
 * One summary per question (unique on questionId). `status` lets the question
 * detail page serve a cached summary instantly and regenerate only when stale
 * — e.g. after a new answer is approved or official documents change.
 *
 * `answerVersion` is the approvedAnswerCount the summary was built from; a
 * mismatch with the live count is one signal the summary is stale.
 */

import mongoose, { Model, Schema, Types } from "mongoose";
import { SUMMARY_STATUS, type SummaryStatus } from "@/lib/community/constants";
import type { ICitation } from "./CommunityAnswer";

/**
 * Note: this is a plain document shape (not `extends Document`) because the
 * field `model` (the AI engine identifier, required by QA_FEATURE.md) would
 * otherwise collide with Mongoose's reserved `Document.model` method.
 */
export interface ICommunityQuestionSummary {
  institutionId: string;
  questionId: Types.ObjectId;
  /** Headline synthesis paragraph. */
  summary: string;
  /** Official facts grounded in institutional sources (policy questions). */
  officialNotes: string;
  /** Practical tips drawn from student answers. */
  studentTips: string[];
  /** Open points / disagreements the synthesis could not resolve. */
  uncertainties: string[];
  status: SummaryStatus;
  sourceAnswerIds: Types.ObjectId[];
  citations: ICitation[];
  model: string;
  generatedAt: Date;
  /** approvedAnswerCount this summary was generated from. */
  answerVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const SummarySchema = new Schema<ICommunityQuestionSummary>(
  {
    institutionId: { type: String, required: true },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityQuestion",
      required: true,
      unique: true,
      index: true,
    },
    summary: { type: String, default: "" },
    officialNotes: { type: String, default: "" },
    studentTips: { type: [String], default: [] },
    uncertainties: { type: [String], default: [] },
    status: {
      type: String,
      enum: SUMMARY_STATUS as unknown as string[],
      default: "fresh",
      index: true,
    },
    sourceAnswerIds: {
      type: [Schema.Types.ObjectId],
      ref: "CommunityAnswer",
      default: [],
    },
    citations: { type: Schema.Types.Mixed, default: [] },
    model: { type: String, default: "" },
    generatedAt: { type: Date, default: Date.now },
    answerVersion: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "community_question_summaries" }
);

const CommunityQuestionSummary: Model<ICommunityQuestionSummary> =
  mongoose.models.CommunityQuestionSummary ??
  mongoose.model<ICommunityQuestionSummary>(
    "CommunityQuestionSummary",
    SummarySchema
  );

export default CommunityQuestionSummary;
