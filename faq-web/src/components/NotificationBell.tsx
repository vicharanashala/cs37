"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle, MessageSquare, ThumbsUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/community/client";
import type { AnswerDTO, QuestionDTO } from "@/lib/community/types";

interface Notification {
  id: string;
  type: "answer_approved" | "answer_rejected" | "answer_voted" | "question_answered";
  message: string;
  subtext: string;
  time: string;
  read: boolean;
  href: string;
}

function buildNotifications(questions: QuestionDTO[], answers: AnswerDTO[]): Notification[] {
  const notifications: Notification[] = [];

  answers.forEach((a) => {
    if (a.status === "approved") {
      notifications.push({
        id: "approved-" + a.id,
        type: "answer_approved",
        message: (a.questionTitle ?? "Your question").slice(0, 40) + "...",
        subtext: "Answer Approved",
        time: "Recently",
        read: false,
        href: "/community/" + a.questionId,
      });
    }
    if (a.status === "rejected") {
      notifications.push({
        id: "rejected-" + a.id,
        type: "answer_rejected",
        message: (a.questionTitle ?? "Your question").slice(0, 40) + "...",
        subtext: "Answer Needs Revision",
        time: "Recently",
        read: false,
        href: "/community/" + a.questionId,
      });
    }
    if (a.voteScore && a.voteScore > 0) {
      notifications.push({
        id: "vote-" + a.id,
        type: "answer_voted",
        message: (a.questionTitle ?? "Your answer").slice(0, 40) + "...",
        subtext: "Received " + a.voteScore + " upvote" + (a.voteScore > 1 ? "s" : ""),
        time: "Recently",
        read: false,
        href: "/community/" + a.questionId,
      });
    }
  });

  questions.forEach((q) => {
    if (q.approvedAnswerCount && q.approvedAnswerCount > 0) {
      notifications.push({
        id: "qanswered-" + q.id,
        type: "question_answered",
        message: (q.title ?? "Your question").slice(0, 40) + "...",
        subtext: "Got " + q.approvedAnswerCount + " answer" + (q.approvedAnswerCount > 1 ? "s" : ""),
        time: "Recently",
        read: false,
        href: "/community/" + q.id,
      });
    }
  });

  return notifications;
}

const iconMap: Record<Notification["type"], React.ReactElement> = {
  answer_approved: <CheckCircle size={16} className="text-success" />,
  answer_rejected: <X size={16} className="text-danger" />,
  answer_voted: <ThumbsUp size={16} className="text-accent" />,
  question_answered: <MessageSquare size={16} className="text-accent" />,
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("notif-read") || "[]");
      setReadIds(new Set(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const res = await api("/api/community/my-contributions");
        if (res.ok) {
          const notifs = buildNotifications(
            (res.questions as QuestionDTO[]) ?? [],
            (res.answers as AnswerDTO[]) ?? []
          );
          setNotifications(notifs);
        }
      } catch {}
      setLoading(false);
    })();
  }, [open]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/api/community/my-contributions");
        if (res.ok && mounted) {
          const notifs = buildNotifications(
            (res.questions as QuestionDTO[]) ?? [],
            (res.answers as AnswerDTO[]) ?? []
          );
          setNotifications(notifs);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const unread = notifications.filter((n) => !readIds.has(n.id)).length;

  function markAllRead() {
    const next = new Set([...readIds, ...notifications.map((n) => n.id)]);
    setReadIds(next);
    localStorage.setItem("notif-read", JSON.stringify([...next]));
  }

  function markRead(id: string) {
    const next = new Set([...readIds, id]);
    setReadIds(next);
    localStorage.setItem("notif-read", JSON.stringify([...next]));
  }

  return (
    <div ref={ref} className="relative">

      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-card transition-colors cursor-pointer focus:outline-none"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={18} className={unread > 0 ? "text-accent" : "text-muted"} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-background text-[10px] font-bold rounded-full flex items-center justify-center"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden"
          >

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold">Notifications</h3>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-accent hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Body */}
            <div className="max-h-80 overflow-y-auto">

              {/* Loading */}
              {loading ? (
                <div className="space-y-3 p-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-border shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-border rounded w-4/5" />
                        <div className="h-2.5 bg-border rounded w-1/2" />
                        <div className="h-2.5 bg-border rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>

              ) : notifications.length === 0 ? (

                /* Empty */
                <div className="py-12 text-center px-4">
                  <Bell size={32} className="text-muted mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium text-muted">All caught up!</p>
                  <p className="text-xs text-muted mt-1">
                    You have no new notifications
                  </p>
                </div>

              ) : (

                /* List */
                notifications.map((n) => {
                  const isRead = readIds.has(n.id);
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0",
                        !isRead && "bg-accent/5"
                      )}
                    >
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 mt-0.5">
                        {iconMap[n.type]}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-semibold leading-snug truncate",
                          !isRead ? "text-foreground" : "text-muted"
                        )}>
                          {n.message}
                        </p>
                        <p className="text-xs text-muted mt-0.5">{n.subtext}</p>
                        <p className="text-[11px] text-muted mt-0.5">{n.time}</p>
                      </div>

                      {/* Read button */}
                      {!isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 flex items-center gap-1 text-[11px] border border-border rounded-lg px-2 py-1 hover:bg-card-hover transition-colors text-muted"
                        >
                          <CheckCircle size={11} />
                          Read
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <a
              href="/community"
              className="block text-center text-xs text-accent py-3 border-t border-border hover:underline"
            >
              View All Notifications
            </a>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}