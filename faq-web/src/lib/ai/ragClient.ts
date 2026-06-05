/**
 * src/lib/ai/ragClient.ts
 *
 * Typed HTTP client for the FastAPI RAG backend.
 *
 * Only one integration point right now:
 *   POST /validate-question
 *
 * The backend receives the question, runs it through its RAG pipeline, and
 * responds with an approved / rejected decision + reason. It also writes
 * the result directly back to MongoDB itself (updating the question's status
 * and ragValidation fields), so this Next.js app does NOT need to do a
 * follow-up DB write for the validation result.
 *
 * If the FastAPI service is unreachable, we fail open (return a soft
 * "pending" result) so that a backend outage doesn't break question
 * submission — admins can review pending_rag questions manually.
 */

const RAG_BASE = process.env.RAG_API ?? "http://localhost:8000";

/** Shape of the payload sent to FastAPI POST /validate-question */
export interface ValidateQuestionPayload {
  /** MongoDB ObjectId string — FastAPI uses this to write back the result */
  question_id: string;
  /** The full question text submitted by the student */
  question_text: string;
  /** Optional category selected in the form */
  category?: string;
  /** Institution / tenant identifier */
  institution_id?: string;
}

/** Shape of the response from FastAPI POST /validate-question */
export interface RagValidationResult {
  /** "approved" | "rejected" */
  status: "approved" | "rejected";
  /** Human-readable reason returned by the RAG model */
  reason: string;
  /** Model / pipeline name that made the decision */
  model?: string;
}

/**
 * Call FastAPI's /validate-question endpoint.
 *
 * Returns `null` on network/timeout error so callers can fail gracefully.
 * Timeout is set to 15 s — generous for a RAG pipeline but not infinite.
 */
export async function validateQuestion(
  payload: ValidateQuestionPayload
): Promise<RagValidationResult | null> {
  const url = `${RAG_BASE}/validate-question`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[ragClient] /validate-question returned ${res.status} for question ${payload.question_id}`
      );
      return null;
    }

    const data = (await res.json()) as RagValidationResult;
    return data;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error(
        `[ragClient] /validate-question timed out for question ${payload.question_id}`
      );
    } else {
      console.error(`[ragClient] /validate-question error:`, err);
    }
    return null;
  }
}

/** Shape of the payload sent to FastAPI POST /validate-reply */
export interface ValidateReplyPayload {
  /** Reply id (the one stored in the thread's replies array) */
  reply_id: string;
  /** Thread (question) id the reply belongs to */
  thread_id: string;
  /** The reply text to moderate */
  content: string;
  /** The thread's question, sent for context (optional) */
  question?: string;
}

/** Shape of the response from FastAPI POST /validate-reply */
export interface RagReplyValidationResult {
  reply_id: string;
  thread_id: string;
  /** "approved" | "rejected" */
  status: "approved" | "rejected";
  /** Human-readable reason for the decision */
  reason: string;
  /** Zero or more violation labels */
  categories: string[];
  /** Model / pipeline that made the decision */
  model: string;
}

/**
 * Call FastAPI's /validate-reply endpoint to moderate a community reply.
 *
 * Returns `null` on network/timeout/HTTP error so the caller can fail open
 * (leave the reply "pending" for manual review rather than blocking it).
 */
export async function validateReply(
  payload: ValidateReplyPayload
): Promise<RagReplyValidationResult | null> {
  const url = `${RAG_BASE}/validate-reply`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[ragClient] /validate-reply returned ${res.status} for reply ${payload.reply_id}`
      );
      return null;
    }

    return (await res.json()) as RagReplyValidationResult;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error(
        `[ragClient] /validate-reply timed out for reply ${payload.reply_id}`
      );
    } else {
      console.error(`[ragClient] /validate-reply error:`, err);
    }
    return null;
  }
}

/** Shape of the payload sent to FastAPI POST /generate-answer */
export interface GenerateAnswerPayload {
  question_id: string;
  question_text: string;
  category?: string;
  institution_id?: string;
}

/** A single source used to ground the generated answer */
export interface AnswerSource {
  type: "rag" | "web";
  title: string;
  url: string;
  snippet: string;
  score: number;
}

/** Shape of the response from FastAPI POST /generate-answer */
export interface GenerateAnswerResult {
  answer: string;
  sources: AnswerSource[];
  model: string;
}

/**
 * Call FastAPI's /generate-answer endpoint to produce an AI helper answer
 * using dual knowledge: institutional RAG corpus + real-time web search.
 */
export async function generateBotAnswer(
  payload: GenerateAnswerPayload
): Promise<GenerateAnswerResult | null> {
  const url = `${RAG_BASE}/generate-answer`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[ragClient] /generate-answer returned ${res.status} for question ${payload.question_id}`
      );
      return null;
    }

    return (await res.json()) as GenerateAnswerResult;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error(
        `[ragClient] /generate-answer timed out for question ${payload.question_id}`
      );
    } else {
      console.error(`[ragClient] /generate-answer error:`, err);
    }
    return null;
  }
}
