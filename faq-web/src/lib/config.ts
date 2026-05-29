/**
 * src/lib/config.ts
 *
 * Centralized configuration for all API integrations.
 * Single source of truth for environment variables and derived constants.
 */

/** Next.js public runtime config for client-accessible values */
const publicConfig = {
  /** API base path - relative for same-origin, absolute for external services */
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "",
  /** RAG FastAPI backend URL - client-side uses this for chat suggestions */
  NEXT_PUBLIC_RAG_API: process.env.NEXT_PUBLIC_RAG_API ?? "http://localhost:8000",
  /** Institution/tenant identifier */
  NEXT_PUBLIC_INSTITUTION_ID:
    process.env.NEXT_PUBLIC_INSTITUTION_ID ?? "iit-ropar-vicharanashala",
} as const;

/** Server-only config - never exposed to client */
const serverConfig = {
  /** MongoDB connection string */
  MONGODB_URI: process.env.MONGODB_URI,
  /** RAG FastAPI backend URL (server-side) */
  RAG_API: process.env.RAG_API ?? "http://localhost:8000",
  /** Admin key for moderation endpoints */
  COMMUNITY_ADMIN_KEY: process.env.COMMUNITY_ADMIN_KEY ?? "dev-admin",
  /** Institution ID (server-side) */
  INSTITUTION_ID: process.env.INSTITUTION_ID ?? "iit-ropar-vicharanashala",
  /** Gemini API key for RAG pipeline */
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
} as const;

/** API route paths - single source of truth for all endpoint paths */
export const API_ROUTES = {
  // FAQ endpoints
  FAQS: "/api/faqs",
  ASK: "/api/ask",

  // Community Q&A endpoints
  COMMUNITY_QUESTIONS: "/api/community/questions",
  COMMUNITY_MY_CONTRIBUTIONS: "/api/community/my-contributions",

  // Admin endpoints
  ADMIN_PENDING_QUESTIONS: "/api/admin/pending-questions",
  ADMIN_REVIEW_QUEUE: "/api/admin/community/review-queue",
  ADMIN_ANSWER_REVIEW: (answerId: string) =>
    `/api/admin/community/answers/${answerId}/review`,

  // AI service endpoints
  AI_GENERATE_SUMMARY: "/api/ai/generate-community-summary",
  AI_REVIEW_ANSWER: "/api/ai/review-community-answer",

  // Nested community routes
  QUESTION_DETAIL: (questionId: string) =>
    `/api/community/questions/${questionId}`,
  QUESTION_ANSWERS: (questionId: string) =>
    `/api/community/questions/${questionId}/answers`,
  QUESTION_SUMMARY: (questionId: string) =>
    `/api/community/questions/${questionId}/summary`,
  ANSWER_VOTE: (answerId: string) =>
    `/api/community/answers/${answerId}/vote`,
  ANSWER_REPORT: (answerId: string) =>
    `/api/community/answers/${answerId}/report`,
} as const;

/** RAG API endpoints (FastAPI backend) */
export const RAG_API_ROUTES = {
  HEALTH: "/health",
  QUERY: "/query",
  SEARCH: "/search",
  VALIDATE_QUESTION: "/validate-question",
} as const;

export { publicConfig, serverConfig };
export default publicConfig;