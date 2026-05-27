"""
admin_dashboard.py
────────────────────────────────────────────────────────────────────────────
Admin Dashboard Module for the RAG Pipeline
────────────────────────────────────────────────────────────────────────────

Provides a high-level administrative view over:
  • Question tracker  – submitted questions & their statuses
  • Voting            – community votes and suggestions on FAQ items
  • Analytics         – query / usage telemetry

Key capabilities:
  - Aggregate dashboard statistics
  - Identify repeated / similar questions
  - Category-level breakdowns
  - Per-user activity summaries
  - Pending-review queue
  - FAQ usefulness scoring
  - Moderator assignment
  - Duplicate-question merging
"""

import re
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

# ── Imports from sibling modules ──────────────────────────────────────────────
# These stores are expected to be simple dicts keyed by id.
# If the sibling modules have not been created yet the dashboard still loads
# and operates on empty dicts so the rest of the application can start up.

try:
    from question_tracker import question_store  # type: ignore[import-untyped]
    _qstore = question_store._questions          # dict[str, QuestionOut]
except ImportError:
    _qstore: dict = {}
    question_store = None

try:
    from voting import vote_store, suggestion_store  # type: ignore[import-untyped]
    _vstore  = vote_store._votes               # dict[str, VoteOut]
    _sstore  = suggestion_store._suggestions   # dict[str, SuggestionOut]
except ImportError:
    _vstore: dict = {}
    _sstore: dict = {}
    vote_store = None
    suggestion_store = None

try:
    from analytics import analytics_store  # type: ignore[import-untyped]
    _astore = analytics_store._events          # list[QueryEvent]
except ImportError:
    _astore: list = []
    analytics_store = None


# ── Pydantic Models ──────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    """Top-level aggregate numbers shown on the admin dashboard."""
    total_questions:   int = 0
    pending_reviews:   int = 0
    answered:          int = 0
    added_to_faq:      int = 0
    total_votes:       int = 0
    total_suggestions: int = 0
    total_queries:     int = 0


class CategoryStat(BaseModel):
    """Question count for a single category."""
    category: str
    count:    int


class RepeatedQuestion(BaseModel):
    """A cluster of similar questions grouped by normalised text."""
    normalized_text: str
    count:           int
    question_ids:    list[str]


class UserActivity(BaseModel):
    """Number of questions submitted by a single user."""
    user_id:        str
    question_count: int


class MergeRequest(BaseModel):
    """Request body for merging duplicate questions into a canonical one."""
    question_ids: list[str]
    canonical_id: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """
    Lowercase, strip punctuation and collapse whitespace so that trivially
    different phrasings (e.g. extra spaces, trailing '?') are grouped together.
    """
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


# ── AdminDashboard class ─────────────────────────────────────────────────────

class AdminDashboard:
    """
    Read-only (mostly) aggregation layer that sits on top of the in-memory
    stores exposed by *question_tracker*, *voting*, and *analytics*.
    """

    # ── Statistics ────────────────────────────────────────────────────────

    def get_dashboard_stats(self) -> DashboardStats:
        """Aggregate high-level numbers from every store."""
        qs = _qstore
        total_questions = len(qs)

        pending_reviews = sum(
            1 for q in qs.values()
            if str(getattr(q, "status", "")) in ("pending", "under_review")
        )
        answered = sum(
            1 for q in qs.values()
            if str(getattr(q, "status", "")) == "answered"
        )
        added_to_faq = sum(
            1 for q in qs.values()
            if str(getattr(q, "status", "")) == "added_to_faq"
        )

        total_votes       = len(_vstore)
        total_suggestions = len(_sstore)
        total_queries     = len(_astore)

        return DashboardStats(
            total_questions   = total_questions,
            pending_reviews   = pending_reviews,
            answered          = answered,
            added_to_faq      = added_to_faq,
            total_votes       = total_votes,
            total_suggestions = total_suggestions,
            total_queries     = total_queries,
        )

    # ── Repeated / Similar Questions ─────────────────────────────────────

    def get_top_repeated(self, limit: int = 10) -> list[RepeatedQuestion]:
        """
        Group questions by their normalised text and return the top *limit*
        clusters sorted by descending count.
        """
        groups: dict[str, list[str]] = defaultdict(list)

        for qid, q in _qstore.items():
            text = getattr(q, "question_text", None) or ""
            norm = _normalize(text)
            if norm:
                groups[norm].append(qid)

        repeated = [
            RepeatedQuestion(
                normalized_text = norm,
                count           = len(ids),
                question_ids    = ids,
            )
            for norm, ids in groups.items()
            if len(ids) > 1
        ]

        repeated.sort(key=lambda r: r.count, reverse=True)
        return repeated[:limit]

    # ── Category Breakdown ───────────────────────────────────────────────

    def get_category_breakdown(self) -> list[CategoryStat]:
        """Return question counts per category."""
        counter: Counter = Counter()

        for q in _qstore.values():
            cat = getattr(q, "category", None) or "uncategorized"
            counter[cat] += 1

        return [
            CategoryStat(category=cat, count=cnt)
            for cat, cnt in counter.most_common()
        ]

    # ── User Activity ────────────────────────────────────────────────────

    def get_user_activity(self, limit: int = 20) -> list[UserActivity]:
        """Return top *limit* users ranked by number of submitted questions."""
        counter: Counter = Counter()

        for q in _qstore.values():
            uid = getattr(q, "user_id", None) or "anonymous"
            counter[uid] += 1

        return [
            UserActivity(user_id=uid, question_count=cnt)
            for uid, cnt in counter.most_common(limit)
        ]

    # ── Pending Reviews ──────────────────────────────────────────────────

    def get_pending_reviews(self) -> list:
        """Return all questions whose status is *pending* or *under_review*."""
        pending = []
        for qid, q in _qstore.items():
            if str(getattr(q, "status", "")) in ("pending", "under_review"):
                entry = q.model_dump() if hasattr(q, "model_dump") else vars(q)
                pending.append({**entry, "id": qid})
        return pending

    # ── FAQ Usefulness ───────────────────────────────────────────────────

    def get_faq_usefulness(self) -> list[dict]:
        """
        Return FAQ items together with their aggregated vote scores.

        Each dict has:  target_id, upvotes, downvotes, score (up − down)
        """
        scores: dict[str, dict] = defaultdict(
            lambda: {"target_id": "", "upvotes": 0, "downvotes": 0, "score": 0}
        )

        for vote in _vstore.values():
            target_id = getattr(vote, "target_id", None)
            vote_type = str(getattr(vote, "vote_type", ""))
            if not target_id:
                continue
            bucket = scores[target_id]
            bucket["target_id"] = target_id
            if vote_type == "upvote":
                bucket["upvotes"] += 1
                bucket["score"] += 1
            elif vote_type == "downvote":
                bucket["downvotes"] += 1
                bucket["score"] -= 1

        result = list(scores.values())
        result.sort(key=lambda x: x["score"], reverse=True)
        return result

    # ── Moderator Assignment ─────────────────────────────────────────────

    def assign_moderator(self, question_id: str, moderator_id: str) -> dict:
        """
        Assign *moderator_id* to the question and move it to under_review.
        Delegates to question_store.update_status for proper state management.
        """
        if question_store is None or question_id not in _qstore:
            return {"success": False, "error": f"Question '{question_id}' not found"}

        now = datetime.now(timezone.utc).isoformat()
        question_store.update_status(question_id, "under_review", reviewer_id=moderator_id)

        return {
            "success":      True,
            "question_id":  question_id,
            "moderator_id": moderator_id,
            "status":       "under_review",
            "updated_at":   now,
        }

    # ── Merge Duplicate Questions ────────────────────────────────────────

    def merge_questions(self, merge_request: MergeRequest) -> dict:
        """
        Merge duplicate questions into one canonical question.
        Non-canonical questions are marked with status 'merged'.
        """
        if merge_request.canonical_id not in _qstore:
            return {
                "success": False,
                "error":   f"Canonical question '{merge_request.canonical_id}' not found",
            }

        now = datetime.now(timezone.utc).isoformat()
        merged_ids: list[str] = []

        for qid in merge_request.question_ids:
            if qid == merge_request.canonical_id or qid not in _qstore:
                continue
            q = _qstore[qid]
            # Mark as merged via status_history
            q.status_history.append({
                "from_status": str(q.status),
                "to_status":   "merged",
                "changed_at":  now,
                "changed_by":  "admin_merge",
                "merged_into": merge_request.canonical_id,
            })
            q.updated_at = datetime.now(timezone.utc)
            merged_ids.append(qid)

        return {
            "success":      True,
            "canonical_id": merge_request.canonical_id,
            "merged_ids":   merged_ids,
            "merged_count": len(merged_ids),
            "merged_at":    now,
        }


# ── Module-level singleton ───────────────────────────────────────────────────

admin_dashboard = AdminDashboard()
