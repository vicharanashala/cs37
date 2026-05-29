"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import YakshaChat from "@/components/YakshaChat";
import { faqData as staticFaqData, categories as staticCategories, type FAQ, type Category } from "@/data/faqData";
import Fuse from "fuse.js";
import {
  Send,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AskPage() {
  const [faqData, setFaqData] = useState<FAQ[]>(staticFaqData);
  const [categories, setCategories] = useState<Category[]>(staticCategories);
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/faqs");
        const data = await res.json();
        if (data.ok && data.faqs.length > 0) {
          setFaqData(data.faqs);
          setCategories(data.categories);
        }
      } catch {
        // Fall back to static data
      }
    };
    void load();
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(faqData, {
        keys: ["question", "answer", "tags"],
        threshold: 0.4,
        includeScore: true,
      }),
    [faqData]
  );

  // Real-time duplicate detection
  const suggestions = useMemo(() => {
    if (question.length < 5) return [];
    return fuse.search(question).slice(0, 3);
  }, [question, fuse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), category, email, priority }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        setSubmitted(true);
      } else {
        setSubmitError(data.error?.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.4 }}
          >
            <CheckCircle size={64} className="text-success mx-auto mb-6" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-3"
          >
            Question Submitted!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted mb-8"
          >
            Our team will review and answer your question soon. You&apos;ll be
            notified when it&apos;s resolved.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex gap-3 justify-center"
          >
            <button
              onClick={() => {
                setSubmitted(false);
                setQuestion("");
                setCategory("");
                setSubmitError("");
              }}
              className="px-5 py-2.5 rounded-xl bg-accent text-background font-medium hover:bg-accent-hover transition-colors"
            >
              Ask Another
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-xl border border-border text-foreground font-medium hover:bg-card transition-colors"
            >
              Back to FAQ
            </a>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Ask a <span className="text-accent">Question</span>
          </h1>
          <p className="text-muted text-sm">
            Can&apos;t find your answer? Submit your question and our team will
            respond.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="lg:col-span-2 space-y-5"
          >
            {/* Question Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Your Question *
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Type your question here... (e.g., 'How do I submit my NOC if my college is closed?')"
                rows={4}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-muted"
                required
              />
            </div>

            {/* Smart Suggestions */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-accent/30 bg-accent/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={16} className="text-accent" />
                    <span className="text-sm font-medium text-accent">
                      Similar questions already answered:
                    </span>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((s) => (
                      <a
                        key={s.item.id}
                        href={`/#faq-${s.item.id}`}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50 hover:bg-background border border-border/50 transition-all group"
                      >
                        <span className="text-xs font-mono text-accent">
                          {s.item.id}
                        </span>
                        <span className="flex-1 text-sm text-foreground/80 group-hover:text-foreground">
                          {s.item.question}
                        </span>
                        <ArrowRight
                          size={14}
                          className="text-muted group-hover:text-accent transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-3">
                    If none of these answer your question, continue submitting
                    below.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="">Select a category (optional)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Your Email (for notification)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Priority
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPriority("normal")}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    priority === "normal"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:border-muted"
                  )}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("urgent")}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    priority === "urgent"
                      ? "border-danger bg-danger/10 text-danger"
                      : "border-border text-muted hover:border-muted"
                  )}
                >
                  <AlertCircle size={14} className="inline mr-1" />
                  Urgent
                </button>
              </div>
            </div>

            {/* Error banner */}
            {submitError && (
              <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
                <AlertCircle size={16} />
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!question.trim() || submitting}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-sm transition-all",
                question.trim() && !submitting
                  ? "bg-accent text-background hover:bg-accent-hover shadow-lg shadow-accent/20"
                  : "bg-card text-muted border border-border cursor-not-allowed"
              )}
            >
              <Send size={16} />
              {submitting ? "Submitting…" : "Submit Question"}
            </button>
          </motion.form>

          {/* Sidebar Tips */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Lightbulb size={16} className="text-accent" />
                Tips for a good question
              </h3>
              <ul className="space-y-2 text-xs text-muted">
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  Be specific about your situation
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  Mention relevant details (dates, phase, etc.)
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  Check if a similar question exists first
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  One question per submission
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-2">Response Time</h3>
              <p className="text-xs text-muted">
                Normal questions are typically answered within 24 hours. Urgent
                questions are prioritized.
              </p>
            </div>
          </motion.aside>
        </div>
      </main>

      <YakshaChat />
    </div>
  );
}
