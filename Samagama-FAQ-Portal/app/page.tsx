"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Fuse from "fuse.js";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import FAQCard from "@/components/FAQCard";
import YakshaChat from "@/components/YakshaChat";
import { faqData, categories } from "@/data/faqData";
import { BookOpen, TrendingUp, Users } from "lucide-react";

const fuse = new Fuse(faqData, {
  keys: [
    { name: "question", weight: 0.5 },
    { name: "answer", weight: 0.3 },
    { name: "tags", weight: 0.2 },
  ],
  threshold: 0.35,
  includeScore: true,
});

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set());

  const filteredFAQs = useMemo(() => {
    let results = faqData;

    if (searchQuery.trim()) {
      const fuseResults = fuse.search(searchQuery);
      results = fuseResults.map((r) => r.item);
    }

    if (selectedCategory !== null) {
      results = results.filter((faq) => faq.categoryId === selectedCategory);
    }

    return results;
  }, [searchQuery, selectedCategory]);

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

  // Group FAQs by category for display
  const groupedFAQs = useMemo(() => {
    if (searchQuery.trim() || selectedCategory !== null) {
      return [{ category: null, faqs: filteredFAQs }];
    }

    const groups: { category: string; faqs: typeof faqData }[] = [];
    const categoryMap = new Map<string, typeof faqData>();

    filteredFAQs.forEach((faq) => {
      const existing = categoryMap.get(faq.category) || [];
      existing.push(faq);
      categoryMap.set(faq.category, existing);
    });

    categoryMap.forEach((faqs, category) => {
      groups.push({ category, faqs });
    });

    return groups;
  }, [filteredFAQs, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Vicharanashala Internship{" "}
              <span className="text-accent">FAQ</span>
            </h1>
            <p className="text-muted text-sm sm:text-base max-w-xl mx-auto">
              Applied AI · Open-source Software Engineering · IIT Ropar
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              resultCount={searchQuery ? filteredFAQs.length : undefined}
            />
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex justify-center gap-6 sm:gap-10 mt-8"
          >
            <div className="flex items-center gap-2 text-sm text-muted">
              <BookOpen size={16} className="text-accent" />
              <span>{faqData.length} answers</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <TrendingUp size={16} className="text-accent" />
              <span>{categories.length} categories</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Users size={16} className="text-accent" />
              <span>600+ interns</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </motion.div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted">
            Showing{" "}
            <span className="text-foreground font-medium">
              {filteredFAQs.length}
            </span>{" "}
            question{filteredFAQs.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-muted transition-all"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-muted transition-all"
            >
              Collapse all
            </button>
          </div>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {groupedFAQs.map((group, groupIdx) => (
            <div key={group.category || groupIdx}>
              {group.category && (
                <motion.h2
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: groupIdx * 0.05 }}
                  className="text-lg font-semibold mb-3 mt-8 first:mt-0 flex items-center gap-2"
                >
                  <span>
                    {categories.find((c) => c.name === group.category)?.icon}
                  </span>
                  {group.category}
                </motion.h2>
              )}
              <div className="space-y-2">
                {group.faqs.map((faq, idx) => (
                  <motion.div
                    key={faq.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <FAQCard
                      faq={faq}
                      isOpen={openFAQs.has(faq.id)}
                      onToggle={() => toggleFAQ(faq.id)}
                      searchQuery={searchQuery}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}

          {filteredFAQs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-lg font-medium mb-2">No results found</p>
              <p className="text-sm text-muted mb-4">
                Try different keywords or ask Yaksha directly
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="text-sm text-accent hover:underline"
              >
                Clear search
              </button>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 pb-8 border-t border-border pt-8 text-center">
          <p className="text-xs text-muted">
            Vicharanashala Lab · Indian Institute of Technology Ropar · 2026
            cycle
          </p>
          <p className="text-xs text-muted mt-1">
            FAQ Version: v22.1.0 · Last updated: 2026-05-24
          </p>
        </footer>
      </main>

      {/* Yaksha Chat */}
      <YakshaChat />
    </div>
  );
}
