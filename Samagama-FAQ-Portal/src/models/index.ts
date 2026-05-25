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

// Re-export interfaces for convenience in API route typing
export type { IFAQ } from "./FAQ";
export type { ICategory } from "./Category";
export type { IPendingQuestion, QuestionStatus, QuestionPriority } from "./PendingQuestion";
export type { IChatSession, IChatMessage, MessageRole } from "./ChatSession";
