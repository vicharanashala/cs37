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
