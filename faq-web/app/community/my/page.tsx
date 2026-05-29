"use client";

/**
 * app/community/my/page.tsx
 *
 * "My Contributions": the student's own questions and answers with their
 * current review status. Identity is the localStorage student id sent by the
 * api() helper.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, HelpCircle } from "lucide-react";
import Header from "@/components/Header";
import StatusBadge from "@/components/community/StatusBadge";
import { api } from "@/lib/community/client";
import type { AnswerDTO, QuestionDTO } from "@/lib/community/types";

export default function MyContributionsPage() {
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [answers, setAnswers] = useState<AnswerDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api("/api/community/my-contributions");
      if (res.ok) {
        setQuestions((res.questions as QuestionDTO[]) ?? []);
        setAnswers((res.answers as AnswerDTO[]) ?? []);
      }
      setLoading(false);
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
                  {questions.map((q) => (
                    <Link
                      key={q.id}
                      href={`/community/${q.id}`}
                      className="block rounded-xl border border-border bg-card p-4 hover:border-muted transition-all"
                    >
                      <p className="text-sm font-medium mb-1">{q.title}</p>
                      <p className="text-xs text-muted flex items-center gap-1">
                        <MessageSquare size={12} /> {q.approvedAnswerCount} approved
                        answers
                      </p>
                    </Link>
                  ))}
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
