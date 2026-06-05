"use client";

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
  BookOpen,
  PlusCircle,
} from "lucide-react";
import ManualFAQForm from "./ManualFAQForm";
import { cn } from "@/lib/utils";

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
}

export default function ResolvePage() {
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<PendingQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "urgent">("all");
  const [submitting, setSubmitting] = useState(false);
  const [showManualFAQ, setShowManualFAQ] = useState(false);
  const [liveFaqCount, setLiveFaqCount] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadLiveFaqCount = useCallback(async () => {
    try {
      const res = await fetch("/api/faqs");
      const data = await res.json();
      if (data.ok) {
        setLiveFaqCount(data.faqs?.length ?? data.count ?? 0);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    void loadLiveFaqCount();
  }, [loadLiveFaqCount]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending-questions?status=all", {
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
  }, []);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    setAiSuggestion(null);
  }, [selectedQuestion]);

  const fetchAiSuggestion = useCallback(async () => {
    if (!selectedQuestion) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await fetch("/api/ai/resolve-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: selectedQuestion.question }),
      });
      const data = await res.json();
      if (data.ok) {
        setAiSuggestion(data.answer);
      } else {
        setAiSuggestion("Could not generate a suggestion right now.");
      }
    } catch {
      setAiSuggestion("Network error — try again.");
    } finally {
      setAiLoading(false);
    }
  }, [selectedQuestion]);

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
              Notification sent to {selectedQuestion?.email}
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
              User notified: {selectedQuestion?.email}
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

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-5 gap-4 mb-8"
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
          <button
            onClick={() => setShowManualFAQ((prev) => !prev)}
            className="rounded-xl border border-amber-500/40 bg-zinc-900/60 p-4 text-left hover:border-amber-500/70 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1">
              <PlusCircle size={16} className="text-amber-400" />
              <span className="text-xs text-muted">Manual FAQ</span>
            </div>
            <p className="text-sm font-medium text-amber-400">
              {showManualFAQ ? "Close" : "Add"}
            </p>
          </button>
          <div className="rounded-xl border border-amber-500/40 bg-zinc-900/60 p-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={16} className="text-amber-400" />
              <span className="text-xs text-muted">Live FAQ</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">
              {liveFaqCount !== null ? liveFaqCount : "—"}
            </p>
          </div>
        </motion.div>

        {showManualFAQ && (
          <div className="mb-8">
            <ManualFAQForm />
          </div>
        )}

        {/* Filter */}
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

        {/* Questions Grid */}
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
                    setAnswer(q.suggestedAnswer || "");
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
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            q.priority === "urgent"
                              ? "bg-danger/20 text-danger"
                              : "bg-accent/10 text-accent"
                          )}
                        >
                          {q.priority}
                        </span>
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
                        <span className="text-xs text-muted">{q.email}</span>
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
                <h3 className="text-sm font-semibold mb-1">Answer this question</h3>
                <p className="text-xs text-muted mb-4">
                  {selectedQuestion.question}
                </p>

                {/* AI Suggested Answer */}
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

                {/* AI Suggestion on click */}
                <button
                  onClick={fetchAiSuggestion}
                  disabled={aiLoading}
                  className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  {aiLoading ? "Getting suggestion..." : "Get AI suggestion"}
                </button>

                {aiSuggestion && (
                  <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-amber-400" />
                      <span className="text-xs font-medium text-amber-400">AI suggestion</span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {aiSuggestion}
                    </p>
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
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="sticky top-24 rounded-xl border border-border bg-card p-12 text-center"
              >
                <MessageSquare size={48} className="text-muted mx-auto mb-4 opacity-30" />
                <p className="text-sm text-muted">
                  Select a question to answer
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


      </main>
    </div>
  );
}