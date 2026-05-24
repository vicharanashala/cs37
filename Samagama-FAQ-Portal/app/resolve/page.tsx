"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingQuestion {
  id: string;
  question: string;
  category: string;
  email: string;
  priority: "normal" | "urgent";
  submittedAt: string;
  status: "pending" | "resolved" | "rejected";
  suggestedAnswer?: string;
}

// Mock pending questions
const mockQuestions: PendingQuestion[] = [
  {
    id: "pq-1",
    question: "Can I use my college library WiFi for ViBe sessions or does it need to be personal WiFi?",
    category: "ViBe Platform",
    email: "student1@college.ac.in",
    priority: "normal",
    submittedAt: "2026-05-24 10:30",
    status: "pending",
    suggestedAnswer: "You can use any WiFi connection for ViBe sessions. However, if you face access issues on college WiFi, try switching to personal WiFi as some college networks have restrictions. See FAQ 12.2 for DNS troubleshooting steps.",
  },
  {
    id: "pq-2",
    question: "My NOC was signed by the Vice Principal instead of HOD. Is that acceptable?",
    category: "NOC",
    email: "student2@university.edu",
    priority: "urgent",
    submittedAt: "2026-05-24 09:15",
    status: "pending",
    suggestedAnswer: "Yes, a Vice Principal is an acceptable signatory. Any authorised signatory at your college (HOD, Principal, Dean, Director, or Training & Placement Officer) can sign the NOC. A Vice Principal falls under this category.",
  },
  {
    id: "pq-3",
    question: "I accidentally submitted my team formation with a typo in my teammate's email. How do I fix this?",
    category: "Team Formation",
    email: "student3@inst.ac.in",
    priority: "normal",
    submittedAt: "2026-05-23 18:45",
    status: "pending",
    suggestedAnswer: "No action is required from your side. The administration will verify and match email IDs with names before finalizing and locking teams. See FAQ 13.5.",
  },
  {
    id: "pq-4",
    question: "Is there a way to speed up ViBe video playback? The 1x speed feels too slow for content I already know.",
    category: "ViBe Platform",
    email: "student4@college.edu",
    priority: "normal",
    submittedAt: "2026-05-23 14:20",
    status: "pending",
    suggestedAnswer: "ViBe does not support speed adjustment. The platform uses linear progression with proctoring, and videos must be watched at normal speed. If you feel the content is below your level, you may request the viva-route exemption. See FAQ 12.7 for the alternative evaluation path.",
  },
  {
    id: "pq-5",
    question: "My internship starts on June 1 but I haven't received any Zoom link yet. Should I be worried?",
    category: "Selection & Offer Letter",
    email: "student5@univ.ac.in",
    priority: "urgent",
    submittedAt: "2026-05-24 11:00",
    status: "pending",
    suggestedAnswer: "The Zoom link for daily standups is posted in the Announcements section on your samagama.in dashboard. Check the announcement bell at the top of the page. If you still can't find it, type #escalate in the Yaksha chat. See FAQ 4.17.",
  },
];

export default function ResolvePage() {
  const [questions, setQuestions] = useState<PendingQuestion[]>(mockQuestions);
  const [selectedQuestion, setSelectedQuestion] = useState<PendingQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "urgent">("all");

  const filteredQuestions = questions.filter((q) => {
    if (filter === "pending") return q.status === "pending";
    if (filter === "urgent") return q.priority === "urgent" && q.status === "pending";
    return true;
  });

  const handleResolve = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "resolved" as const } : q))
    );
    setSelectedQuestion(null);
    setAnswer("");
  };

  const handleReject = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "rejected" as const } : q))
    );
    setSelectedQuestion(null);
    setAnswer("");
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Resolve <span className="text-accent">Questions</span>
          </h1>
          <p className="text-muted text-sm">
            Admin panel — review, answer, or reject pending questions
          </p>
        </motion.div>

        {/* Stats */}
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
            {filteredQuestions.map((q, idx) => (
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
                        {q.submittedAt}
                      </span>
                    </div>
                  </div>
                  <MessageSquare size={16} className="text-muted shrink-0" />
                </div>
              </motion.div>
            ))}

            {filteredQuestions.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle size={48} className="text-success mx-auto mb-4 opacity-50" />
                <p className="text-muted">No questions in this filter</p>
              </div>
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

                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-muted mb-4"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolve(selectedQuestion.id)}
                    disabled={!answer.trim()}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                      answer.trim()
                        ? "bg-success text-background hover:bg-success/90"
                        : "bg-card border border-border text-muted cursor-not-allowed"
                    )}
                  >
                    <Send size={14} />
                    Resolve
                  </button>
                  <button
                    onClick={() => handleReject(selectedQuestion.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-all"
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
