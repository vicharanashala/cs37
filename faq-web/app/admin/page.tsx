"use client";

/**
 * app/admin/page.tsx
 *
 * Admin panel — review, answer, reject, or promote pending questions.
 * Three tabs:
 *   - "Questions"          — all pending questions (ask_page + yaksha_chat source)
 *   - "FAQ Suggestions"    — only yaksha_chat questions ready for FAQ promotion
 *   - "Community Reviews"  — student replies in the community section awaiting
 *                            admin accept / rewrite / reject
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Trash2,
  Send,
  Filter,
  Sparkles,
  Mail,
  RefreshCw,
  BookText,
  PlusCircle,
  X,
  Tag,
  Users,
  Pencil,
  ShieldAlert,
  Bot,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { categories } from "@/data/faqData";
import ManualFAQForm from "../resolve/ManualFAQForm";
import ResolveAssistant from "../resolve/ResolveAssistant";

interface PendingQuestion {
  id: string;
  question: string;
  category: string;
  email: string;
  priority: "normal" | "urgent";
  submittedAt: string;
  status: "pending" | "resolved" | "rejected";
  suggestedAnswer?: string | null;
  answer?: string | null;
  source?: string;
}

interface PendingReview {
  id: string;
  source: "community_answer" | "pending_reply";
  questionId: string;
  questionTitle: string;
  body: string;
  author: string;
  createdAt: string;
  aiReview?: {
    decision: string;
    relevanceScore: number;
    safetyAllowed: boolean;
    policyGrounded: boolean;
    reasons: string[];
    model: string;
  };
}

export default function AdminPage() {
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<PendingQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "urgent">("all");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"questions" | "faq_suggestions" | "manual_faq" | "community_reviews">("questions");
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promoteCategoryId, setPromoteCategoryId] = useState(1);
  const [promoteTags, setPromoteTags] = useState("");

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const srcParam = tab === "faq_suggestions" ? "&source=yaksha_chat" : "";
      const res = await fetch(`/api/admin/pending-questions?status=all${srcParam}`, {
        headers: { "x-admin-key": localStorage.getItem("samagama_admin_key") ?? "dev-admin" },
      });
      const data = await res.json();
      if (data.ok) {
        setQuestions(data.questions);
      } else {
        toast.error(data.error?.message ?? "Failed to load questions");
      }
    } catch {
      toast.error("Network error — could not load questions");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const filteredQuestions = questions.filter((q) => {
    if (filter === "pending") return q.status === "pending";
    if (filter === "urgent") return q.priority === "urgent" && q.status === "pending";
    return true;
  });

  const handleResolve = async (id: string) => {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pending-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": localStorage.getItem("samagama_admin_key") ?? "dev-admin",
        },
        body: JSON.stringify({ id, action: "resolve", answer }),
      });
      const data = await res.json();
      if (data.ok) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: "resolved" as const } : q))
        );
        toast.success(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold">
              <Mail size={14} />
              <span>Question resolved</span>
            </div>
            <p className="text-xs opacity-80">
              Notification sent to {selectedQuestion?.email || "submitter"}
            </p>
          </div>,
          { duration: 4000 }
        );
        setSelectedQuestion(null);
        setAnswer("");
      } else {
        toast.error(data.error?.message ?? "Failed to resolve question");
      }
    } catch {
      toast.error("Network error — could not resolve question");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pending-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": localStorage.getItem("samagama_admin_key") ?? "dev-admin",
        },
        body: JSON.stringify({ id, action: "reject" }),
      });
      const data = await res.json();
      if (data.ok) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: "rejected" as const } : q))
        );
        toast.error(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold">
              <Mail size={14} />
              <span>Question rejected</span>
            </div>
            <p className="text-xs opacity-80">
              Submitter notified: {selectedQuestion?.email || "unknown"}
            </p>
          </div>,
          { duration: 4000 }
        );
        setSelectedQuestion(null);
        setAnswer("");
      } else {
        toast.error(data.error?.message ?? "Failed to reject question");
      }
    } catch {
      toast.error("Network error — could not reject question");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromoteToFaq = async () => {
    if (!answer.trim() || !selectedQuestion) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pending-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": localStorage.getItem("samagama_admin_key") ?? "dev-admin",
        },
        body: JSON.stringify({
          id: selectedQuestion.id,
          action: "promote_faq",
          answer,
          promoteFaq: {
            categoryId: promoteCategoryId,
            tags: promoteTags
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === selectedQuestion.id ? { ...q, status: "resolved" as const } : q))
        );
        toast.success(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold">
              <BookText size={14} />
              <span>FAQ created: {data.faqId}</span>
            </div>
            <p className="text-xs opacity-80">
              Question promoted and published to FAQ
            </p>
          </div>,
          { duration: 5000 }
        );
        setSelectedQuestion(null);
        setAnswer("");
        setPromoteModalOpen(false);
        setPromoteTags("");
      } else {
        toast.error(data.error?.message ?? "Failed to promote to FAQ");
      }
    } catch {
      toast.error("Network error — could not promote to FAQ");
    } finally {
      setSubmitting(false);
    }
  };

  const openPromoteModal = () => {
    setPromoteCategoryId(1);
    setPromoteTags("");
    setPromoteModalOpen(true);
  };

  const pendingCount = questions.filter((q) => q.status === "pending").length;
  const urgentCount = questions.filter((q) => q.priority === "urgent" && q.status === "pending").length;
  const resolvedCount = questions.filter((q) => q.status === "resolved").length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                Resolve <span className="text-accent">Questions</span>
              </h1>
              <p className="text-muted text-sm">
                Admin panel — review, answer, or reject pending questions
              </p>
            </div>
            <button
              onClick={loadQuestions}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-muted hover:text-foreground hover:border-muted transition-all text-sm"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-card border border-border w-fit">
          <button
            onClick={() => { setTab("questions"); setSelectedQuestion(null); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "questions"
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            )}
          >
            <MessageSquare size={14} />
            Questions
          </button>
          <button
            onClick={() => { setTab("faq_suggestions"); setSelectedQuestion(null); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "faq_suggestions"
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            )}
          >
            <BookText size={14} />
            FAQ Suggestions
          </button>
          <button
            onClick={() => { setTab("manual_faq"); setSelectedQuestion(null); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "manual_faq"
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            )}
          >
            <PlusCircle size={14} />
            Manual FAQ
          </button>
          <button
            onClick={() => { setTab("community_reviews"); setSelectedQuestion(null); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "community_reviews"
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            )}
          >
            <Users size={14} />
            Community Reviews
          </button>
        </div>

        {/* Stats (questions tab only) */}
        {tab === "questions" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-accent" />
                <span className="text-xs text-muted">Pending</span>
              </div>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-danger" />
                <span className="text-xs text-muted">Urgent</span>
              </div>
              <p className="text-2xl font-bold text-danger">{urgentCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-success" />
                <span className="text-xs text-muted">Resolved</span>
              </div>
              <p className="text-2xl font-bold text-success">{resolvedCount}</p>
            </div>
          </motion.div>
        )}

        {/* Filter */}
        {tab === "questions" && (
          <div className="flex items-center gap-2 mb-6">
            <Filter size={16} className="text-muted" />
            {(["all", "pending", "urgent"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                  filter === f
                    ? "bg-accent text-background"
                    : "bg-card border border-border text-muted hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Questions Grid (Questions + FAQ Suggestions tabs) */}
        {tab !== "manual_faq" && tab !== "community_reviews" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Question List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-16 text-muted text-sm">
                Loading questions…
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle size={48} className="text-success mx-auto mb-4 opacity-50" />
                <p className="text-muted">No questions in this filter</p>
              </div>
            ) : (
              filteredQuestions.map((q, idx) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    setSelectedQuestion(q);
                    setAnswer(q.suggestedAnswer || q.answer || "");
                  }}
                  className={cn(
                    "rounded-xl border p-4 cursor-pointer transition-all",
                    selectedQuestion?.id === q.id
                      ? "border-accent bg-accent/5"
                      : "border-border bg-card hover:border-muted",
                    q.status === "resolved" && "opacity-50",
                    q.status === "rejected" && "opacity-30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {tab === "faq_suggestions" && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-accent/10 text-accent">
                            FAQ Suggestion
                          </span>
                        )}
                        {q.priority === "urgent" && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-danger/20 text-danger">
                            urgent
                          </span>
                        )}
                        <span className="text-xs text-muted">{q.category}</span>
                        {q.status !== "pending" && (
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              q.status === "resolved"
                                ? "bg-success/20 text-success"
                                : "bg-danger/20 text-danger"
                            )}
                          >
                            {q.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-relaxed">
                        {q.question}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {q.email && <span className="text-xs text-muted">{q.email}</span>}
                        <span className="text-xs text-muted">
                          {new Date(q.submittedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <MessageSquare size={16} className="text-muted shrink-0" />
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Answer Panel */}
          <AnimatePresence mode="wait">
            {selectedQuestion ? (
              <motion.div
                key={selectedQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="sticky top-24 rounded-xl border border-border bg-card p-6 h-fit"
              >
                {tab === "faq_suggestions" ? (
                  <h3 className="text-sm font-semibold mb-1">Promote to FAQ</h3>
                ) : (
                  <h3 className="text-sm font-semibold mb-1">Answer this question</h3>
                )}
                <p className="text-xs text-muted mb-4">
                  {selectedQuestion.question}
                </p>

                {selectedQuestion.suggestedAnswer && (
                  <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-accent" />
                      <span className="text-xs font-medium text-accent">
                        AI-suggested answer
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 leading-relaxed">
                      {selectedQuestion.suggestedAnswer}
                    </p>
                    <button
                      onClick={() => setAnswer(selectedQuestion.suggestedAnswer || "")}
                      className="mt-2 text-xs text-accent hover:underline"
                    >
                      Use this answer →
                    </button>
                  </div>
                )}

                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-muted mb-4"
                  disabled={submitting}
                />

                {tab === "faq_suggestions" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handlePromoteToFaq}
                      disabled={!answer.trim() || submitting}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                        answer.trim() && !submitting
                          ? "bg-accent text-background hover:bg-accent-hover"
                          : "bg-card border border-border text-muted cursor-not-allowed"
                      )}
                    >
                      <PlusCircle size={14} />
                      {submitting ? "Promoting…" : "Promote to FAQ"}
                    </button>
                    <button
                      onClick={() => handleReject(selectedQuestion.id)}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(selectedQuestion.id)}
                      disabled={!answer.trim() || submitting}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                        answer.trim() && !submitting
                          ? "bg-success text-background hover:bg-success/90"
                          : "bg-card border border-border text-muted cursor-not-allowed"
                      )}
                    >
                      <Send size={14} />
                      {submitting ? "Resolving…" : "Resolve"}
                    </button>
                    <button
                      onClick={() => handleReject(selectedQuestion.id)}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Reject
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="sticky top-24 rounded-xl border border-border bg-card p-12 text-center"
              >
                <MessageSquare size={48} className="text-muted mx-auto mb-4 opacity-30" />
                <p className="text-sm text-muted">
                  Select a question to {tab === "faq_suggestions" ? "promote" : "answer"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Manual FAQ Tab */}
        {tab === "manual_faq" && (
          <div className="max-w-2xl">
            <ManualFAQForm />
          </div>
        )}

        {/* Resolve Assistant */}
        <div className="mt-10 pt-8 border-t border-border">
          <ResolveAssistant />
        </div>

        {/* Community Reviews Tab */}
        {tab === "community_reviews" && <CommunityReviewsTab />}
      </main>

      {/* Promote to FAQ Modal */}
      <AnimatePresence>
        {promoteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setPromoteModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookText size={18} className="text-accent" />
                  <h3 className="text-sm font-semibold">Promote to FAQ</h3>
                </div>
                <button
                  onClick={() => setPromoteModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-muted mb-4 line-clamp-2">
                {selectedQuestion?.question}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    <Tag size={12} className="inline mr-1" />
                    Category
                  </label>
                  <select
                    value={promoteCategoryId}
                    onChange={(e) => setPromoteCategoryId(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={promoteTags}
                    onChange={(e) => setPromoteTags(e.target.value)}
                    placeholder="e.g. noc, deadline, application"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handlePromoteToFaq}
                    disabled={!answer.trim() || submitting}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                      answer.trim() && !submitting
                        ? "bg-accent text-background hover:bg-accent-hover"
                        : "bg-card border border-border text-muted cursor-not-allowed"
                    )}
                  >
                    <PlusCircle size={14} />
                    {submitting ? "Promoting…" : "Create FAQ Entry"}
                  </button>
                  <button
                    onClick={() => setPromoteModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted hover:bg-background transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Community Reviews Tab ────────────────────────────────────────────────────
// Inbox of student replies from the community section. Admin can accept as-is,
// rewrite (admin's version goes public, student credit dropped), or reject.

function CommunityReviewsTab() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingReview | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteBody, setRewriteBody] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const adminKey =
    typeof window !== "undefined"
      ? localStorage.getItem("samagama_admin_key") ?? "dev-admin"
      : "dev-admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/community-reviews/pending", {
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (data.ok) {
        setReviews(data.reviews as PendingReview[]);
      } else {
        toast.error(data.error?.message ?? "Failed to load reviews");
      }
    } catch {
      toast.error("Network error — could not load reviews");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReview = (r: PendingReview) => {
    setSelected(r);
    setRewriting(false);
    setRewriteBody(r.body);
    setNote("");
  };

  const moderate = async (
    action: "approve" | "reject",
    finalBody?: string,
  ) => {
    if (!selected) return;
    if (action === "approve" && finalBody !== undefined) {
      const trimmed = finalBody.trim();
      if (trimmed.length < 15) {
        toast.error("Rewritten answer must be at least 15 characters");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/community-reviews/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          source: selected.source,
          id: selected.id,
          questionId: selected.questionId,
          action,
          finalBody: finalBody?.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Action failed");

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{data.message}</span>
          {data.rewritten && (
            <span className="text-xs opacity-80">
              Student credit has been replaced with admin attribution.
            </span>
          )}
        </div>,
        { duration: 4000 },
      );

      setReviews((prev) => prev.filter((r) => r.id !== selected.id));
      setSelected(null);
      setRewriting(false);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">Community Reply Reviews</h2>
          <p className="text-xs text-muted">
            Student replies from the community section. Approve as-is, rewrite
            (admin attribution only), or reject.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-muted hover:text-foreground hover:border-muted transition-all text-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-accent" />
            <span className="text-xs text-muted">Pending</span>
          </div>
          <p className="text-2xl font-bold">{reviews.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-violet-400" />
            <span className="text-xs text-muted">New (CommunityAnswer)</span>
          </div>
          <p className="text-2xl font-bold">
            {reviews.filter((r) => r.source === "community_answer").length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot size={16} className="text-muted" />
            <span className="text-xs text-muted">Legacy (pending_reply)</span>
          </div>
          <p className="text-2xl font-bold">
            {reviews.filter((r) => r.source === "pending_reply").length}
          </p>
        </div>
      </div>

      {/* List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-muted text-sm">Loading…</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle
                size={48}
                className="text-success mx-auto mb-4 opacity-50"
              />
              <p className="text-muted">Inbox clear — nothing to review.</p>
            </div>
          ) : (
            reviews.map((r, idx) => {
              const isAnswerSource = r.source === "community_answer";
              return (
                <motion.button
                  type="button"
                  key={`${r.source}:${r.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  onClick={() => openReview(r)}
                  className={cn(
                    "w-full text-left rounded-xl border p-4 transition-all",
                    selected?.id === r.id && selected?.source === r.source
                      ? "border-accent bg-accent/5"
                      : "border-border bg-card hover:border-muted",
                  )}
                >
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                        isAnswerSource
                          ? "bg-violet-500/10 text-violet-400"
                          : "bg-muted/20 text-muted",
                      )}
                    >
                      {isAnswerSource ? <Sparkles size={10} /> : <Bot size={10} />}
                      {isAnswerSource ? "New system" : "Legacy"}
                    </span>
                    {r.aiReview && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          r.aiReview.decision === "approve"
                            ? "bg-success/15 text-success"
                            : r.aiReview.decision === "reject"
                              ? "bg-danger/15 text-danger"
                              : "bg-yellow-500/15 text-yellow-500",
                        )}
                      >
                        AI: {r.aiReview.decision}
                      </span>
                    )}
                    <span className="text-xs text-muted">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-1 line-clamp-1">
                    on &ldquo;{r.questionTitle}&rdquo;
                  </p>
                  <p className="text-sm text-foreground/90 line-clamp-3 leading-relaxed">
                    {r.body}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
                    <UserIcon size={11} />
                    {r.author}
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Detail */}
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={`${selected.source}:${selected.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="sticky top-24 rounded-xl border border-border bg-card p-6 h-fit space-y-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted/20 text-muted font-medium">
                    {selected.source === "community_answer"
                      ? "CommunityAnswer (new)"
                      : "pending_reply (legacy)"}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(selected.createdAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-sm font-semibold mb-1">
                  On: {selected.questionTitle}
                </h3>
                <p className="text-xs text-muted flex items-center gap-1.5">
                  <UserIcon size={11} /> {selected.author}
                </p>
              </div>

              {selected.aiReview && (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-accent" />
                    <span className="text-xs font-medium text-accent">
                      AI pre-review
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted">Decision: </span>
                      <span className="font-medium">{selected.aiReview.decision}</span>
                    </div>
                    <div>
                      <span className="text-muted">Relevance: </span>
                      <span className="font-medium">
                        {(selected.aiReview.relevanceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Safety: </span>
                      <span className="font-medium">
                        {selected.aiReview.safetyAllowed ? "✓" : "✗"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Grounded: </span>
                      <span className="font-medium">
                        {selected.aiReview.policyGrounded ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                  {selected.aiReview.reasons.length > 0 && (
                    <p className="text-xs text-muted">
                      Reasons: {selected.aiReview.reasons.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* Original body */}
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  Original reply
                </label>
                <div className="rounded-lg border border-border bg-background p-3 text-sm whitespace-pre-wrap text-foreground/90">
                  {selected.body}
                </div>
              </div>

              {/* Rewrite editor (only when rewriting) */}
              <AnimatePresence>
                {rewriting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-500">
                      <ShieldAlert size={13} />
                      <span>
                        When you approve a rewrite, the student&apos;s credit is
                        dropped and the answer is re-attributed to you.
                      </span>
                    </div>
                    <label className="block text-xs font-medium">
                      <Pencil size={11} className="inline mr-1" />
                      Your rewrite (replaces the original)
                    </label>
                    <textarea
                      value={rewriteBody}
                      onChange={(e) => setRewriteBody(e.target.value)}
                      rows={6}
                      maxLength={5000}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                    />
                    <p className="text-xs text-muted">
                      {rewriteBody.trim().length} / 5000 characters
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Optional note */}
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  Admin note (optional)
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for decision…"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {!rewriting ? (
                  <>
                    <button
                      onClick={() => moderate("approve")}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-success text-background hover:bg-success/90 transition-all disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      {submitting ? "Approving…" : "Accept as-is"}
                    </button>
                    <button
                      onClick={() => setRewriting(true)}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-accent text-background hover:bg-accent-hover transition-all disabled:opacity-50"
                    >
                      <Pencil size={14} />
                      Rewrite…
                    </button>
                    <button
                      onClick={() => moderate("reject")}
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => moderate("approve", rewriteBody)}
                      disabled={submitting || rewriteBody.trim().length < 15}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-accent text-background hover:bg-accent-hover transition-all disabled:opacity-50"
                    >
                      <Send size={14} />
                      {submitting ? "Posting…" : "Approve rewrite"}
                    </button>
                    <button
                      onClick={() => {
                        setRewriting(false);
                        setRewriteBody(selected.body);
                      }}
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted hover:bg-background transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="sticky top-24 rounded-xl border border-border bg-card p-12 text-center"
            >
              <Users
                size={48}
                className="text-muted mx-auto mb-4 opacity-30"
              />
              <p className="text-sm text-muted">
                Select a reply from the list to review.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}