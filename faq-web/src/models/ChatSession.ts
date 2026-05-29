/**
 * src/models/ChatSession.ts
 *
 * Mongoose model for Yaksha chat sessions.
 *
 * Each session holds an array of messages (role + content + optional sources).
 * Sessions are keyed by a client-generated `sessionId` (stored in
 * localStorage/sessionStorage on the browser side).
 *
 * This enables:
 *  - Analytics on which questions are asked via chat (vs. the FAQ page)
 *  - Identifying gaps — chat queries that returned no good FAQ match
 *  - Future: feeding unresolved chat queries into PendingQuestion automatically
 */

import mongoose, { Document, Model, Schema } from "mongoose";

// ─── TypeScript interfaces ────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface IChatMessage {
  role: MessageRole;
  content: string;
  /** FAQ IDs cited as sources (e.g. ["1.1", "3.4"]) */
  sources: string[];
  /** True if the search returned no FAQ match (gap signal) */
  noMatch: boolean;
  timestamp: Date;
}

export interface IChatSession extends Document {
  /**
   * Client-generated UUID stored in the browser.
   * Not user-auth — just a stable session handle.
   */
  sessionId: string;
  messages: IChatMessage[];
  /** Total number of turns — denormalised for quick aggregation */
  messageCount: number;
  /** Last activity timestamp — used for TTL / cleanup */
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schema for a single message ─────────────────────────────────────────

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"] satisfies MessageRole[],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: {
      type: [String],
      default: [],
    },
    noMatch: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // embedded sub-document — no separate _id needed
);

// ─── Main session schema ──────────────────────────────────────────────────────

const ChatSessionSchema = new Schema<IChatSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    messages: {
      type: [ChatMessageSchema],
      default: [],
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "chat_sessions",
  }
);

// ─── TTL index — auto-delete sessions older than 90 days ─────────────────────
ChatSessionSchema.index(
  { lastActivityAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 } // 90 days
);

// ─── Model (singleton guard for Next.js hot-reload) ───────────────────────────

const ChatSession: Model<IChatSession> =
  mongoose.models.ChatSession ??
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);

export default ChatSession;
