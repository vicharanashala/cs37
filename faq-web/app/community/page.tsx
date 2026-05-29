"use client";

/**
 * app/community/page.tsx
 *
 * Community Q&A home: search, tag filter, sort (recent / most-answered /
 * unanswered / trending), and an "Ask a question" entry point. Reuses the
 * existing dark theme tokens and framer-motion patterns from the FAQ pages.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Search,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  HelpCircle,
  Eye,
} from "lucide-react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import { api } from "@/lib/community/client";
import type { QuestionDTO } from "@/lib/community/types";

const SORTS = [
  { key: "recent", label: "Recent", icon: Clock },
  { key: "answered", label: "Most answered", icon: CheckCircle },
  { key: "unanswered", label: "Unanswered", icon: HelpCircle },
  { key: "trending", label: "Trending", icon: TrendingUp },
] as const;

const TAGS = [
  "internship", "noc", "certificate", "offer-letter", "exam",
  "team-formation", "vibe", "rosetta", "selection",
];

export default function CommunityHome() {
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<string>("recent");
  const [tag, setTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (query.trim()) params.set("q", query.trim());
    if (tag) params.set("tag", tag);
    const res = await api(`/api/community/questions?${params}`);
    if (res.ok) setQuestions((res.questions as QuestionDTO[]) ?? []);
    setLoading(false);
  }, [sort, query, tag]);

  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0); // debounce search typing
    return () => clearTimeout(t);
  }, [load, query]);

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
                Ask interns, answer others. Every answer is reviewed for safety
                and accuracy before it appears.
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
        {/* Sort + tags */}
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
                    : "bg-card border border-border text-muted hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setTag(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs transition-all",
              tag === null
                ? "bg-accent/15 text-accent border border-accent/40"
                : "border border-border text-muted hover:text-foreground"
            )}
          >
            All tags
          </button>
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs transition-all",
                tag === t
                  ? "bg-accent/15 text-accent border border-accent/40"
                  : "border border-border text-muted hover:text-foreground"
              )}
            >
              #{t}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="py-16 text-center text-muted text-sm">Loading…</div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-4">💬</p>
            <p className="text-lg font-medium mb-1">No questions yet</p>
            <p className="text-sm text-muted mb-5">
              Be the first to start a discussion.
            </p>
            <Link
              href="/community/ask"
              className="text-sm text-accent hover:underline"
            >
              Ask a question →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              >
                <Link
                  href={`/community/${q.id}`}
                  className="block rounded-xl border border-border bg-card p-4 hover:border-muted transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-snug mb-1 truncate">
                        {q.title}
                      </h3>
                      {q.body && (
                        <p className="text-xs text-muted line-clamp-2 mb-2">
                          {q.body}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {q.tags.map((t) => (
                          <span
                            key={t}
                            className="text-xs text-accent/80 bg-accent/5 px-2 py-0.5 rounded-full"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted shrink-0">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={13} />
                        {q.approvedAnswerCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={13} />
                        {q.viewCount}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
