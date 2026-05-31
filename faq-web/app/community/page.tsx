"use client";

/**
 * app/community/page.tsx
 *
 * Community Q&A home: search, category filter, sort (recent / most-answered /
 * unanswered / trending) and an "Ask a question" entry point.
 *
 * Content is fetched live from GET /api/community/threads, which reads the
 * `community` collection in MongoDB. Each question card shows the genuine
 * answer and the full reply chain (author, role, content, likes).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  MessageSquare,
  MessageCircle,
  Search,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  HelpCircle,
  Eye,
  ThumbsUp,
  Send,
  Shield,
  User,
  Award,
  ChevronDown,
  Mail,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import YakshaChat from "@/components/YakshaChat";
import { cn } from "@/lib/utils";
import type { Thread, Reply } from "@/lib/community/threadModel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SORTS = [
  { key: "recent", label: "Recent", icon: Clock },
  { key: "answered", label: "Most answered", icon: CheckCircle },
  { key: "unanswered", label: "Unanswered", icon: HelpCircle },
  { key: "trending", label: "Trending", icon: TrendingUp },
] as const;

// ---------------------------------------------------------------------------
// Role badge config (same as threads/page.tsx)
// ---------------------------------------------------------------------------

const roleConfig = {
  admin: {
    label: "Admin",
    icon: Shield,
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
  },
  mentor: {
    label: "Mentor",
    icon: Award,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
  },
  user: {
    label: "Student",
    icon: User,
    color: "text-muted",
    bg: "bg-card",
    border: "border-border",
  },
};

// ---------------------------------------------------------------------------
// ReplyCard (same as threads/page.tsx)
// ---------------------------------------------------------------------------

function ReplyCard({ reply }: { reply: Reply }) {
  const [liked, setLiked] = useState(false);
  const config = roleConfig[reply.authorRole];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4",
        reply.authorRole === "admin" || reply.authorRole === "mentor"
          ? `${config.bg} ${config.border}`
          : "bg-background border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            config.bg,
            "border",
            config.border,
          )}
        >
          <Icon size={14} className={config.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold">{reply.author}</span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-medium",
                config.bg,
                config.color,
              )}
            >
              {config.label}
            </span>
            <span className="text-xs text-muted">· {reply.timestamp}</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {reply.content}
          </p>
          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={() => setLiked(!liked)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all",
                liked
                  ? "text-accent bg-accent/10"
                  : "text-muted hover:text-foreground hover:bg-card",
              )}
            >
              <ThumbsUp size={12} />
              <span>{reply.likes + (liked ? 1 : 0)}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// QuestionCard — full ThreadCard UI: real answer + real replies
// ---------------------------------------------------------------------------

function QuestionCard({ thread: initialThread }: { thread: Thread }) {
  const [thread, setThread] = useState(initialThread);
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answerConfig = roleConfig[thread.answeredByRole ?? "admin"];
  const AnswerIcon = answerConfig.icon;
  const resolved = thread.status === "resolved";

  const handleAddReply = async () => {
    const content = replyText.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/community/threads/${thread.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Failed to post reply");
      }

      // Use the reply the server actually saved (id + timestamp from DB).
      setThread({
        ...thread,
        replies: [...thread.replies, json.reply as Reply],
      });
      setReplyText("");
      setShowReplyForm(false);

      toast.success(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-semibold">
            <Mail size={14} />
            <span>Reply posted</span>
          </div>
          <p className="text-xs opacity-80">
            Notification sent to thread participants
          </p>
        </div>,
        { duration: 4000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      layout
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      {/* Thread Header */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Category + status chips */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                {thread.category}
              </span>
              {resolved ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium flex items-center gap-1">
                  <CheckCircle size={11} />
                  Resolved
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted font-medium flex items-center gap-1">
                  <HelpCircle size={11} />
                  Open
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-base sm:text-lg font-semibold leading-snug mb-2">
              {thread.question}
            </h3>

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <User size={12} />
                {thread.originalAuthor}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {thread.createdAt}
              </span>
              <span className="flex items-center gap-1">
                <Eye size={12} />
                {thread.views} views
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle size={12} />
                {thread.replies.length}{" "}
                {thread.replies.length === 1 ? "reply" : "replies"}
              </span>
            </div>
          </div>
        </div>

        {/* Initial Answer */}
        {/*<div
          className={cn(
            "rounded-xl border p-4 mt-3",
            answerConfig.bg,
            answerConfig.border,
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center border",
                answerConfig.bg,
                answerConfig.border
              )}
            >
              <AnswerIcon size={12} className={answerConfig.color} />
            </div>
            <span className="text-sm font-semibold">{thread.answeredBy}</span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-medium",
                answerConfig.bg,
                answerConfig.color
              )}
            >
              {answerConfig.label}
            </span>
            <span className="text-xs text-muted">· Original answer</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {thread.initialAnswer}
          </p>
        </div>*/}

        {/* Footer: reply button always visible */}
        <div className="mt-4 flex items-center gap-2">
          {thread.replies.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all text-sm text-muted hover:text-accent"
            >
              <MessageCircle size={14} />
              <span>
                {expanded ? "Hide" : "Show"} {thread.replies.length}{" "}
                {thread.replies.length === 1 ? "reply" : "replies"}
              </span>
              <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                <ChevronDown size={14} />
              </motion.span>
            </button>
          )}
          {!showReplyForm ? (
            <button
              onClick={() => setShowReplyForm(true)}
              className={cn(
                "flex items-center gap-2 py-2.5 rounded-xl border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all text-sm text-muted hover:text-accent",
                thread.replies.length === 0 && "flex-1",
              )}
            >
              <Send size={14} />
              <span>Add a reply</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setShowReplyForm(false);
                setReplyText("");
              }}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl border border-border hover:bg-card transition-all text-sm text-muted hover:text-foreground"
            >
              <X size={14} />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline reply form (always visible when showReplyForm is true) */}
      <AnimatePresence>
        {showReplyForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-background/50"
          >
            <div className="p-5 space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-accent/30 bg-accent/5 p-4"
              >
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your follow-up question or comment..."
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none placeholder:text-muted"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={handleAddReply}
                    disabled={!replyText.trim() || submitting}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      replyText.trim() && !submitting
                        ? "bg-accent text-background hover:bg-accent-hover"
                        : "bg-card text-muted border border-border cursor-not-allowed",
                    )}
                  >
                    <Send size={12} />
                    {submitting ? "Posting…" : "Post Reply"}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replies panel (shown when expanded) */}
      <AnimatePresence>
        {expanded && thread.replies.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-background/50"
          >
            <div className="p-5 space-y-3">
              {thread.replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommunityHome() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<string>("recent");
  const [category, setCategory] = useState<string | null>(null);

  // Fetch threads from the database (GET /api/community/threads).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/community/threads");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          throw new Error(json?.error?.message ?? "Failed to load questions");
        }
        setThreads(json.threads as Thread[]);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load questions",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Categories derived from whatever threads came back from the DB.
  const categories = useMemo(
    () => Array.from(new Set(threads.map((t) => t.category))),
    [threads],
  );

  // Search + filter + sort, all client-side over the fetched threads.
  const questions = useMemo(() => {
    let data = [...threads];

    // Search filter
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      data = data.filter(
        (t) =>
          t.question.toLowerCase().includes(q) ||
          t.initialAnswer?.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.replies.some((r) => r.content.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (category) {
      data = data.filter((t) => t.category === category);
    }

    // Sort / sub-filter
    if (sort === "recent") {
      data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === "answered") {
      data.sort((a, b) => b.replies.length - a.replies.length);
    } else if (sort === "unanswered") {
      data = data.filter((t) => t.replies.length === 0);
    } else if (sort === "trending") {
      data.sort((a, b) => b.views - a.views);
    }

    return data;
  }, [threads, query, category, sort]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                Community <span className="text-accent">Q&amp;A</span>
              </h1>
              <p className="text-muted text-sm max-w-xl">
                Real conversations between students, mentors, and admins. Every
                answer is reviewed for safety and accuracy before it appears.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/community/my"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-border text-muted hover:text-foreground hover:border-muted transition-colors"
              >
                My contributions
              </Link>
              <Link
                href="/community/ask"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-background font-medium hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
              >
                <Plus size={18} />
                Ask a question
              </Link>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search community questions…"
              className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
            />
          </motion.div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Sort tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {SORTS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  sort === s.key
                    ? "bg-accent text-background"
                    : "bg-card border border-border text-muted hover:text-foreground",
                )}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs transition-all",
              category === null
                ? "bg-accent/15 text-accent border border-accent/40"
                : "border border-border text-muted hover:text-foreground",
            )}
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs transition-all",
                category === c
                  ? "bg-accent/15 text-accent border border-accent/40"
                  : "border border-border text-muted hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Question list */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <MessageSquare
              size={48}
              className="text-muted mx-auto mb-4 opacity-30"
            />
            <p className="text-lg font-medium mb-1">Couldn’t load questions</p>
            <p className="text-sm text-muted">{error}</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare
              size={48}
              className="text-muted mx-auto mb-4 opacity-30"
            />
            <p className="text-lg font-medium mb-1">No questions found</p>
            <p className="text-sm text-muted mb-5">
              Try a different search, filter, or be the first to start a
              discussion.
            </p>
            <Link
              href="/community/ask"
              className="text-sm text-accent hover:underline"
            >
              Ask a question →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((thread, idx) => (
              <motion.div
                key={thread.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
              >
                <QuestionCard thread={thread} />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <YakshaChat />
    </div>
  );
}
