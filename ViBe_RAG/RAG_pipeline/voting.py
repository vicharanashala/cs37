"""
voting.py
────────────────────────────────────────────────────────────────────────────
Crowd Voting & Community Suggestions Module
────────────────────────────────────────────────────────────────────────────

Two complementary subsystems:

1. **Votes** – users cast upvote / downvote / helpful / not_helpful on any
   target (question, answer, suggestion, etc.).  One vote per user per
   target; re-voting silently updates the existing vote.

2. **Suggestions** – users propose alternative answers to questions.
   Suggestions can be approved / rejected and themselves receive votes.

Both stores are in-memory and exposed as module-level singletons:
  ``vote_store``  and  ``suggestion_store``
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

# ── Enums ─────────────────────────────────────────────────────────────────────


class VoteType(str, Enum):
    """Allowed vote flavours."""

    upvote      = "upvote"
    downvote    = "downvote"
    helpful     = "helpful"
    not_helpful = "not_helpful"


class SuggestionStatus(str, Enum):
    """Lifecycle states for a community suggestion."""

    pending  = "pending"
    approved = "approved"
    rejected = "rejected"


# ── Pydantic schemas — Votes ─────────────────────────────────────────────────


class VoteCreate(BaseModel):
    """Payload for casting (or updating) a vote."""

    target_id:   str
    target_type: str        # e.g. "question", "answer", "suggestion"
    user_id:     str
    vote_type:   VoteType


class VoteOut(BaseModel):
    """Full vote record returned to the caller."""

    vote_id:     str
    target_id:   str
    target_type: str
    user_id:     str
    vote_type:   VoteType
    created_at:  datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at:  datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── Pydantic schemas — Suggestions ───────────────────────────────────────────


class SuggestionCreate(BaseModel):
    """Payload for submitting a community answer suggestion."""

    question_id:      str
    user_id:          str
    suggested_answer: str


class SuggestionOut(BaseModel):
    """Full suggestion record returned to the caller."""

    suggestion_id:    str
    question_id:      str
    user_id:          str
    suggested_answer: str
    status:           SuggestionStatus = SuggestionStatus.pending
    created_at:       datetime         = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at:       datetime         = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── In-memory Vote store ─────────────────────────────────────────────────────


class VoteStore:
    """
    In-memory vote ledger.

    Enforces **one vote per user per target** — if a user votes again on the
    same target the existing vote is updated rather than duplicated.
    """

    def __init__(self) -> None:
        self._votes: dict[str, VoteOut] = {}
        # Fast lookup: (user_id, target_id) -> vote_id
        self._user_target_index: dict[tuple[str, str], str] = {}

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    # ── public API ────────────────────────────────────────────────────────

    def cast_vote(self, data: VoteCreate) -> VoteOut:
        """
        Record a vote, enforcing one-vote-per-user-per-target.

        If the user has already voted on this target the vote type is
        updated in-place and the original ``vote_id`` is preserved.

        Parameters
        ----------
        data : VoteCreate

        Returns
        -------
        VoteOut
            The created or updated vote.
        """
        key = (data.user_id, data.target_id)
        now = self._now()

        if key in self._user_target_index:
            # Update existing vote
            existing = self._votes[self._user_target_index[key]]
            existing.vote_type  = data.vote_type
            existing.updated_at = now
            return existing

        # New vote
        vote_id = str(uuid.uuid4())
        vote = VoteOut(
            vote_id     = vote_id,
            target_id   = data.target_id,
            target_type = data.target_type,
            user_id     = data.user_id,
            vote_type   = data.vote_type,
            created_at  = now,
            updated_at  = now,
        )
        self._votes[vote_id]    = vote
        self._user_target_index[key] = vote_id
        return vote

    def get_votes(self, target_id: str) -> dict:
        """
        Aggregate vote counts for a given target.

        Returns
        -------
        dict
            ``{ "target_id": str, "upvote": int, "downvote": int,
                 "helpful": int, "not_helpful": int, "total": int }``
        """
        counts: dict[str, int] = {vt.value: 0 for vt in VoteType}

        for vote in self._votes.values():
            if vote.target_id == target_id:
                counts[vote.vote_type.value] += 1

        total = sum(counts.values())
        return {"target_id": target_id, **counts, "total": total}

    def get_helpfulness(self, target_id: str) -> float:
        """
        Compute a helpfulness / usefulness score for *target_id*.

        Formula::

            usefulness_score = (upvotes + helpful) / total_votes

        Returns ``0.0`` when there are no votes.
        """
        counts = self.get_votes(target_id)
        total  = counts["total"]

        if total == 0:
            return 0.0

        positive = counts[VoteType.upvote.value] + counts[VoteType.helpful.value]
        return round(positive / total, 4)


# ── In-memory Suggestion store ───────────────────────────────────────────────


class SuggestionStore:
    """
    In-memory store for community-submitted answer suggestions.

    Each suggestion is tied to a ``question_id`` and can be independently
    approved / rejected by a moderator.
    """

    def __init__(self) -> None:
        self._suggestions: dict[str, SuggestionOut] = {}

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    def _get_or_raise(self, suggestion_id: str) -> SuggestionOut:
        if suggestion_id not in self._suggestions:
            raise KeyError(f"Suggestion '{suggestion_id}' not found")
        return self._suggestions[suggestion_id]

    # ── public API ────────────────────────────────────────────────────────

    def submit_suggestion(self, data: SuggestionCreate) -> SuggestionOut:
        """
        Submit a new community answer suggestion.

        Parameters
        ----------
        data : SuggestionCreate

        Returns
        -------
        SuggestionOut
            The newly created suggestion record.
        """
        suggestion_id = str(uuid.uuid4())
        now           = self._now()

        suggestion = SuggestionOut(
            suggestion_id    = suggestion_id,
            question_id      = data.question_id,
            user_id          = data.user_id,
            suggested_answer = data.suggested_answer,
            status           = SuggestionStatus.pending,
            created_at       = now,
            updated_at       = now,
        )
        self._suggestions[suggestion_id] = suggestion
        return suggestion

    def get_suggestions(self, question_id: str) -> list[SuggestionOut]:
        """
        Return all suggestions for a given question, newest first.

        Parameters
        ----------
        question_id : str
            The question to look up suggestions for.
        """
        results = [
            s for s in self._suggestions.values()
            if s.question_id == question_id
        ]
        results.sort(key=lambda s: s.created_at, reverse=True)
        return results

    def update_suggestion_status(
        self,
        suggestion_id: str,
        status: str,
    ) -> SuggestionOut:
        """
        Approve or reject a suggestion.

        Parameters
        ----------
        suggestion_id : str
            Target suggestion.
        status : str
            Must be a valid ``SuggestionStatus`` value
            (``"approved"`` or ``"rejected"``).

        Raises
        ------
        KeyError
            If the suggestion does not exist.
        """
        suggestion            = self._get_or_raise(suggestion_id)
        suggestion.status     = SuggestionStatus(status)
        suggestion.updated_at = self._now()
        return suggestion


# ── Module-level singletons ──────────────────────────────────────────────────

vote_store       = VoteStore()
suggestion_store = SuggestionStore()
