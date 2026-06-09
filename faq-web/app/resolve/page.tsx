"use client";

/**
 * app/resolve/page.tsx  →  Student Profile Page
 *
 * Shows the logged-in student's identity, contribution stats, and a tabbed
 * view of all their questions (community + legacy) and answers.
 *
 * Data: GET /api/community/my-contributions
 *   - x-student-id header  → community_questions / community_answers
 *   - Authorization: Bearer <jwt> → pending_questions (legacy /ask flow)
 *
 * Auth: redirects to /auth/signin when no JWT is present.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  User,
  HelpCircle,
  MessageSquare,
  CheckCircle,
  Clock,
  Calendar,
  ExternalLink,
  Inbox,
} from "lucide-react";
import Header from "@/components/Header";
import StatusBadge from "@/components/community/StatusBadge";
import { api } from "@/lib/community/client";
import { getAuthToken } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import type { AnswerDTO, QuestionDTO } from "@/lib/community/types";
import type { AnswerStatus, QuestionStatus } from "@/lib/community/constants";

// ─── Local types ──────────────────────────────────────────────────────────────

type QuestionDTOExtended = QuestionDTO & { isLegacy?: boolean };
type Tab = "questions" | "answers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the "name" portion of an email for the avatar initials. */
function emailToInitials(email: string): string {
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Display-friendly greeting name from email. */
function emailToName(email: string): string {
  const name = email.split("@")[0] ?? email;
  return name
    .split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Relative time string. */
function relativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}

/** Map QuestionStatus → AnswerStatus for StatusBadge reuse. */
function questionStatusToAnswerStatus(s: QuestionStatus): AnswerStatus {
  switch (s) {
    case "approved": return "approved";
    case "open":     return "approved";
    case "closed":   return "hidden";
    case "hidden":   return "hidden";
    case "deleted":  return "deleted";
    case "rejected_by_rag": return "rejected";
    default:         return "pending_review";
  }
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-accent",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon size={14} className={color} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: QuestionDTOExtended }) {
  const inner = (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-all",
        !q.isLegacy && "hover:border-accent/40 hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-medium leading-snug">{q.title}</p>
        <StatusBadge status={questionStatusToAnswerStatus(q.status as QuestionStatus)} />
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
        {q.isLegacy ? (
          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
            Via Ask
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <ExternalLink size={10} /> Community thread
          </span>
        )}
        {q.tags.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full border border-border">
            {q.tags[0]}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={10} /> {relativeTime(q.createdAt)}
        </span>
        {!q.isLegacy && (
          <span className="flex items-center gap-1">
            <CheckCircle size={10} /> {q.approvedAnswerCount} approved
          </span>
        )}
      </div>
    </div>
  );

  return q.isLegacy ? (
    <div>{inner}</div>
  ) : (
    <Link href={`/community/${q.id}`}>{inner}</Link>
  );
}

// ─── Answer card ──────────────────────────────────────────────────────────────

function AnswerCard({ a }: { a: AnswerDTO }) {
  return (
    <Link
      href={`/community/${a.questionId}`}
      className="block rounded-xl border border-border bg-card p-4 hover:border-accent/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs text-muted truncate">
          on: <span className="text-foreground/80">{a.questionTitle ?? "—"}</span>
        </p>
        <StatusBadge status={a.status} />
      </div>
      <p className="text-sm text-foreground/80 line-clamp-2">{a.body}</p>
      {a.review && a.review.reasons.length > 0 && (
        <p className="text-xs text-muted mt-1.5 line-clamp-1">
          {a.review.reasons.join(", ")}
        </p>
      )}
      <p className="text-xs text-muted mt-2 flex items-center gap-1">
        <Clock size={10} /> {relativeTime(a.createdAt)}
      </p>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [questions, setQuestions] = useState<QuestionDTOExtended[]>([]);
  const [answers, setAnswers] = useState<AnswerDTO[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("questions");

  // Auth guard — redirect when auth is resolved and there's no user.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/signin");
    }
  }, [authLoading, user, router]);

  // Fetch contributions once we know the user is logged in.
  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      try {
        const token = getAuthToken();
        const res = await api("/api/community/my-contributions", {
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          setQuestions((res.questions as QuestionDTOExtended[]) ?? []);
          setAnswers((res.answers as AnswerDTO[]) ?? []);
        }
      } finally {
        setDataLoading(false);
      }
    })();
  }, [authLoading, user]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const approvedAnswers = answers.filter((a) => a.status === "approved").length;
  const pendingAnswers  = answers.filter((a) => a.status === "pending_review").length;

  // While auth is resolving, show nothing (avoids flash of profile content).
  // Simple guard lets TypeScript narrow `user` to non-null below this line.
  if (authLoading || !user) return null;

  const initials = emailToInitials(user.email);
  const displayName = emailToName(user.email);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Profile hero ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-5">
            {/* Avatar */}
            <div className="shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center text-background text-xl font-bold shadow-lg shadow-accent/20">
              {initials}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{displayName}</h1>
              <p className="text-sm text-muted truncate flex items-center gap-1.5 mt-0.5">
                <User size={12} />
                {user.email}
              </p>
              <p className="text-xs text-muted flex items-center gap-1.5 mt-1">
                <Calendar size={11} />
                Student contributor
              </p>
            </div>

            {/* Quick actions */}
            <div className="shrink-0 flex flex-col gap-2">
              <Link
                href="/community/ask"
                className="text-xs px-3 py-1.5 rounded-lg bg-accent text-background font-medium hover:bg-accent/90 transition-colors"
              >
                Ask a question
              </Link>
              <Link
                href="/community"
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-muted transition-colors text-center"
              >
                Browse Q&amp;A
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        >
          <StatCard icon={HelpCircle}    label="Questions asked" value={questions.length} color="text-accent" />
          <StatCard icon={MessageSquare} label="Answers given"   value={answers.length}   color="text-violet-400" />
          <StatCard icon={CheckCircle}   label="Approved"        value={approvedAnswers}   color="text-success" />
          <StatCard icon={Clock}         label="Pending review"  value={pendingAnswers}    color="text-yellow-400" />
        </motion.div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <div className="flex items-center gap-1 mb-5 border-b border-border">
            {(["questions", "answers"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-3 px-4 text-sm font-medium capitalize transition-all border-b-2 -mb-px",
                  activeTab === tab
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {tab === "questions" ? (
                  <span className="flex items-center gap-1.5">
                    <HelpCircle size={13} /> Questions
                    <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-medium">
                      {questions.length}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <MessageSquare size={13} /> Answers
                    <span className="text-xs bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
                      {answers.length}
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab content ──────────────────────────────────────────────── */}
          {dataLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl border border-border bg-card animate-pulse"
                />
              ))}
            </div>
          ) : activeTab === "questions" ? (
            questions.length === 0 ? (
              <EmptyState
                icon={HelpCircle}
                title="No questions yet"
                message="Head over to the community and ask your first question."
                cta={{ label: "Ask a question", href: "/community/ask" }}
              />
            ) : (
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <QuestionCard q={q} />
                  </motion.div>
                ))}
              </div>
            )
          ) : answers.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No answers yet"
              message="Browse open questions and share your knowledge."
              cta={{ label: "Browse Q&A", href: "/community" }}
            />
          ) : (
            <div className="space-y-3">
              {answers.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <AnswerCard a={a} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  message,
  cta,
}: {
  icon: React.ElementType;
  title: string;
  message: string;
  cta: { label: string; href: string };
}) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-4">
        <Inbox size={24} className="text-muted opacity-50" />
      </div>
      <p className="text-base font-medium mb-1">{title}</p>
      <p className="text-sm text-muted mb-5">{message}</p>
      <Link
        href={cta.href}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-background text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        <Icon size={14} />
        {cta.label}
      </Link>
    </div>
  );
}