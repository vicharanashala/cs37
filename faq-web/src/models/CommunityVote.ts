/**
 * src/models/CommunityVote.ts
 *
 * One vote per student per answer. The unique compound index enforces this so
 * re-voting updates (or clears) the existing vote rather than inflating score.
 * The answer's denormalised `voteScore` is recomputed from these rows.
 */

import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICommunityVote extends Document {
  answerId: Types.ObjectId;
  questionId: Types.ObjectId;
  voterStudentId: string;
  /** -1, 0 (cleared), or 1 */
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityVoteSchema = new Schema<ICommunityVote>(
  {
    answerId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityAnswer",
      required: true,
    },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityQuestion",
      required: true,
    },
    voterStudentId: { type: String, required: true },
    value: { type: Number, enum: [-1, 0, 1], default: 0 },
  },
  { timestamps: true, collection: "community_votes" }
);

CommunityVoteSchema.index(
  { answerId: 1, voterStudentId: 1 },
  { unique: true }
);

const CommunityVote: Model<ICommunityVote> =
  mongoose.models.CommunityVote ??
  mongoose.model<ICommunityVote>("CommunityVote", CommunityVoteSchema);

export default CommunityVote;
