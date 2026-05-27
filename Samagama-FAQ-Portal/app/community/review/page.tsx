"use client";

/**
 * app/community/review/page.tsx
 *
 * Admin moderation queue. Shows answers the AI sent to needs_admin_review
 * (optionally rejected ones too) alongside the parent question, the LLM
 * decision/reasons, and retrieved citations, with approve/reject/hide controls
 * that override the AI decision.
 *
 * Gated by the shared admin key (stored locally; default "dev-admin" matches
 * the server default and the existing keyless /resolve panel's trust model).
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  Check,
  X,
  EyeOff,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import Header from "@/components/Header";
import { api, getAdminKey, setAdminKey } from "@/lib/community/client";
import type { AnswerDTO } from "@/lib/community/types";

interface QueueItem {
  answer: AnswerDTO;
  question: { id: string; title: string; body: string; tags: string[] } | null;
}

export default function AdminReviewPage() {
  const [keyInput, setKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeRejected, setIncludeRejected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Hydrate the gate from localStorage on mount. Reading persisted
    // client-only state necessarily updates state inside an effect.
    const k = getAdminKey();
    if (k) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKeyInput(k);
      setHasKey(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await api(
      `/api/admin/community/review-queue?includeRejected=${includeRejected ? 1 : 0}`,
      { admin: true }
    );
    if (res.ok) {
      setItems((res.queue as QueueItem[]) ?? []);
    } else {
      setError(res.error?.message ?? "Failed to load queue");
    }
    setLoading(false);
  }, [includeRejected]);

  useEffect(() => {
    if (!hasKey) return;
    let active = true;
    void (async () => {
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [hasKey, load]);

  const saveKey = () => {
    setAdminKey(keyInput.trim());
    setHasKey(true);
  };

  const decide = async (
    answerId: string,
    decision: "approve" | "reject" | "hide"
  ) => {
    const res = await api(`/api/admin/community/answers/${answerId}/review`, {
      method: "POST",
      admin: true,
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.answer.id !== answerId));
    }
  };

  if (!hasKey) {
    return (
      <Shell>
        <div className="max-w-sm mx-auto mt-16 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={18} className="text-accent" />
            <h2 className="text-sm font-semibold">Admin access</h2>
          </div>
          <p className="text-xs text-muted mb-4">
            Enter the moderation key to view the review queue.
          </p>
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="admin key"
            type="password"
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent mb-3"
          />
          <button
            onClick={saveKey}
            disabled={!keyInput.trim()}
            className="w-full py-2.5 rounded-xl bg-accent text-background text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Review <span className="text-accent">Queue</span>
          </h1>
          <p className="text-sm text-muted">
            Override AI decisions on uncertain answers.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={includeRejected}
            onChange={(e) => setIncludeRejected(e.target.checked)}
          />
          Include rejected
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setHasKey(false)} className="ml-auto underline">
            Change key
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Check size={40} className="text-success mx-auto mb-3 opacity-60" />
          <p className="text-muted text-sm">Queue is clear. Nothing to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.answer.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                {item.question && (
                  <p className="text-xs text-muted mb-1">Question</p>
                )}
                <p className="text-sm font-semibold mb-3">
                  {item.question?.title ?? "(question removed)"}
                </p>

                <p className="text-xs text-muted mb-1">Submitted answer</p>
                <p className="text-sm text-foreground/85 whitespace-pre-line mb-3 rounded-lg bg-background/50 border border-border/50 p-3">
                  {item.answer.body}
                </p>

                {/* AI decision */}
                {item.answer.review && (
                  <div className="rounded-lg border border-border/60 bg-background/40 p-3 mb-3 text-xs space-y-1">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                      <span>
                        decision:{" "}
                        <span className="text-foreground">
                          {item.answer.review.decision}
                        </span>
                      </span>
                      <span>relevance: {item.answer.review.relevanceScore}</span>
                      <span>safe: {String(item.answer.review.safetyAllowed)}</span>
                      <span>
                        policy-grounded:{" "}
                        {String(item.answer.review.policyGrounded)}
                      </span>
                      <span>
                        integrity:{" "}
                        {String(item.answer.review.academicIntegrityAllowed)}
                      </span>
                    </div>
                    <p className="text-muted">
                      reasons: {item.answer.review.reasons.join(", ") || "—"}
                    </p>
                  </div>
                )}

                {item.answer.citations.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck size={13} className="text-success" />
                      <span className="text-xs font-medium text-success">
                        Retrieved sources
                      </span>
                    </div>
                    {item.answer.citations.map((c, i) => (
                      <p
                        key={i}
                        className="text-xs text-muted/80 flex items-center gap-1.5"
                      >
                        <FileText size={11} /> {c.title} ({c.section} · {c.version}) ·
                        score {c.score}
                      </p>
                    ))}
                  </div>
                )}

                {typeof item.answer.reportCount === "number" &&
                  item.answer.reportCount > 0 && (
                    <p className="text-xs text-danger mb-3">
                      ⚑ {item.answer.reportCount} report(s)
                    </p>
                  )}

                {/* Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(item.answer.id, "approve")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => decide(item.answer.id, "reject")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
                  >
                    <X size={14} /> Reject
                  </button>
                  <button
                    onClick={() => decide(item.answer.id, "hide")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border text-muted hover:text-foreground transition-colors"
                  >
                    <EyeOff size={14} /> Hide
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Shell>
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
