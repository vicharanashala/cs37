"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Fuse from "fuse.js";
import toast from "react-hot-toast";
import { Search, Loader2, BookOpen } from "lucide-react";
import FAQCard from "@/components/FAQCard";
import CategoryFilter from "@/components/CategoryFilter";
import type { FAQ, Category } from "@/data/faqData";

export default function LiveFAQList() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set());

  const fetchFaqs = async () => {
    try {
      const res = await fetch("/api/faqs");
      const data = await res.json();
      if (data.ok) {
        setFaqs(data.faqs ?? []);
        setCategories(data.categories ?? []);
      } else {
        toast.error("Failed to load live FAQs");
      }
    } catch (err) {
      toast.error("Network error: failed to fetch live FAQs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFaqs();
  }, []);

  const liveFuse = useMemo(
    () =>
      new Fuse(faqs, {
        keys: [
          { name: "question", weight: 0.5 },
          { name: "answer", weight: 0.3 },
          { name: "tags", weight: 0.2 },
        ],
        threshold: 0.35,
        includeScore: true,
      }),
    [faqs]
  );

  const filteredFAQs = useMemo(() => {
    let results = faqs;

    if (searchQuery.trim()) {
      const fuseResults = liveFuse.search(searchQuery);
      results = fuseResults.map((r) => r.item);
    }

    if (selectedCategory !== null) {
      results = results.filter((faq) => faq.categoryId === selectedCategory);
    }

    return results;
  }, [faqs, searchQuery, selectedCategory, liveFuse]);

  const toggleFAQ = useCallback((id: string) => {
    setOpenFAQs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = () => {
    setOpenFAQs(new Set(filteredFAQs.map((f) => f.id)));
  };

  const collapseAll = () => {
    setOpenFAQs(new Set());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search live FAQs by question, answer, or tags..."
          className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
      </div>

      {/* Category Selection Filter */}
      {categories.length > 0 && (
        <div className="mb-2">
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent mr-2" size={24} />
          <span className="text-sm text-muted">Loading live FAQs...</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted">
              <BookOpen size={14} />
              <span>
                Showing {filteredFAQs.length} of {faqs.length} live FAQ{faqs.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted hover:text-foreground transition-all"
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted hover:text-foreground transition-all"
              >
                Collapse all
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredFAQs.map((faq) => (
              <FAQCard
                key={faq.id}
                faq={faq}
                isOpen={openFAQs.has(faq.id)}
                onToggle={() => toggleFAQ(faq.id)}
                searchQuery={searchQuery}
              />
            ))}

            {filteredFAQs.length === 0 && (
              <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
                <Search size={36} className="mx-auto mb-2 text-muted opacity-50" />
                <p className="text-sm text-muted">No live FAQs found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
