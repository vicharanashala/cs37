/**
 * src/lib/community/types.ts
 *
 * Client-facing shapes returned by the community API (the serialized forms
 * from src/lib/community/serialize.ts). Shared by the frontend pages.
 */

import type { AnswerStatus, QuestionStatus } from "./constants";

export interface Citation {
  documentId: string;
  title: string;
  section: string;
  version: string;
  snippet: string;
  score: number;
  sourceType?: "rag" | "web";
}

export interface QuestionDTO {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: QuestionStatus;
  authorStudentId: string;
  acceptedAnswerId: string | null;
  approvedAnswerCount: number;
  viewCount: number;
  voteScore: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface ReviewDTO {
  relevanceScore: number;
  safetyAllowed: boolean;
  policyGrounded: boolean;
  academicIntegrityAllowed: boolean;
  decision: string;
  reasons: string[];
  model: string;
  reviewedAt: string;
}

export interface AnswerDTO {
  id: string;
  questionId: string;
  body: string;
  status: AnswerStatus;
  authorStudentId: string;
  authorEmail?: string;
  isMine: boolean;
  voteScore: number;
  myVote: number;
  reportCount?: number;
  citations: Citation[];
  review?: ReviewDTO;
  createdAt: string;
  questionTitle?: string;
}

export type SuggestedAnswerDTO = AnswerDTO;
export type SuggestedAnswerStatus = "generating" | "ready" | "unavailable";

export interface SummaryDTO {
  summary: string;
  officialNotes: string;
  studentTips: string[];
  uncertainties: string[];
  citations: Citation[];
  status: string;
  model: string;
  generatedAt: string;
}

export interface Capabilities {
  canAnswer: boolean;
  canVote: boolean;
  canReport: boolean;
  isAuthor: boolean;
  isAdmin: boolean;
}
