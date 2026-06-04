/**
 * src/models/index.ts
 *
 * Barrel export — import all models from one place.
 *
 * Usage:
 *   import { FAQ, Category, PendingQuestion, ChatSession } from "@/models";
 *
 * Always call connectDB() before using any model in a Server Action or
 * Route Handler.
 */

export { default as FAQ } from "./FAQ";
export { default as Category } from "./Category";
export { default as PendingQuestion } from "./PendingQuestion";
export { default as ChatSession } from "./ChatSession";
export { default as User } from "./User";

export type { IUser } from "./User";

// ─── Community Q&A models ─────────────────────────────────────────────────────
export { default as CommunityQuestion } from "./CommunityQuestion";
export { default as CommunityAnswer } from "./CommunityAnswer";
export { default as CommunityQuestionSummary } from "./CommunityQuestionSummary";
export { default as CommunityVote } from "./CommunityVote";
export { default as CommunityReport } from "./CommunityReport";

// ─── FAQ reply model (stage 1 of faq-revamp) ──────────────────────────────────
export { default as FAQReply } from "./FAQReply";

// Re-export interfaces for convenience in API route typing
export type { IFAQ } from "./FAQ";
export type { IFAQReply } from "./FAQReply";
export type { ICategory } from "./Category";
export type { IPendingQuestion, QuestionStatus, QuestionPriority } from "./PendingQuestion";
export type { IChatSession, IChatMessage, MessageRole } from "./ChatSession";
export type { ICommunityQuestion } from "./CommunityQuestion";
export type {
  ICommunityAnswer,
  ICitation,
  IAnswerReview,
  IModerationEntry,
} from "./CommunityAnswer";
export type { ICommunityQuestionSummary } from "./CommunityQuestionSummary";
export type { ICommunityVote } from "./CommunityVote";
export type { ICommunityReport, ReportReason } from "./CommunityReport";