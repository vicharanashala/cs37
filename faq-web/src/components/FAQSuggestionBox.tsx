"use client";

import { useMemo } from "react";
import { Lightbulb, ArrowRight, Sparkles } from "lucide-react";
import type { FAQ } from "@/data/faqData";
import Fuse from "fuse.js";

interface FAQSuggestionBoxProps {
  question: string;
  faqData: FAQ[];
}

export default function FAQSuggestionBox({ question, faqData }: FAQSuggestionBoxProps) {
  const fuse = useMemo(
    () =>
      new Fuse(faqData, {
        keys: [
          { name: "question", weight: 0.5 },
          { name: "answer", weight: 0.3 },
          { name: "tags", weight: 0.2 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [faqData]
  );

  const suggestions = useMemo(() => {
    if (!question.trim()) return [];
    return fuse.search(question).slice(0, 5).map((res) => res.item);
  }, [question, fuse]);

  if (!question.trim()) {
    // Original "Tips for a good question" section when the input is empty
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Lightbulb size={16} className="text-accent" />
          Tips for a good question
        </h3>
        <ul className="space-y-2 text-xs text-muted">
          <li className="flex gap-2">
            <span className="text-accent font-bold">•</span>
            Be specific about your situation
          </li>
          <li className="flex gap-2">
            <span className="text-accent font-bold">•</span>
            Mention relevant details (dates, phase, etc.)
          </li>
          <li className="flex gap-2">
            <span className="text-accent font-bold">•</span>
            Check if a similar question exists first
          </li>
          <li className="flex gap-2">
            <span className="text-accent font-bold">•</span>
            One question per submission
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-accent">
        <Sparkles size={16} />
        Suggested FAQs
      </h3>
      {suggestions.length === 0 ? (
        <p className="text-xs text-muted leading-relaxed">
          No matching FAQs found. If you cannot find what you are looking for, go ahead and submit your question.
        </p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((faq) => (
            <a
              key={faq.id}
              href={`/#faq-${faq.id}`}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-background/50 hover:bg-background border border-border/50 transition-all group"
            >
              <span className="text-xs font-mono text-accent shrink-0 mt-0.5">
                {faq.id}
              </span>
              <span className="flex-1 text-xs text-foreground/80 group-hover:text-foreground line-clamp-2">
                {faq.question}
              </span>
              <ArrowRight
                size={12}
                className="text-muted group-hover:text-accent transition-colors shrink-0 mt-0.5"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
