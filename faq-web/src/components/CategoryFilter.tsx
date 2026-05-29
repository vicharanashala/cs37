"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Category } from "@/data/faqData";

interface CategoryFilterProps {
  categories: Category[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}

export default function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 pb-2 min-w-max px-1">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
            selected === null
              ? "text-background"
              : "text-muted hover:text-foreground bg-card border border-border hover:border-muted"
          )}
        >
          {selected === null && (
            <motion.div
              layoutId="activeCategory"
              className="absolute inset-0 bg-accent rounded-xl"
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">All</span>
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id === selected ? null : cat.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              selected === cat.id
                ? "text-background"
                : "text-muted hover:text-foreground bg-card border border-border hover:border-muted"
            )}
          >
            {selected === cat.id && (
              <motion.div
                layoutId="activeCategory"
                className="absolute inset-0 bg-accent rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{cat.icon}</span>
            <span className="relative z-10">{cat.name}</span>
            <span
              className={cn(
                "relative z-10 text-xs px-1.5 py-0.5 rounded-full",
                selected === cat.id
                  ? "bg-background/20"
                  : "bg-background text-muted"
              )}
            >
              {cat.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
