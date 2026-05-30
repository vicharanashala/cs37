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

export interface Reply {
  id: string;
  author: string;
  authorRole: "admin" | "user" | "mentor";
  content: string;
  timestamp: string;
  likes: number;
}

export interface Thread {
  id: string;
  question: string;
  category: string;
  originalAuthor: string;
  authorRole: "user";
  initialAnswer: string;
  answeredBy: string;
  answeredByRole: "admin" | "mentor";
  createdAt: string;
  resolvedAt: string;
  replies: Reply[];
  views: number;
  status: "open" | "resolved";
}
