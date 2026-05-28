"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "samagama_faq_engagement";

export interface FAQEngagement {
  views: number;
  upvotes: number;
  downvotes: number;
  shares: number;
  lastViewed: number;
}

export interface EngagementData {
  [faqId: string]: FAQEngagement;
}

const defaultEngagement: FAQEngagement = {
  views: 0,
  upvotes: 0,
  downvotes: 0,
  shares: 0,
  lastViewed: 0,
};

export function useEngagement() {
  const [data, setData] = useState<EngagementData>({});
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load engagement data:", e);
    }
    setMounted(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save engagement data:", e);
    }
  }, [data, mounted]);

  const trackView = useCallback((faqId: string) => {
    setData((prev) => ({
      ...prev,
      [faqId]: {
        ...defaultEngagement,
        ...prev[faqId],
        views: (prev[faqId]?.views || 0) + 1,
        lastViewed: Date.now(),
      },
    }));
  }, []);

  const upvote = useCallback((faqId: string) => {
    setData((prev) => ({
      ...prev,
      [faqId]: {
        ...defaultEngagement,
        ...prev[faqId],
        upvotes: (prev[faqId]?.upvotes || 0) + 1,
      },
    }));
  }, []);

  const downvote = useCallback((faqId: string) => {
    setData((prev) => ({
      ...prev,
      [faqId]: {
        ...defaultEngagement,
        ...prev[faqId],
        downvotes: (prev[faqId]?.downvotes || 0) + 1,
      },
    }));
  }, []);

  const trackShare = useCallback((faqId: string) => {
    setData((prev) => ({
      ...prev,
      [faqId]: {
        ...defaultEngagement,
        ...prev[faqId],
        shares: (prev[faqId]?.shares || 0) + 1,
      },
    }));
  }, []);

  const getEngagement = useCallback(
    (faqId: string): FAQEngagement => {
      return data[faqId] || defaultEngagement;
    },
    [data]
  );

  const getTrending = useCallback(
    (limit: number = 5): string[] => {
      const entries = Object.entries(data);
      // Compute trending score: views + upvotes*3 - downvotes
      const scored = entries.map(([id, e]) => ({
        id,
        score: e.views + e.upvotes * 3 - e.downvotes + e.shares * 2,
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map((s) => s.id);
    },
    [data]
  );

  const getTotalRating = useCallback(
    (faqId: string): number => {
      const e = data[faqId];
      if (!e || (e.upvotes === 0 && e.downvotes === 0)) return 0;
      return Math.round((e.upvotes / (e.upvotes + e.downvotes)) * 100);
    },
    [data]
  );

  return {
    data,
    mounted,
    trackView,
    upvote,
    downvote,
    trackShare,
    getEngagement,
    getTrending,
    getTotalRating,
  };
}
