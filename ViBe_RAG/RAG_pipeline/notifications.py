"""
notifications.py
────────────────────────────────────────────────────────────────────────────
Notification System Module for the RAG Pipeline
────────────────────────────────────────────────────────────────────────────

Provides a lightweight, in-memory notification subsystem that supports:
  • Multiple notification types  (question_answered, faq_updated, …)
  • Delivery channels            (in_app, email, both)
  • Per-user read / unread state
  • Per-user notification preferences
  • Convenience helpers for common events

No database required – all state lives in Python dicts that are created
at module import time.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class NotificationType(str, Enum):
    """Supported notification types."""
    question_answered = "question_answered"
    faq_updated       = "faq_updated"
    announcement      = "announcement"
    similar_answered  = "similar_answered"
    weekly_digest     = "weekly_digest"


class Channel(str, Enum):
    """Delivery channel for a notification."""
    in_app = "in_app"
    email  = "email"
    both   = "both"


# ── Pydantic Models ──────────────────────────────────────────────────────────

class NotificationCreate(BaseModel):
    """Payload used to create a new notification."""
    user_id:        str
    type:           NotificationType
    title:          str
    message:        str
    reference_id:   Optional[str] = None
    reference_type: Optional[str] = None
    channel:        Channel = Channel.in_app


class NotificationOut(BaseModel):
    """Notification as returned to callers (includes server-generated fields)."""
    id:             str
    user_id:        str
    type:           NotificationType
    title:          str
    message:        str
    reference_id:   Optional[str] = None
    reference_type: Optional[str] = None
    channel:        Channel = Channel.in_app
    is_read:        bool = False
    created_at:     str = ""
    updated_at:     str = ""


class NotificationPreferences(BaseModel):
    """Per-user notification preference document."""
    user_id:       str
    email_enabled: bool = True
    in_app_enabled: bool = True
    types_enabled: list[str] = Field(
        default_factory=lambda: [t.value for t in NotificationType],
    )


# ── In-Memory Notification Store ─────────────────────────────────────────────

class NotificationStore:
    """
    Manages notifications and per-user preferences entirely in memory.

    Data structures
    ---------------
    _notifications : dict[str, dict]
        Keyed by notification id.
    _preferences   : dict[str, NotificationPreferences]
        Keyed by user_id.
    """

    def __init__(self) -> None:
        self._notifications: dict[str, dict] = {}
        self._preferences:   dict[str, NotificationPreferences] = {}

    # ── Send ─────────────────────────────────────────────────────────────

    def send_notification(self, data: NotificationCreate) -> NotificationOut:
        """
        Create and store a new notification.

        Returns the newly created ``NotificationOut`` object.
        """
        now = datetime.now(timezone.utc).isoformat()
        nid = str(uuid.uuid4())

        record = {
            "id":             nid,
            "user_id":        data.user_id,
            "type":           data.type.value,
            "title":          data.title,
            "message":        data.message,
            "reference_id":   data.reference_id,
            "reference_type": data.reference_type,
            "channel":        data.channel.value,
            "is_read":        False,
            "created_at":     now,
            "updated_at":     now,
        }

        self._notifications[nid] = record

        return NotificationOut(**record)

    # ── Query ────────────────────────────────────────────────────────────

    def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
    ) -> list[NotificationOut]:
        """
        Return all notifications for *user_id*, optionally filtered to
        unread items only.  Results are ordered newest-first.
        """
        results = [
            n for n in self._notifications.values()
            if n["user_id"] == user_id
            and (not unread_only or not n["is_read"])
        ]
        results.sort(key=lambda n: n["created_at"], reverse=True)
        return [NotificationOut(**n) for n in results]

    # ── Mark Read ────────────────────────────────────────────────────────

    def mark_read(self, notification_id: str) -> NotificationOut:
        """
        Mark a single notification as read.

        Raises ``KeyError`` if the notification does not exist.
        """
        record = self._notifications.get(notification_id)
        if record is None:
            raise KeyError(f"Notification '{notification_id}' not found")

        record["is_read"] = True
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        return NotificationOut(**record)

    def mark_all_read(self, user_id: str) -> int:
        """
        Mark every unread notification for *user_id* as read.

        Returns the number of notifications that were updated.
        """
        count = 0
        now = datetime.now(timezone.utc).isoformat()
        for record in self._notifications.values():
            if record["user_id"] == user_id and not record["is_read"]:
                record["is_read"] = True
                record["updated_at"] = now
                count += 1
        return count

    # ── Unread Count ─────────────────────────────────────────────────────

    def get_unread_count(self, user_id: str) -> int:
        """Return the number of unread notifications for *user_id*."""
        return sum(
            1 for n in self._notifications.values()
            if n["user_id"] == user_id and not n["is_read"]
        )

    # ── Preferences ──────────────────────────────────────────────────────

    def get_preferences(self, user_id: str) -> NotificationPreferences:
        """
        Return the notification preferences for *user_id*.

        If no preferences have been saved yet a default set is returned (and
        persisted for future calls).
        """
        if user_id not in self._preferences:
            self._preferences[user_id] = NotificationPreferences(user_id=user_id)
        return self._preferences[user_id]

    def update_preferences(
        self,
        user_id: str,
        prefs: dict,
    ) -> NotificationPreferences:
        """
        Partially update the notification preferences for *user_id*.

        Only keys present in *prefs* are overwritten; the rest keep their
        current (or default) values.
        """
        current = self.get_preferences(user_id)
        update_data = current.model_dump()
        update_data.update(prefs)
        update_data["user_id"] = user_id  # ensure user_id is never overwritten
        updated = NotificationPreferences(**update_data)
        self._preferences[user_id] = updated
        return updated


# ── Module-level singleton ───────────────────────────────────────────────────

notification_store = NotificationStore()


# ── Convenience Helpers ──────────────────────────────────────────────────────

def notify_question_answered(
    question_id: str,
    user_id: str,
    answer_preview: str,
) -> NotificationOut:
    """
    Send a *question_answered* notification to the user who asked the
    question.  ``answer_preview`` is a short excerpt of the answer text
    included in the notification message body.
    """
    return notification_store.send_notification(
        NotificationCreate(
            user_id        = user_id,
            type           = NotificationType.question_answered,
            title          = "Your question has been answered!",
            message        = f"Answer preview: {answer_preview}",
            reference_id   = question_id,
            reference_type = "question",
            channel        = Channel.in_app,
        )
    )


def notify_faq_updated(
    faq_id: str,
    affected_user_ids: list[str],
) -> list[NotificationOut]:
    """
    Notify every user in *affected_user_ids* that an FAQ item they
    previously interacted with has been updated.

    Returns the list of created ``NotificationOut`` objects.
    """
    notifications: list[NotificationOut] = []
    for uid in affected_user_ids:
        notif = notification_store.send_notification(
            NotificationCreate(
                user_id        = uid,
                type           = NotificationType.faq_updated,
                title          = "An FAQ you follow has been updated",
                message        = f"FAQ item '{faq_id}' has been revised.",
                reference_id   = faq_id,
                reference_type = "faq",
                channel        = Channel.in_app,
            )
        )
        notifications.append(notif)
    return notifications
