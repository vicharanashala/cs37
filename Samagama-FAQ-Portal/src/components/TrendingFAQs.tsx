"use client";

import { motion } from "framer-motion";
import { TrendingUp, Eye, ThumbsUp, Flame } from "lucide-react";
import { useEngagement } from "@/hooks/useEngagement";
import { faqData } from "@/data/faqData";

interface TrendingFAQsProps {
  onSelect: (faqId: string) => void;
}

// Mock baseline trending data (combined with localStorage)
const baselineTrending = [
  { id: "4.7", boost: 95 },
  { id: "3.7", boost: 87 },
  { id: "1.3", boost: 82 },
  { id: "13.3", boost: 78 },
  { id: "12.5", boost: 71 },
];

export default function TrendingFAQs({ onSelect }: TrendingFAQsProps) {
  const { mounted, getEngagement } = useEngagement();

  if (!mounted) return null;

  // Combine baseline + user engagement
  const trendingItems = baselineTrending
    .map((item) => {
      const faq = faqData.find((f) => f.id === item.id);
      if (!faq) return null;
      const engagement = getEngagement(item.id);
      const score =
        item.boost +
        engagement.views +
        engagement.upvotes * 3 -
        engagement.downvotes;
      return {
        faq,
        score,
        views: engagement.views + Math.floor(item.boost * 2.5),
        upvotes: engagement.upvotes + Math.floor(item.boost * 0.4),
      };
    })
    .filter((x) => x !== null)
    .slice(0, 5);

  if (trendingItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Flame size={16} className="text-accent" />
        </div>
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            Trending Questions
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              Hot
            </span>
          </h2>
          <p className="text-xs text-muted">Most viewed in the last 24 hours</p>
        </div>
      </div>

      <div className="space-y-2">
        {trendingItems.map((item, idx) => (
          <motion.button
            key={item!.faq.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + idx * 0.05 }}
            onClick={() => onSelect(item!.faq.id)}
            className="w-full group flex items-center gap-3 p-3 rounded-xl hover:bg-background border border-transparent hover:border-border transition-all text-left"
          >
            <span
              className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                idx === 0
                  ? "bg-accent text-background"
                  : idx === 1
                  ? "bg-accent/60 text-background"
                  : idx === 2
                  ? "bg-accent/30 text-accent"
                  : "bg-card text-muted border border-border"
              }`}
            >
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground/90 group-hover:text-foreground line-clamp-1">
                {item!.faq.question}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Eye size={11} />
                  {item!.views}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp size={11} />
                  {item!.upvotes}
                </span>
                <span className="text-accent flex items-center gap-1">
                  <TrendingUp size={11} />
                  {Math.round(item!.score)}
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
