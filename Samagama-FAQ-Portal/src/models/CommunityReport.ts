/**
 * src/models/CommunityReport.ts
 *
 * A student flag on an answer. Reports feed the admin review workflow and let
 * moderators re-examine already-approved content. One report per student per
 * answer (unique index) prevents flag-spamming a single answer.
 */

import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const REPORT_REASONS = [
  "incorrect_policy",
  "abusive",
  "spam",
  "off_topic",
  "academic_integrity",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ICommunityReport extends Document {
  answerId: Types.ObjectId;
  questionId: Types.ObjectId;
  reporterStudentId: string;
  reason: ReportReason;
  note: string;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityReportSchema = new Schema<ICommunityReport>(
  {
    answerId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityAnswer",
      required: true,
      index: true,
    },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityQuestion",
      required: true,
    },
    reporterStudentId: { type: String, required: true },
    reason: {
      type: String,
      enum: REPORT_REASONS as unknown as string[],
      default: "other",
    },
    note: { type: String, default: "", maxlength: 1000 },
    resolved: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: "community_reports" }
);

CommunityReportSchema.index(
  { answerId: 1, reporterStudentId: 1 },
  { unique: true }
);

const CommunityReport: Model<ICommunityReport> =
  mongoose.models.CommunityReport ??
  mongoose.model<ICommunityReport>("CommunityReport", CommunityReportSchema);

export default CommunityReport;
