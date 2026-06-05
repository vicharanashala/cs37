"use client";

/**
 * app/community/my/page.tsx
 *
 * "My Contributions": the student's own questions and answers with their
 * current review status.
 *
 * Identity uses two signals:
 *   - x-student-id header  → community_questions / community_answers
 *   - Authorization: Bearer <jwt> → pending_questions (legacy /ask flow)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, HelpCircle, Clock } from "lucide-react";
import Header from "@/components/Header";
import StatusBadge from "@/components/community/StatusBadge";
import { api } from "@/lib/community/client";
import { getAuthToken } from "@/lib/auth";
import type { AnswerDTO, QuestionDTO } from "@/lib/community/types";
import type { AnswerStatus, QuestionStatus } from "@/lib/community/constants";

// Extend QuestionDTO locally to carry the isLegacy flag the server adds.
type QuestionDTOExtended = QuestionDTO & { isLegacy?: boolean };

/**
 * Map a QuestionStatus to the nearest AnswerStatus so we can reuse
 * <StatusBadge> (which was designed for answers) on question cards too.
 */
function questionStatusToAnswerStatus(status: QuestionStatus): AnswerStatus {
  switch (status) {
    case "approved": return "approved";
    case "open":     return "approved";      // open = publicly visible
    case "closed":   return "hidden";
    case "hidden":   return "hidden";
    case "deleted":  return "deleted";
    case "rejected_by_rag": return "rejected";
    case "pending_rag":
    default:         return "pending_review";
  }
}

export default function MyContributionsPage() {
  const [questions, setQuestions] = useState<QuestionDTOExtended[]>([]);
  const [answers, setAnswers] = useState<AnswerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = getAuthToken();
        const res = await api("/api/community/my-contributions", {
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          setQuestions((res.questions as QuestionDTOExtended[]) ?? []);
          setAnswers((res.answers as AnswerDTO[]) ?? []);
        } else {
          setError("Failed to load contributions.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold mb-6"
        >
          My <span className="text-accent">Contributions</span>
        </motion.h1>

        {loading ? (
          <div className="py-16 text-center text-muted text-sm">Loading…</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-muted">{error}</div>
        ) : (
          <div className="space-y-10">
            {/* Questions */}
            <section>
              <h2 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
                <HelpCircle size={15} /> Questions I asked ({questions.length})
              </h2>
              {questions.length === 0 ? (
                <p className="text-sm text-muted">You haven&apos;t asked anything yet.</p>
              ) : (
                <div className="space-y-2">
                  {questions.map((q) => {
                    const inner = (
                      <div className="block rounded-xl border border-border bg-card p-4 hover:border-muted transition-all">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium">{q.title}</p>
                          <StatusBadge status={questionStatusToAnswerStatus(q.status as QuestionStatus)} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <MessageSquare size={12} /> {q.approvedAnswerCount} approved answer{q.approvedAnswerCount !== 1 ? "s" : ""}
                          </span>
                          {q.isLegacy && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                              Via Ask
                            </span>
                          )}
                          {q.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> {q.tags[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    );

                    // Legacy questions don't have a /community/:id page.
                    return q.isLegacy ? (
                      <div key={q.id}>{inner}</div>
                    ) : (
                      <Link key={q.id} href={`/community/${q.id}`}>
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Answers */}
            <section>
              <h2 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
                <MessageSquare size={15} /> Answers I submitted ({answers.length})
              </h2>
              {answers.length === 0 ? (
                <p className="text-sm text-muted">You haven&apos;t answered anything yet.</p>
              ) : (
                <div className="space-y-2">
                  {answers.map((a) => (
                    <Link
                      key={a.id}
                      href={`/community/${a.questionId}`}
                      className="block rounded-xl border border-border bg-card p-4 hover:border-muted transition-all"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="text-xs text-muted truncate">
                          on: {a.questionTitle}
                        </p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-sm text-foreground/80 line-clamp-2">
                        {a.body}
                      </p>
                      {a.review && a.review.reasons.length > 0 && (
                        <p className="text-xs text-muted mt-1.5">
                          {a.review.reasons.join(", ")}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
