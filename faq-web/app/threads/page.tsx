"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import YakshaChat from "@/components/YakshaChat";
import { threadsData, type Thread, type Reply } from "@/data/threadsData";
import {
  MessageCircle,
  Eye,
  ThumbsUp,
  Send,
  CheckCircle,
  Shield,
  User,
  Award,
  Clock,
  ChevronDown,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
          : "bg-background border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            config.bg,
            "border",
            config.border
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
                config.color
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
                  : "text-muted hover:text-foreground hover:bg-card"
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

function ThreadCard({ thread: initialThread }: { thread: Thread }) {
  const [thread, setThread] = useState(initialThread);
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answerConfig = roleConfig[thread.answeredByRole];
  const AnswerIcon = answerConfig.icon;

  const handleAddReply = async () => {
    const content = replyText.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/community/threads/${thread.id}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
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
        { duration: 4000 }
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post reply"
      );
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
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                {thread.category}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium flex items-center gap-1">
                <CheckCircle size={11} />
                Resolved
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold leading-snug mb-2">
              {thread.question}
            </h3>
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
                {thread.replies.length} replies
              </span>
            </div>
          </div>
        </div>

        {/* Initial Answer */}
        <div
          className={cn(
            "rounded-xl border p-4 mt-3",
            answerConfig.bg,
            answerConfig.border
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
        </div>

        {/* Expand button */}
        {thread.replies.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all text-sm text-muted hover:text-accent"
          >
            <MessageCircle size={14} />
            <span>
              {expanded ? "Hide" : "Show"} {thread.replies.length} repl
              {thread.replies.length === 1 ? "y" : "ies"}
            </span>
            <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown size={14} />
            </motion.span>
          </button>
        )}
      </div>

      {/* Replies */}
      <AnimatePresence>
        {expanded && (
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

              {/* Reply Form */}
              {!showReplyForm ? (
                <button
                  onClick={() => setShowReplyForm(true)}
                  className="w-full py-3 rounded-xl border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all text-sm text-muted hover:text-accent"
                >
                  + Add a follow-up reply
                </button>
              ) : (
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
                      onClick={() => {
                        setShowReplyForm(false);
                        setReplyText("");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-card transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddReply}
                      disabled={!replyText.trim() || submitting}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        replyText.trim() && !submitting
                          ? "bg-accent text-background hover:bg-accent-hover"
                          : "bg-card text-muted border border-border cursor-not-allowed"
                      )}
                    >
                      <Send size={12} />
                      {submitting ? "Posting…" : "Post Reply"}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ThreadsPage() {
  const [filter, setFilter] = useState<string>("all");

  const categories = Array.from(new Set(threadsData.map((t) => t.category)));

  const filteredThreads =
    filter === "all"
      ? threadsData
      : threadsData.filter((t) => t.category === filter);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Discussion <span className="text-accent">Threads</span>
          </h1>
          <p className="text-muted text-sm">
            Real conversations between students, mentors, and admins
          </p>
        </motion.div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              filter === "all"
                ? "bg-accent text-background"
                : "bg-card border border-border text-muted hover:text-foreground"
            )}
          >
            All Threads
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filter === cat
                  ? "bg-accent text-background"
                  : "bg-card border border-border text-muted hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Threads */}
        <div className="space-y-4">
          {filteredThreads.map((thread, idx) => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <ThreadCard thread={thread} />
            </motion.div>
          ))}
        </div>

        {filteredThreads.length === 0 && (
          <div className="text-center py-16">
            <MessageCircle size={48} className="text-muted mx-auto mb-4 opacity-30" />
            <p className="text-muted">No threads in this category</p>
          </div>
        )}
      </main>

      <YakshaChat />
    </div>
  );
}
