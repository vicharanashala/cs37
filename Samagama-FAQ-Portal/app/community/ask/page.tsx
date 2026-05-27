"use client";

/**
 * app/community/ask/page.tsx
 *
 * Create a community question. Mirrors the look of the existing /ask page but
 * posts to the community API, handles validation errors, and surfaces the
 * duplicate-question case (HTTP 409) with a link to the existing thread.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Send, Lightbulb, AlertCircle, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import { api } from "@/lib/community/client";
import type { QuestionDTO } from "@/lib/community/types";

export default function CommunityAskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<QuestionDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 10) {
      setError("Title must be at least 10 characters.");
      return;
    }
    setError("");
    setDuplicate(null);
    setSubmitting(true);

    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await api("/api/community/questions", {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), body: body.trim(), tags }),
    });
    setSubmitting(false);

    // Check duplicate first — the 409 response also carries ok:true + question.
    if ((res as { duplicate?: boolean }).duplicate && res.question) {
      setDuplicate(res.question as QuestionDTO);
      return;
    }
    if (res.ok && res.question) {
      router.push(`/community/${(res.question as QuestionDTO).id}`);
      return;
    }
    setError(res.error?.message ?? "Something went wrong. Try again.");
  };

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
            Ask the <span className="text-accent">Community</span>
          </h1>
          <p className="text-muted text-sm">
            Other interns can answer. Answers are reviewed before they appear.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="lg:col-span-2 space-y-5"
          >
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How do I apply for a certificate name correction?"
                maxLength={160}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                required
              />
              <p className="text-xs text-muted mt-1">{title.length}/160</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Details (optional)
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add any context that helps others answer accurately…"
                rows={5}
                maxLength={5000}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-muted"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Tags (comma-separated)
              </label>
              <input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="noc, certificate, internship"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {duplicate && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-accent" />
                  <span className="text-sm font-medium text-accent">
                    A similar question already exists
                  </span>
                </div>
                <Link
                  href={`/community/${duplicate.id}`}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50 hover:bg-background border border-border/50 transition-all group"
                >
                  <span className="flex-1 text-sm">{duplicate.title}</span>
                  <ArrowRight
                    size={14}
                    className="text-muted group-hover:text-accent transition-colors"
                  />
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || title.trim().length < 10}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-sm transition-all",
                !submitting && title.trim().length >= 10
                  ? "bg-accent text-background hover:bg-accent-hover shadow-lg shadow-accent/20"
                  : "bg-card text-muted border border-border cursor-not-allowed"
              )}
            >
              <Send size={16} />
              {submitting ? "Posting…" : "Post question"}
            </button>
          </motion.form>

          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Lightbulb size={16} className="text-accent" />
                How it works
              </h3>
              <ul className="space-y-2 text-xs text-muted">
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  Anyone can answer your question.
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  Each answer is auto-reviewed for safety, relevance, and policy
                  accuracy.
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  Policy answers are checked against official FAQ sources.
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">•</span>
                  Approved answers are synthesized into a community summary.
                </li>
              </ul>
            </div>
          </motion.aside>
        </div>
      </main>
    </div>
  );
}
