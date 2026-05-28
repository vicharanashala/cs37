"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Clock,
  Eye,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FAQ } from "@/data/faqData";
import { useEngagement } from "@/hooks/useEngagement";
import toast from "react-hot-toast";

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

function StarRating({ rating }: { rating: number }) {
  const stars = Math.round((rating / 100) * 5);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={11}
          className={cn(
            i <= stars
              ? "fill-accent text-accent"
              : "text-border fill-transparent"
          )}
        />
      ))}
      <span className="text-xs text-muted ml-1">
        {rating > 0 ? `${rating}%` : ""}
      </span>
    </div>
  );
}

export default function FAQCard({ faq, isOpen, onToggle, searchQuery }: FAQCardProps) {
  const { upvote, downvote, trackShare, trackView, getEngagement, getTotalRating, mounted } =
    useEngagement();

  const engagement = getEngagement(faq.id);
  const rating = getTotalRating(faq.id);
  const userVoted = engagement.upvotes > 0 ? "up" : engagement.downvotes > 0 ? "down" : null;

  // Track view when opened
  useEffect(() => {
    if (isOpen && mounted) {
      trackView(faq.id);
    }
  }, [isOpen, faq.id, trackView, mounted]);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/#faq-${faq.id}`);
    trackShare(faq.id);
    toast.success("Link copied to clipboard!", { duration: 2000 });
  };

  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userVoted === "up") return;
    upvote(faq.id);
    toast.success("Thanks for your feedback!", { duration: 1500 });
  };

  const handleDownvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userVoted === "down") return;
    downvote(faq.id);
    toast("We'll work on improving this answer", { duration: 1500 });
  };

  const totalUpvotes = faq.helpful + engagement.upvotes;
  const totalDownvotes = faq.notHelpful + engagement.downvotes;

  return (
    <motion.div
      layout
      id={`faq-${faq.id}`}
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
        <div className="flex-1 min-w-0">
          <span className="text-sm sm:text-base font-medium leading-relaxed">
            {searchQuery ? highlightText(faq.question, searchQuery) : faq.question}
          </span>
          {!isOpen && rating > 0 && (
            <div className="mt-1.5">
              <StarRating rating={rating} />
            </div>
          )}
        </div>
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

                {/* Engagement Stats */}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Eye size={12} />
                    {engagement.views} views
                  </span>
                  <span>·</span>
                  <StarRating rating={rating} />
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUpvote}
                      disabled={userVoted === "up"}
                      className={cn(
                        "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all",
                        userVoted === "up"
                          ? "bg-success/20 text-success cursor-default"
                          : "text-muted hover:text-foreground hover:bg-background"
                      )}
                      aria-label="Mark as helpful"
                    >
                      <ThumbsUp size={14} />
                      <span>{totalUpvotes}</span>
                    </button>
                    <button
                      onClick={handleDownvote}
                      disabled={userVoted === "down"}
                      className={cn(
                        "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all",
                        userVoted === "down"
                          ? "bg-danger/20 text-danger cursor-default"
                          : "text-muted hover:text-foreground hover:bg-background"
                      )}
                      aria-label="Mark as not helpful"
                    >
                      <ThumbsDown size={14} />
                      <span>{totalDownvotes}</span>
                    </button>
                    <button
                      onClick={handleShare}
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
