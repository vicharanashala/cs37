"""
question_tracker.py
────────────────────────────────────────────────────────────────────────────
Question Status Tracking Module
────────────────────────────────────────────────────────────────────────────

Tracks user-submitted questions through their lifecycle:
  pending  →  under_review  →  answered  →  added_to_faq

Features:
  - Submit, retrieve, list, and update questions
  - Answer questions and promote them to the FAQ
  - Aggregate stats (counts by status)

All data is held in-memory via the module-level `question_store` singleton.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

# ── Enums ─────────────────────────────────────────────────────────────────────


class QuestionStatus(str, Enum):
    """Lifecycle states a question can pass through."""

    pending       = "pending"
    under_review  = "under_review"
    answered      = "answered"
    added_to_faq  = "added_to_faq"


# ── Pydantic schemas ─────────────────────────────────────────────────────────


class QuestionCreate(BaseModel):
    """Payload for submitting a new question."""

    question_text: str
    user_id:       str
    category:      Optional[str] = None


class QuestionOut(BaseModel):
    """Full representation returned by every store method."""

    question_id:   str
    question_text: str
    user_id:       str
    category:      Optional[str]          = None
    status:        QuestionStatus         = QuestionStatus.pending
    answer:        Optional[str]          = None
    answered_by:   Optional[str]          = None
    reviewer_id:   Optional[str]          = None
    faq_id:        Optional[str]          = None
    created_at:    datetime               = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at:    datetime               = Field(default_factory=lambda: datetime.now(timezone.utc))
    status_history: list[dict]            = Field(default_factory=list)


# ── In-memory store ──────────────────────────────────────────────────────────


class QuestionStore:
    """
    Thread-unsafe, in-memory question store backed by a plain dict.

    Suitable for prototyping and single-process dev servers.
    Swap with a database-backed implementation for production.
    """

    def __init__(self) -> None:
        self._questions: dict[str, QuestionOut] = {}

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _now() -> datetime:
        """Return the current UTC timestamp."""
        return datetime.now(timezone.utc)

    def _record_status_change(
        self,
        question: QuestionOut,
        new_status: QuestionStatus,
        changed_by: Optional[str] = None,
    ) -> None:
        """Append an entry to the question's status_history list."""
        question.status_history.append({
            "from_status": question.status.value,
            "to_status":   new_status.value,
            "changed_at":  self._now().isoformat(),
            "changed_by":  changed_by,
        })
        question.status     = new_status
        question.updated_at = self._now()

    def _get_or_raise(self, question_id: str) -> QuestionOut:
        """Return the question or raise ``KeyError``."""
        if question_id not in self._questions:
            raise KeyError(f"Question '{question_id}' not found")
        return self._questions[question_id]

    # ── public API ────────────────────────────────────────────────────────

    def submit_question(self, data: QuestionCreate) -> QuestionOut:
        """
        Create a new question with status *pending*.

        Parameters
        ----------
        data : QuestionCreate
            The question payload from the user.

        Returns
        -------
        QuestionOut
            The newly created question record.
        """
        question_id = str(uuid.uuid4())
        now         = self._now()

        question = QuestionOut(
            question_id   = question_id,
            question_text = data.question_text,
            user_id       = data.user_id,
            category      = data.category,
            status        = QuestionStatus.pending,
            created_at    = now,
            updated_at    = now,
            status_history = [{
                "from_status": None,
                "to_status":   QuestionStatus.pending.value,
                "changed_at":  now.isoformat(),
                "changed_by":  data.user_id,
            }],
        )
        self._questions[question_id] = question
        return question

    def get_question(self, question_id: str) -> QuestionOut:
        """
        Retrieve a single question by its ID.

        Raises
        ------
        KeyError
            If no question with the given ID exists.
        """
        return self._get_or_raise(question_id)

    def list_questions(
        self,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[QuestionOut]:
        """
        Return questions, optionally filtered by status.

        Parameters
        ----------
        status : str | None
            If provided, only questions with this status are returned.
        limit : int
            Maximum number of results (default 50).
        """
        questions = list(self._questions.values())

        if status is not None:
            target_status = QuestionStatus(status)
            questions = [q for q in questions if q.status == target_status]

        # Most-recent first
        questions.sort(key=lambda q: q.created_at, reverse=True)
        return questions[:limit]

    def update_status(
        self,
        question_id: str,
        new_status: str,
        reviewer_id: Optional[str] = None,
    ) -> QuestionOut:
        """
        Transition a question to *new_status*.

        Parameters
        ----------
        question_id : str
            Target question.
        new_status : str
            Must be a valid ``QuestionStatus`` value.
        reviewer_id : str | None
            ID of the reviewer making the change.
        """
        question   = self._get_or_raise(question_id)
        target     = QuestionStatus(new_status)

        self._record_status_change(question, target, changed_by=reviewer_id)

        if reviewer_id is not None:
            question.reviewer_id = reviewer_id

        return question

    def answer_question(
        self,
        question_id: str,
        answer_text: str,
        answered_by: str,
    ) -> QuestionOut:
        """
        Provide an answer and set the status to *answered*.

        Parameters
        ----------
        question_id : str
            Target question.
        answer_text : str
            The answer body.
        answered_by : str
            ID of the person or system that answered.
        """
        question = self._get_or_raise(question_id)

        question.answer      = answer_text
        question.answered_by = answered_by

        self._record_status_change(
            question,
            QuestionStatus.answered,
            changed_by=answered_by,
        )
        return question

    def promote_to_faq(self, question_id: str) -> QuestionOut:
        """
        Promote an answered question to the FAQ.

        Sets status to *added_to_faq* and generates a unique ``faq_id``.

        Raises
        ------
        ValueError
            If the question has not been answered yet.
        """
        question = self._get_or_raise(question_id)

        if question.status != QuestionStatus.answered:
            raise ValueError(
                f"Only answered questions can be promoted to FAQ "
                f"(current status: {question.status.value})"
            )

        question.faq_id = f"faq-{uuid.uuid4()}"
        self._record_status_change(
            question,
            QuestionStatus.added_to_faq,
            changed_by=question.answered_by,
        )
        return question

    def get_stats(self) -> dict:
        """
        Return aggregate counts grouped by status.

        Returns
        -------
        dict
            ``{ "total": int, "pending": int, ... }``
        """
        counts: dict[str, int] = {s.value: 0 for s in QuestionStatus}

        for q in self._questions.values():
            counts[q.status.value] += 1

        return {"total": len(self._questions), **counts}


# ── Module-level singleton ───────────────────────────────────────────────────

question_store = QuestionStore()
