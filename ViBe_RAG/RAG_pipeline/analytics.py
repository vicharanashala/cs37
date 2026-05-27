"""
analytics.py
────────────────────────────────────────────────────────────────────────────
Analytics Dashboard Module
────────────────────────────────────────────────────────────────────────────

Provides in-memory query analytics for the RAG pipeline.

Features:
  - Log every query event (question, category, response time, etc.)
  - Questions-per-day time-series with optional date filtering
  - Peak-hours histogram (0-23)
  - Top search terms via collections.Counter
  - Category distribution with percentages
  - Unanswered-query count, average response time, total queries
  - Comprehensive stats summary via get_stats()

Usage:
  from analytics import analytics_store, QueryEvent

  analytics_store.log_query_event(QueryEvent(
      question        = "How do I apply?",
      category        = "joining",
      response_time_ms = 342,
      was_answered     = True,
      source           = "rag",
  ))

  stats = analytics_store.get_stats()
"""

from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

# ── Pydantic schemas ──────────────────────────────────────────────────────────


class QueryEvent(BaseModel):
    """Single query event recorded for analytics."""
    question:         str
    category:         str   = "general"
    response_time_ms: int   = 0
    timestamp:        str   = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    was_answered:     bool  = True
    source:           str   = "rag"   # e.g. "rag", "faq", "fallback"


class AnalyticsStats(BaseModel):
    """Comprehensive analytics summary returned by get_stats()."""
    total_queries:         int
    unanswered_count:      int
    average_response_time: float
    questions_per_day:     list[dict]
    peak_hours:            list[dict]
    top_searches:          list[dict]
    category_distribution: list[dict]


# ── In-memory store ──────────────────────────────────────────────────────────


class AnalyticsStore:
    """
    Thread-safe (GIL-protected) in-memory analytics store.

    Stores a flat list of QueryEvent objects and derives all
    aggregations on-the-fly so the data is always consistent.
    """

    def __init__(self) -> None:
        self._events: list[QueryEvent] = []

    # ── Write ─────────────────────────────────────────────────────────────

    def log_query_event(self, event: QueryEvent) -> None:
        """Append a query event to the store."""
        self._events.append(event)

    # ── Time-series: questions per day ────────────────────────────────────

    def get_questions_per_day(
        self,
        from_date: Optional[str] = None,
        to_date:   Optional[str] = None,
    ) -> list[dict]:
        """
        Return daily query counts as ``[{date, count}, ...]``.

        Parameters
        ----------
        from_date : str, optional
            ISO date string (``YYYY-MM-DD``). Only events on or after this
            date are included.
        to_date : str, optional
            ISO date string (``YYYY-MM-DD``). Only events on or before this
            date are included.
        """
        day_counter: Counter = Counter()

        for ev in self._events:
            day_str = self._parse_date(ev.timestamp)
            if from_date and day_str < from_date:
                continue
            if to_date and day_str > to_date:
                continue
            day_counter[day_str] += 1

        return sorted(
            [{"date": d, "count": c} for d, c in day_counter.items()],
            key=lambda x: x["date"],
        )

    # ── Peak hours ────────────────────────────────────────────────────────

    def get_peak_hours(self) -> list[dict]:
        """
        Return query counts grouped by hour of day (0-23).

        Returns ``[{hour, count}, ...]`` sorted by hour.
        """
        hour_counter: Counter = Counter()

        for ev in self._events:
            hour = self._parse_hour(ev.timestamp)
            hour_counter[hour] += 1

        # Always return all 24 hours for easy charting
        return [
            {"hour": h, "count": hour_counter.get(h, 0)}
            for h in range(24)
        ]

    # ── Top searches ──────────────────────────────────────────────────────

    def get_top_searches(self, limit: int = 20) -> list[dict]:
        """
        Return the most-frequently-asked questions.

        Uses ``collections.Counter`` for efficient term frequency.
        Questions are normalised to lowercase for grouping.
        """
        term_counter: Counter = Counter()

        for ev in self._events:
            normalised = ev.question.strip().lower()
            if normalised:
                term_counter[normalised] += 1

        return [
            {"term": term, "count": count}
            for term, count in term_counter.most_common(limit)
        ]

    # ── Category distribution ─────────────────────────────────────────────

    def get_category_distribution(self) -> list[dict]:
        """
        Return ``[{category, count, percentage}, ...]`` sorted by count
        descending.
        """
        cat_counter: Counter = Counter()

        for ev in self._events:
            cat_counter[ev.category] += 1

        total = len(self._events) or 1   # avoid ZeroDivisionError

        return sorted(
            [
                {
                    "category":   cat,
                    "count":      cnt,
                    "percentage": round(cnt / total * 100, 2),
                }
                for cat, cnt in cat_counter.items()
            ],
            key=lambda x: x["count"],
            reverse=True,
        )

    # ── Scalar aggregations ───────────────────────────────────────────────

    def get_unanswered_count(self) -> int:
        """Return the number of queries that were NOT answered."""
        return sum(1 for ev in self._events if not ev.was_answered)

    def get_average_response_time(self) -> float:
        """Return mean response time in milliseconds (0.0 if no events)."""
        if not self._events:
            return 0.0
        total_ms = sum(ev.response_time_ms for ev in self._events)
        return round(total_ms / len(self._events), 2)

    def get_total_queries(self) -> int:
        """Return total number of logged query events."""
        return len(self._events)

    # ── Comprehensive summary ─────────────────────────────────────────────

    def get_stats(self) -> dict:
        """
        Return a single dict containing every available aggregate.

        Useful for populating an admin dashboard in one call.
        """
        stats = AnalyticsStats(
            total_queries         = self.get_total_queries(),
            unanswered_count      = self.get_unanswered_count(),
            average_response_time = self.get_average_response_time(),
            questions_per_day     = self.get_questions_per_day(),
            peak_hours            = self.get_peak_hours(),
            top_searches          = self.get_top_searches(),
            category_distribution = self.get_category_distribution(),
        )
        return stats.model_dump()

    # ── Internal helpers ──────────────────────────────────────────────────

    @staticmethod
    def _parse_date(iso_ts: str) -> str:
        """Extract ``YYYY-MM-DD`` from an ISO-8601 timestamp string."""
        try:
            dt = datetime.fromisoformat(iso_ts)
        except ValueError:
            # Fallback: take first 10 chars (covers 'YYYY-MM-DD...')
            return iso_ts[:10]
        return dt.strftime("%Y-%m-%d")

    @staticmethod
    def _parse_hour(iso_ts: str) -> int:
        """Extract hour (0-23) from an ISO-8601 timestamp string."""
        try:
            dt = datetime.fromisoformat(iso_ts)
        except ValueError:
            return 0
        return dt.hour


# ── Module-level singleton ───────────────────────────────────────────────────

analytics_store = AnalyticsStore()
