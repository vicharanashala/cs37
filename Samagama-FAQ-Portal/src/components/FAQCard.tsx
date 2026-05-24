"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ThumbsUp, ThumbsDown, Share2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FAQ } from "@/data/faqData";

interface FAQCardProps {
  faq: FAQ;
  isOpen: boolean;
  onToggle: () => void;
  searchQuery?: string;
}

function highlightText(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-accent/30 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function FAQCard({ faq, isOpen, onToggle, searchQuery }: FAQCardProps) {
  const [helpful, setHelpful] = useState<"up" | "down" | null>(null);

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border transition-all duration-200",
        isOpen
          ? "border-accent/30 bg-card shadow-lg shadow-accent/5"
          : "border-border bg-card hover:border-muted hover:bg-card-hover"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 sm:p-5 text-left"
        aria-expanded={isOpen}
      >
        <span className="shrink-0 mt-0.5 text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">
          {faq.id}
        </span>
        <span className="flex-1 text-sm sm:text-base font-medium leading-relaxed">
          {searchQuery ? highlightText(faq.question, searchQuery) : faq.question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 mt-1"
        >
          <ChevronDown size={18} className="text-muted" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
              <div className="ml-10 border-t border-border pt-4">
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
                  {searchQuery ? highlightText(faq.answer, searchQuery) : faq.answer}
                </p>

                {/* Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {faq.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHelpful(helpful === "up" ? null : "up");
                      }}
                      className={cn(
                        "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all",
                        helpful === "up"
                          ? "bg-success/20 text-success"
                          : "text-muted hover:text-foreground hover:bg-background"
                      )}
                      aria-label="Mark as helpful"
                    >
                      <ThumbsUp size={14} />
                      <span>{faq.helpful + (helpful === "up" ? 1 : 0)}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHelpful(helpful === "down" ? null : "down");
                      }}
                      className={cn(
                        "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all",
                        helpful === "down"
                          ? "bg-danger/20 text-danger"
                          : "text-muted hover:text-foreground hover:bg-background"
                      )}
                      aria-label="Mark as not helpful"
                    >
                      <ThumbsDown size={14} />
                      <span>{faq.notHelpful + (helpful === "down" ? 1 : 0)}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(
                          `${window.location.origin}/#faq-${faq.id}`
                        );
                      }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-all"
                      aria-label="Share this FAQ"
                    >
                      <Share2 size={14} />
                      <span>Share</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={12} />
                    <span>Updated {faq.lastUpdated}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
