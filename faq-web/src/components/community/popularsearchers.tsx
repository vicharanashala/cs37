"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Search, Sparkles } from "lucide-react";

interface SearchItem {
  query: string;
  count: number;
}

interface PopularSearchesProps {
  onSelect: (term: string) => void;
}

export default function PopularSearches({
  onSelect,
}: PopularSearchesProps) {
  const [searches, setSearches] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSearches = async () => {
      try {
        const res = await fetch("/api/popular-searches");
        const data = await res.json();
        setSearches(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadSearches();
  }, []);

  if (loading) {
    return (
      <div className="mt-6 animate-pulse">
        <div className="h-5 w-40 rounded bg-muted mb-4" />
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!searches.length) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <TrendingUp size={20} className="text-accent" />
            Popular Searches
          </h2>

          <p className="text-xs text-muted mt-1">
            Most searched topics by the community
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-xs text-accent font-medium">
          <Sparkles size={14} />
          Live Analytics
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {searches.map((item, index) => (
          <button
            key={item.query}
            onClick={() => onSelect(item.query)}
            className="
              group
              text-left
              rounded-2xl
              border
              border-border
              bg-card
              p-4
              transition-all
              duration-300
              hover:border-accent
              hover:shadow-lg
              hover:-translate-y-1
            "
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Search
                    size={14}
                    className="text-muted group-hover:text-accent"
                  />

                  <span className="text-sm font-semibold">
                    {item.query}
                  </span>
                </div>

                <p className="text-xs text-muted">
                  {item.count.toLocaleString()} searches
                </p>
              </div>

              {index < 3 && (
                <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">
                  TOP {index + 1}
                </span>
              )}
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{
                  width: `${Math.min(
                    (item.count / searches[0].count) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}