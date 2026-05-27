"""
recommendations.py
────────────────────────────────────────────────────────────────────────────
FAQ Recommendation Engine
────────────────────────────────────────────────────────────────────────────

Provides personalised and general FAQ recommendations for the RAG
pipeline using purely in-memory data structures (no database required).

Recommendation strategies:
  - **Popular**    – most-viewed FAQs overall
  - **Trending**   – FAQs with a surge of views in the last N hours
  - **By category**– most-viewed within a specific category
  - **Related**    – "users also asked" via co-occurrence tracking
  - **Personalised** – a blended mix of the above, weighted per user

Usage:
  from recommendations import rec_engine, Recommendation

  rec_engine.record_faq_view("user_42", "faq_joining_01", "joining")
  recs = rec_engine.get_recommendations("user_42", category="joining")
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel, Field

# ── Pydantic schemas ──────────────────────────────────────────────────────────


class Recommendation(BaseModel):
    """A single FAQ recommendation returned to the client."""
    faq_id:   str
    title:    str
    category: str
    reason:   str            # e.g. "popular", "trending", "related"
    score:    float = 0.0    # higher is more relevant


class RecommendationRequest(BaseModel):
    """Payload for the personalised-recommendations endpoint."""
    user_id:  str
    category: Optional[str] = None
    limit:    int            = 10

# ── Seed / demo catalogue ────────────────────────────────────────────────────

# Maps faq_id -> {title, category} for display purposes.
# Pre-populated so the engine works out-of-the-box for demos.

_SEED_FAQS: dict[str, dict] = {
    # ── Joining ───────────────────────────────────────────────────────────
    "faq_joining_01": {
        "title":    "How do I accept the internship offer?",
        "category": "joining",
    },
    "faq_joining_02": {
        "title":    "What documents are needed for joining?",
        "category": "joining",
    },
    "faq_joining_03": {
        "title":    "When is the joining deadline?",
        "category": "joining",
    },
    # ── Exam ──────────────────────────────────────────────────────────────
    "faq_exam_01": {
        "title":    "What is the exam schedule?",
        "category": "exam",
    },
    "faq_exam_02": {
        "title":    "How do I register for the exam?",
        "category": "exam",
    },
    "faq_exam_03": {
        "title":    "Where can I find the exam syllabus?",
        "category": "exam",
    },
    # ── Hostel ────────────────────────────────────────────────────────────
    "faq_hostel_01": {
        "title":    "How is hostel allotment done?",
        "category": "hostel",
    },
    "faq_hostel_02": {
        "title":    "What are the hostel fee details?",
        "category": "hostel",
    },
    "faq_hostel_03": {
        "title":    "What items should I bring to the hostel?",
        "category": "hostel",
    },
    # ── Certificate ───────────────────────────────────────────────────────
    "faq_cert_01": {
        "title":    "How do I get the completion certificate?",
        "category": "certificate",
    },
    "faq_cert_02": {
        "title":    "Is the certificate digitally verifiable?",
        "category": "certificate",
    },
    "faq_cert_03": {
        "title":    "When are certificates issued?",
        "category": "certificate",
    },
}


# ── In-memory engine ─────────────────────────────────────────────────────────


class RecommendationEngine:
    """
    In-memory recommendation engine for FAQs.

    Data structures
    ---------------
    _faq_catalogue : dict[str, dict]
        faq_id -> {title, category}  (seed + dynamically added)
    _views : list[dict]
        Timestamped view records ``{user_id, faq_id, category, ts}``
    _view_counts : Counter
        Global view counts per faq_id (fast popularity lookup)
    _user_views : dict[str, Counter]
        Per-user view counts: user_id -> Counter[faq_id]
    _cooccurrences : dict[str, Counter]
        faq_id -> Counter[related_faq_id]  (symmetric)
    """

    def __init__(self) -> None:
        self._faq_catalogue: dict[str, dict]      = dict(_SEED_FAQS)
        self._views:         list[dict]            = []
        self._view_counts:   Counter               = Counter()
        self._user_views:    dict[str, Counter]     = defaultdict(Counter)
        self._cooccurrences: dict[str, Counter]     = defaultdict(Counter)

    # ── Catalogue helpers ─────────────────────────────────────────────────

    def _ensure_faq(self, faq_id: str, category: str = "general") -> None:
        """Register an unknown FAQ so recommendations can still be built."""
        if faq_id not in self._faq_catalogue:
            self._faq_catalogue[faq_id] = {
                "title":    faq_id,
                "category": category,
            }

    def _faq_title(self, faq_id: str) -> str:
        return self._faq_catalogue.get(faq_id, {}).get("title", faq_id)

    def _faq_category(self, faq_id: str) -> str:
        return self._faq_catalogue.get(faq_id, {}).get("category", "general")

    # ── Recording signals ─────────────────────────────────────────────────

    def record_faq_view(
        self,
        user_id:  str,
        faq_id:   str,
        category: str = "general",
    ) -> None:
        """
        Record that a user viewed a particular FAQ.

        Updates global counts, per-user counts, and the timestamped
        view log used by trending calculations.
        """
        self._ensure_faq(faq_id, category)

        self._views.append({
            "user_id":  user_id,
            "faq_id":   faq_id,
            "category": category,
            "ts":       datetime.now(timezone.utc),
        })
        self._view_counts[faq_id] += 1
        self._user_views[user_id][faq_id] += 1

    def record_question_pair(self, faq_id_1: str, faq_id_2: str) -> None:
        """
        Record that two FAQs were asked together ("users also asked").

        The relationship is stored symmetrically so that querying from
        either side returns the other.
        """
        if faq_id_1 == faq_id_2:
            return
        self._cooccurrences[faq_id_1][faq_id_2] += 1
        self._cooccurrences[faq_id_2][faq_id_1] += 1

    # ── Recommendation strategies ─────────────────────────────────────────

    def get_popular(self, limit: int = 10) -> list[Recommendation]:
        """Return the most-viewed FAQs overall."""
        return [
            Recommendation(
                faq_id   = faq_id,
                title    = self._faq_title(faq_id),
                category = self._faq_category(faq_id),
                reason   = "popular",
                score    = float(count),
            )
            for faq_id, count in self._view_counts.most_common(limit)
        ]

    def get_trending(
        self,
        hours: int = 24,
        limit: int = 10,
    ) -> list[Recommendation]:
        """
        Return FAQs with the most views in the last *hours* hours.

        A simple "recent surge" heuristic — good enough for an
        in-memory demo without complex decay functions.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_counter: Counter = Counter()

        for view in self._views:
            if view["ts"] >= cutoff:
                recent_counter[view["faq_id"]] += 1

        return [
            Recommendation(
                faq_id   = faq_id,
                title    = self._faq_title(faq_id),
                category = self._faq_category(faq_id),
                reason   = "trending",
                score    = float(count),
            )
            for faq_id, count in recent_counter.most_common(limit)
        ]

    def get_by_category(
        self,
        category: str,
        limit:    int = 10,
    ) -> list[Recommendation]:
        """Return the most-viewed FAQs within a single category."""
        cat_counter: Counter = Counter()

        for view in self._views:
            if view["category"] == category:
                cat_counter[view["faq_id"]] += 1

        return [
            Recommendation(
                faq_id   = faq_id,
                title    = self._faq_title(faq_id),
                category = self._faq_category(faq_id),
                reason   = f"top in {category}",
                score    = float(count),
            )
            for faq_id, count in cat_counter.most_common(limit)
        ]

    def get_related(
        self,
        faq_id: str,
        limit:  int = 5,
    ) -> list[Recommendation]:
        """
        Return FAQs frequently asked alongside *faq_id*
        (co-occurrence based "users also asked").
        """
        if faq_id not in self._cooccurrences:
            return []

        return [
            Recommendation(
                faq_id   = related_id,
                title    = self._faq_title(related_id),
                category = self._faq_category(related_id),
                reason   = "users also asked",
                score    = float(count),
            )
            for related_id, count
            in self._cooccurrences[faq_id].most_common(limit)
        ]

    def get_recommendations(
        self,
        user_id:  str,
        category: Optional[str] = None,
        limit:    int           = 10,
    ) -> list[Recommendation]:
        """
        Build a personalised recommendation list for *user_id*.

        Strategy
        --------
        1. Start with **trending** FAQs (freshness signal).
        2. If a *category* is specified, layer in top-of-category FAQs.
        3. Boost FAQs **related** to the user's most-viewed FAQ.
        4. Fill remaining slots with **popular** FAQs.
        5. De-duplicate and trim to *limit*.

        This is intentionally simple — a production system would use
        collaborative filtering or embedding similarity.
        """
        seen:    set[str]             = set()
        result:  list[Recommendation] = []

        def _add(recs: list[Recommendation]) -> None:
            for rec in recs:
                if rec.faq_id not in seen and len(result) < limit:
                    seen.add(rec.faq_id)
                    result.append(rec)

        # 1. Trending
        _add(self.get_trending(hours=24, limit=limit))

        # 2. Category filter
        if category:
            _add(self.get_by_category(category, limit=limit))

        # 3. Related to the user's most-viewed FAQ
        user_counts = self._user_views.get(user_id)
        if user_counts:
            top_faq = user_counts.most_common(1)[0][0]
            _add(self.get_related(top_faq, limit=limit))

        # 4. Popular backfill
        _add(self.get_popular(limit=limit))

        return result[:limit]


# ── Module-level singleton ───────────────────────────────────────────────────

rec_engine = RecommendationEngine()

# ── Seed demo data ───────────────────────────────────────────────────────────
# Pre-populate a handful of views so the engine returns useful results
# even before real traffic arrives.


def _seed_demo_data() -> None:
    """Inject synthetic views and co-occurrences for demonstration."""

    demo_views: list[tuple[str, str, str]] = [
        # (user_id, faq_id, category)
        ("demo_user_1", "faq_joining_01", "joining"),
        ("demo_user_1", "faq_joining_02", "joining"),
        ("demo_user_2", "faq_joining_01", "joining"),
        ("demo_user_2", "faq_exam_01",    "exam"),
        ("demo_user_3", "faq_exam_01",    "exam"),
        ("demo_user_3", "faq_exam_02",    "exam"),
        ("demo_user_3", "faq_exam_03",    "exam"),
        ("demo_user_4", "faq_hostel_01",  "hostel"),
        ("demo_user_4", "faq_hostel_02",  "hostel"),
        ("demo_user_5", "faq_cert_01",    "certificate"),
        ("demo_user_5", "faq_cert_02",    "certificate"),
        ("demo_user_6", "faq_joining_01", "joining"),
        ("demo_user_6", "faq_hostel_01",  "hostel"),
        ("demo_user_7", "faq_exam_01",    "exam"),
        ("demo_user_7", "faq_cert_01",    "certificate"),
    ]

    for user_id, faq_id, category in demo_views:
        rec_engine.record_faq_view(user_id, faq_id, category)

    # Co-occurrences — pairs commonly asked together
    demo_pairs: list[tuple[str, str]] = [
        ("faq_joining_01", "faq_joining_02"),
        ("faq_joining_01", "faq_hostel_01"),
        ("faq_exam_01",    "faq_exam_02"),
        ("faq_exam_01",    "faq_exam_03"),
        ("faq_cert_01",    "faq_cert_02"),
        ("faq_hostel_01",  "faq_hostel_02"),
    ]

    for faq_a, faq_b in demo_pairs:
        rec_engine.record_question_pair(faq_a, faq_b)


_seed_demo_data()
