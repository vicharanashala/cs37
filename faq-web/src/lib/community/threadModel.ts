/**
 * src/lib/community/threadModel.ts
 *
 * Shared shapes for community threads (questions + answer + reply chain).
 *
 * These mirror the documents stored in the `community` collection of the
 * `samagama` database (seeded from src/lib/db/seedCommunity.ts). Both the API
 * route (app/api/community/threads/route.ts) and the frontend
 * (app/community/page.tsx) import from here, so the types stay independent of
 * the static threadsData.ts source file.
 */

/** Verdict written back after RAG moderation (FastAPI /validate-reply). */
export interface ReplyModeration {
  /** Short human-readable reason for the decision. */
  reason: string;
  /** Zero or more violation labels (e.g. "spam", "cheating", "unofficial_group"). */
  categories: string[];
  /** Model / pipeline that made the decision. */
  model: string;
  /** ISO timestamp of when moderation completed. */
  reviewedAt: string;
}

export interface Reply {
  id: string;
  author: string;
  authorRole: "admin" | "user" | "mentor";
  content: string;
  timestamp: string;
  likes: number;
  /**
   * Moderation status. Replies are saved "pending", then RAG validation flips
   * them to "approved" or "rejected". Legacy/seeded replies have no status and
   * are treated as approved.
   */
  status?: "pending" | "approved" | "rejected";
  /** Present once RAG moderation has run. */
  moderation?: ReplyModeration;
}

export interface Thread {
  id: string;
  question: string;
  category: string;
  originalAuthor: string;
  authorRole: "user";
  initialAnswer: string | null;
  answeredBy: string | null;
  answeredByRole: "admin" | "mentor" | null;
  createdAt: string;
  resolvedAt: string | null;
  replies: Reply[];
  views: number;
  status: "pending" | "pending_rag" | "approved" | "rejected_by_rag" | "open" | "resolved" | "rejected";
}
