"use client";

/**
 * app/community/[questionId]/page.tsx
 *
 * Question detail: the synthesized "Verified Summary" (with official citations
 * kept separate from student tips), the approved answers with vote/report
 * actions, and the answer editor. Because review is asynchronous, after a
 * student submits an answer the page polls a few times so the status updates
 * from "pending review" to its decision without a manual refresh.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronUp,
  ChevronDown,
  Flag,
  Sparkles,
  ShieldCheck,
  FileText,
  Send,
  ArrowLeft,
  AlertTriangle,
  Eye,
  MessageSquare,
  Bot,
  ExternalLink,
  Globe2,
} from "lucide-react";
import Header from "@/components/Header";
import StatusBadge from "@/components/community/StatusBadge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/community/client";
import type {
  AnswerDTO,
  Capabilities,
  Citation,
  QuestionDTO,
  SuggestedAnswerDTO,
  SuggestedAnswerStatus,
  SummaryDTO,
} from "@/lib/community/types";

const REPORT_REASONS = [
  { value: "incorrect_policy", label: "Incorrect policy" },
  { value: "abusive", label: "Abusive" },
  { value: "spam", label: "Spam" },
  { value: "off_topic", label: "Off topic" },
  { value: "academic_integrity", label: "Academic integrity" },
  { value: "other", label: "Other" },
];

// Shared Markdown component overrides — mirrors community/page.tsx
const mdComponents: React.ComponentProps<typeof Markdown>["components"] = {
  h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-medium mt-2 mb-1">{children}</h4>,
  p: ({ children }) => <p className="text-sm leading-relaxed my-2">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1 text-sm">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return <code className="bg-muted/30 text-xs px-1.5 py-0.5 rounded font-mono" {...props}>{children}</code>;
    }
    return (
      <pre className="bg-muted/20 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono">
        <code className={className} {...props}>{children}</code>
      </pre>
    );
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{children}</a>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-4 italic text-muted my-2">{children}</blockquote>
  ),
  hr: () => <hr className="border-border my-4" />,
};

export default function QuestionDetailPage() {
  const params = useParams<{ questionId: string }>();
  const questionId = params.questionId;

  const [question, setQuestion] = useState<QuestionDTO | null>(null);
  const [answers, setAnswers] = useState<AnswerDTO[]>([]);
  const [suggestedAnswer, setSuggestedAnswer] = useState<SuggestedAnswerDTO | null>(null);
  const [suggestedAnswerStatus, setSuggestedAnswerStatus] =
    useState<SuggestedAnswerStatus>("unavailable");
  const [summary, setSummary] = useState<SummaryDTO | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [answerBody, setAnswerBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [pollsLeft, setPollsLeft] = useState(0);
  const [suggestedPollsLeft, setSuggestedPollsLeft] = useState(15);

  const load = useCallback(async () => {
    const res = await api(`/api/community/questions/${questionId}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setQuestion(res.question as QuestionDTO);
    setAnswers((res.answers as AnswerDTO[]) ?? []);
    setSuggestedAnswer((res.suggestedAnswer as SuggestedAnswerDTO) ?? null);
    setSuggestedAnswerStatus(
      (res.suggestedAnswerStatus as SuggestedAnswerStatus) ?? "unavailable"
    );
    setSummary((res.summary as SummaryDTO) ?? null);
    setCaps(res.capabilities as Capabilities);
    setLoading(false);
  }, [questionId]);

  // Initial fetch (inlined async so no setState runs synchronously in-effect).
  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // After submitting, review runs asynchronously — poll a few times so the
  // status updates on its own. Each tick decrements pollsLeft.
  useEffect(() => {
    if (pollsLeft <= 0) return;
    const t = setTimeout(() => {
      void load().then(() => setPollsLeft((n) => n - 1));
    }, 2000);
    return () => clearTimeout(t);
  }, [pollsLeft, load]);

  // New questions redirect here immediately. Poll briefly while the helper-bot
  // answer is generated, then leave a refresh hint instead of polling forever.
  useEffect(() => {
    if (suggestedAnswerStatus !== "generating" || suggestedPollsLeft <= 0) return;
    const t = setTimeout(() => {
      void load().then(() => setSuggestedPollsLeft((n) => n - 1));
    }, 2000);
    return () => clearTimeout(t);
  }, [suggestedAnswerStatus, suggestedPollsLeft, load]);

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (answerBody.trim().length < 15) {
      setSubmitMsg("Answer must be at least 15 characters.");
      return;
    }
    setSubmitting(true);
    setSubmitMsg("");
    const res = await api(`/api/community/questions/${questionId}/answers`, {
      method: "POST",
      body: JSON.stringify({ body: answerBody.trim() }),
    });
    setSubmitting(false);
    if (res.ok) {
      setAnswerBody("");
      setSubmitMsg("Your answer was submitted and is being reviewed.");
      await load();
      setPollsLeft(5);
    } else {
      setSubmitMsg(res.error?.message ?? "Could not submit answer.");
    }
  };

  const vote = async (answer: AnswerDTO, value: number) => {
    if (!caps?.canVote) return;
    const next = answer.myVote === value ? 0 : value;
    const res = await api(`/api/community/answers/${answer.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ value: next }),
    });
    if (res.ok) {
      setAnswers((prev) =>
        prev.map((a) =>
          a.id === answer.id
            ? { ...a, voteScore: res.voteScore as number, myVote: next }
            : a
        )
      );
    }
  };

  if (loading)
    return (
      <Shell>
        <div className="py-20 text-center text-muted text-sm">Loading…</div>
      </Shell>
    );

  if (notFound || !question)
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-lg font-medium mb-2">Question not found</p>
          <Link href="/community" className="text-accent text-sm hover:underline">
            ← Back to Community
          </Link>
        </div>
      </Shell>
    );

  const publicAnswers = answers.filter((a) => a.status === "approved");
  const myOtherAnswers = answers.filter((a) => a.isMine && a.status !== "approved");

  return (
    <Shell>
      <Link
        href="/community"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft size={15} /> Community
      </Link>

      {/* Question */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold mb-2">{question.title}</h1>
        {question.body && (
          <p className="text-sm text-foreground/80 whitespace-pre-line mb-3">
            {question.body}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {question.tags.map((t) => (
            <span key={t} className="text-accent/80 bg-accent/5 px-2 py-0.5 rounded-full">
              #{t}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <MessageSquare size={13} /> {question.approvedAnswerCount} answers
          </span>
          <span className="flex items-center gap-1">
            <Eye size={13} /> {question.viewCount} views
          </span>
        </div>
      </motion.div>

      {suggestedAnswerStatus === "generating" && (
        <SuggestedAnswerSkeleton timedOut={suggestedPollsLeft <= 0} />
      )}

      {suggestedAnswer && (
        <SuggestedAnswerCard
          answer={suggestedAnswer}
          canReport={!!caps?.canReport}
        />
      )}

      {/* Verified / synthesized summary */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-accent/30 bg-accent/5 p-5 mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-accent" />
            <span className="text-sm font-semibold text-accent">
              Synthesized Summary
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted border border-border rounded px-1.5 py-0.5">
              AI · from approved answers
            </span>
            {summary.status === "regenerating" && (
              <span className="text-xs text-muted">updating…</span>
            )}
          </div>

          <p className="text-sm leading-relaxed mb-3">{summary.summary}</p>

          {summary.officialNotes && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck size={14} className="text-success" />
                <span className="text-xs font-medium text-success">
                  Official policy
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {summary.officialNotes}
              </p>
            </div>
          )}

          {summary.studentTips.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted mb-1">
                Community tips
              </p>
              <ul className="space-y-1">
                {summary.studentTips.map((tip, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex gap-2">
                    <span className="text-accent">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.uncertainties.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-yellow-500/90">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                {summary.uncertainties.map((u, i) => (
                  <p key={i}>{u}</p>
                ))}
              </div>
            </div>
          )}

          {summary.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted mb-1">Official sources</p>
              {summary.citations.map((c, i) => (
                <p key={i} className="text-xs text-muted/80 flex items-center gap-1.5">
                  <FileText size={11} /> {c.title}{" "}
                  <span className="opacity-60">
                    ({c.section} · {c.version})
                  </span>
                </p>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* My pending / rejected submissions */}
      {myOtherAnswers.length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold text-muted">Your submission</h2>
          {myOtherAnswers.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={a.status} />
                {a.status === "pending_review" && (
                  <span className="text-xs text-muted">
                    Being reviewed — usually quick.
                  </span>
                )}
              </div>
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {a.body}
              </Markdown>
              {a.review && a.review.reasons.length > 0 && (
                <p className="text-xs text-muted mt-2">
                  Reasons: {a.review.reasons.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approved answers */}
      <h2 className="text-lg font-semibold mb-4">
        {publicAnswers.length} Community{" "}
        {publicAnswers.length === 1 ? "Answer" : "Answers"}
      </h2>

      {publicAnswers.length === 0 ? (
        <p className="text-sm text-muted mb-8">
          No approved answers yet. Be the first to help.
        </p>
      ) : (
        <div className="space-y-4 mb-10">
          {publicAnswers.map((a) => (
            <AnswerCard
              key={a.id}
              answer={a}
              canVote={!!caps?.canVote}
              canReport={!!caps?.canReport}
              onVote={vote}
            />
          ))}
        </div>
      )}

      {/* Answer editor */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Your answer</h3>
        {caps?.canAnswer ? (
          <form onSubmit={submitAnswer}>
            <textarea
              value={answerBody}
              onChange={(e) => setAnswerBody(e.target.value)}
              placeholder="Share what you know. Policy claims are checked against official sources before your answer appears."
              rows={5}
              maxLength={5000}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-muted mb-3"
            />
            <div className="flex items-center justify-between gap-3">
              <p
                className={cn(
                  "text-xs",
                  submitMsg.startsWith("Your answer") ? "text-success" : "text-muted"
                )}
              >
                {submitMsg}
              </p>
              <button
                type="submit"
                disabled={submitting || answerBody.trim().length < 15}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
                  !submitting && answerBody.trim().length >= 15
                    ? "bg-accent text-background hover:bg-accent-hover"
                    : "bg-card border border-border text-muted cursor-not-allowed"
                )}
              >
                <Send size={15} />
                {submitting ? "Submitting…" : "Submit answer"}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">
            This question is not open for new answers.
          </p>
        )}
      </div>
    </Shell>
  );
}

function SuggestedAnswerSkeleton({ timedOut }: { timedOut: boolean }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Bot size={16} className="text-accent" />
        <span className="text-sm font-semibold text-accent">AI Suggested Answer</span>
      </div>
      {timedOut ? (
        <p className="text-sm text-muted">
          Suggested answer is still being generated. Refresh shortly.
        </p>
      ) : (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 rounded bg-accent/15 w-full" />
          <div className="h-3 rounded bg-accent/15 w-5/6" />
          <div className="h-3 rounded bg-accent/15 w-2/3" />
        </div>
      )}
    </div>
  );
}

function SuggestedAnswerCard({
  answer,
  canReport,
}: {
  answer: SuggestedAnswerDTO;
  canReport: boolean;
}) {
  const officialSources = answer.citations.filter((c) => (c.sourceType ?? "rag") === "rag");
  const webSources = answer.citations.filter((c) => c.sourceType === "web");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-accent/30 bg-accent/5 p-5 mb-8"
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Bot size={16} className="text-accent" />
        <span className="text-sm font-semibold text-accent">AI Suggested Answer</span>
        <span className="text-[10px] uppercase tracking-wide text-muted border border-border rounded px-1.5 py-0.5">
          Generated from official FAQ sources and web search
        </span>
      </div>
      <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {answer.body}
      </Markdown>

      {(officialSources.length > 0 || webSources.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SourceGroup
            title="Official sources"
            icon={<ShieldCheck size={13} className="text-success" />}
            sources={officialSources}
          />
          <SourceGroup
            title="Web sources"
            icon={<Globe2 size={13} className="text-accent" />}
            sources={webSources}
          />
        </div>
      )}

      <div className="mt-3">
        <ReportControl answerId={answer.id} canReport={canReport} />
      </div>
    </motion.div>
  );
}

function SourceGroup({
  title,
  icon,
  sources,
}: {
  title: string;
  icon: React.ReactNode;
  sources: Citation[];
}) {
  if (sources.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/70 bg-background/50 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>
      <div className="space-y-1.5">
        {sources.map((source, i) => (
          <a
            key={`${source.documentId}-${i}`}
            href={source.documentId}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1.5 text-xs text-muted hover:text-accent transition-colors"
          >
            <ExternalLink size={11} className="mt-0.5 shrink-0" />
            <span>{source.title || source.documentId}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ReportControl({
  answerId,
  canReport,
}: {
  answerId: string;
  canReport: boolean;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("incorrect_policy");
  const [reported, setReported] = useState(false);

  const submitReport = async () => {
    const res = await api(`/api/community/answers/${answerId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setReported(true);
      setReporting(false);
    }
  };

  return (
    <>
      {canReport && !reported && (
        <button
          onClick={() => setReporting((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
        >
          <Flag size={12} /> Report
        </button>
      )}
      {reported && <span className="text-xs text-muted">Reported — thank you.</span>}
      <AnimatePresence>
        {reporting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex flex-wrap items-center gap-2 overflow-hidden"
          >
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              onClick={submitReport}
              className="text-xs px-3 py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-colors"
            >
              Submit report
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function AnswerCard({
  answer,
  canVote,
  canReport,
  onVote,
}: {
  answer: AnswerDTO;
  canVote: boolean;
  canReport: boolean;
  onVote: (a: AnswerDTO, v: number) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("incorrect_policy");
  const [reported, setReported] = useState(false);

  const submitReport = async () => {
    const res = await api(`/api/community/answers/${answer.id}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setReported(true);
      setReporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex gap-4">
        {/* Vote control */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <button
            onClick={() => onVote(answer, 1)}
            disabled={!canVote}
            aria-label="Upvote"
            className={cn(
              "p-1 rounded-md transition-colors",
              answer.myVote === 1
                ? "text-accent bg-accent/10"
                : "text-muted hover:text-foreground",
              !canVote && "opacity-40 cursor-not-allowed"
            )}
          >
            <ChevronUp size={18} />
          </button>
          <span className="text-sm font-semibold tabular-nums">
            {answer.voteScore}
          </span>
          <button
            onClick={() => onVote(answer, -1)}
            disabled={!canVote}
            aria-label="Downvote"
            className={cn(
              "p-1 rounded-md transition-colors",
              answer.myVote === -1
                ? "text-danger bg-danger/10"
                : "text-muted hover:text-foreground",
              !canVote && "opacity-40 cursor-not-allowed"
            )}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {answer.body}
          </Markdown>

          {answer.citations.length > 0 && (
            <div className="mt-3 rounded-lg border border-success/20 bg-success/5 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck size={13} className="text-success" />
                <span className="text-xs font-medium text-success">
                  Backed by official sources
                </span>
              </div>
              {answer.citations.map((c, i) => (
                <p key={i} className="text-xs text-muted/80 flex items-center gap-1.5">
                  <FileText size={11} /> {c.title}{" "}
                  <span className="opacity-60">({c.section})</span>
                </p>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-4">
            {canReport && !reported && (
              <button
                onClick={() => setReporting((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
              >
                <Flag size={12} /> Report
              </button>
            )}
            {reported && (
              <span className="text-xs text-muted">Reported — thank you.</span>
            )}
            {answer.isMine && (
              <span className="text-xs text-accent/80">Your answer</span>
            )}
          </div>

          <AnimatePresence>
            {reporting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex flex-wrap items-center gap-2 overflow-hidden"
              >
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={submitReport}
                  className="text-xs px-3 py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-colors"
                >
                  Submit report
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
