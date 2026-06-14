"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles, Lightbulb, PlusCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

const RAG_BASE = process.env.NEXT_PUBLIC_RAG_API ?? "http://localhost:8000";

interface SourceDoc {
  title: string;
  section: string;
  url: string;
  score: number;
  snippet: string;
}

interface QueryResponse {
  answer: string;
  sources: SourceDoc[];
  confidence: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: string[];
  showSubmitPrompt?: boolean;
  submittedForFaq?: boolean;
  feedback?: "up" | "down";
  confidence?: number;
}

const MIN_W = 300, MAX_W = 700, MIN_H = 400, MAX_H = 800;
const CONFIDENCE_THRESHOLD = 0.5;

function FaqSubmitPrompt({
  msgId,
  onSubmit,
}: {
  msgId: string;
  onSubmit: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-8 mt-1 rounded-xl border border-accent/30 bg-accent/5 p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={14} className="text-accent" />
        <span className="text-xs font-medium text-accent">
          Couldn&apos;t find what you needed?
        </span>
      </div>
      <p className="text-xs text-muted mb-3">
        This question could be added to the FAQ. Submit it for admin review.
      </p>
      <button
        onClick={() => onSubmit(msgId)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-medium hover:bg-accent-hover transition-colors"
      >
        <PlusCircle size={12} />
        Submit for FAQ Review
      </button>
    </motion.div>
  );
}

function FaqSubmitSuccess() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-8 mt-1 rounded-xl border border-success/30 bg-success/5 p-3"
    >
      <p className="text-xs text-success flex items-center gap-1.5">
        <Sparkles size={12} />
        Question submitted for FAQ review!
      </p>
    </motion.div>
  );
}

export default function YakshaChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm Yaksha, your FAQ assistant. Ask me anything about the Vicharanashala internship — NOC, dates, ViBe, teams, or anything else. I'll find the answer from our knowledge base.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [ragStatus, setRagStatus] = useState<"online" | "offline">("online");
  const [size, setSize] = useState({ width: 380, height: 550 });
  const lastUserQuestion = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dw = dragStart.current.x - ev.clientX; // dragging left = wider
      const dh = dragStart.current.y - ev.clientY; // dragging up   = taller
      setSize({
        width:  Math.min(MAX_W, Math.max(MIN_W, dragStart.current.w + dw)),
        height: Math.min(MAX_H, Math.max(MIN_H, dragStart.current.h + dh)),
      });
    };
    const onUp = () => {
      dragStart.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [size.width, size.height]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/faqs");
        if (!res.ok) throw new Error("FAQs fetch failed");
      } catch {
        // FAQ load failure is non-fatal — Yaksha will report the service as offline
      }
    };
    void load();
  }, []);

  const handleSend = async () => {
    const query = input.trim();
    if (!query) return;

    lastUserQuestion.current = query;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch(`${RAG_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`RAG API returned ${res.status}`);
      }

      const data: QueryResponse = await res.json();
      const confidence = data.confidence ?? 1.0;
      const showSubmitPrompt = confidence < CONFIDENCE_THRESHOLD;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
        sources: data.sources.map(
          (s) => `${s.title} (${s.section})`
        ),
        showSubmitPrompt,
        confidence,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setRagStatus("online");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "Yaksha is taking too long to respond. Please try again or submit your question through the 'Ask a Question' page.",
            timestamp: new Date(),
            sources: [],
          },
        ]);
      } else {
        console.error("[YakshaChat] RAG /query error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "Yaksha is currently unavailable. Please try again in a moment, or visit the 'Ask a Question' page to submit your query.",
            timestamp: new Date(),
            sources: [],
          },
        ]);
        setRagStatus("offline");
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmitForFaq = async (msgId: string) => {
    try {
      const res = await fetch("/api/chat-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: lastUserQuestion.current }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, showSubmitPrompt: false, submittedForFaq: true } : m
          )
        );
      }
    } catch {
      console.error("[YakshaChat] Failed to submit question for FAQ review");
    }
  };

  const handleFeedback = async (msgId: string, type: "up" | "down") => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;
    const assistantMsg = messages[msgIndex];
    // Find the preceding user message to capture the exact question
    const userMsg = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === "user");
    if (!userMsg) return;

    // Update UI state immediately
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: type } : m))
    );

    try {
      await fetch("/api/chat-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMsg.content,
          answer: assistantMsg.content,
          feedback: type,
          sources: assistantMsg.sources || [],
          confidence: assistantMsg.confidence || 0.0,
        }),
      });
    } catch (err) {
      console.error("[YakshaChat] Failed to submit feedback:", err);
    }
  };

  const renderMsgExtra = (msg: Message): ReactNode => {
    if (msg.role !== "assistant") return null;
    if (msg.submittedForFaq) return <FaqSubmitSuccess />;
    if (msg.showSubmitPrompt) return <FaqSubmitPrompt msgId={msg.id} onSubmit={handleSubmitForFaq} />;
    return null;
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-accent hover:bg-accent-hover text-background px-5 py-3 rounded-full shadow-xl shadow-accent/25 transition-colors"
            aria-label="Open Yaksha chat"
          >
            <MessageCircle size={20} />
            <span className="text-sm font-semibold">Ask Yaksha</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2 }}
            style={{ width: Math.min(size.width, window.innerWidth - 48), height: Math.min(size.height, window.innerHeight - 96) }}
            className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
          >
            {/* Resize handle — drag from top-left corner */}
            <div
              onMouseDown={onResizeMouseDown}
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 group"
              title="Drag to resize"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="absolute top-1 left-1 text-muted/40 group-hover:text-accent transition-colors">
                <path d="M0 8 L8 0 M0 4 L4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
                  <Bot size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Yaksha</h3>
                  <p className="text-xs flex items-center gap-1">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full inline-block",
                        ragStatus === "online" ? "bg-success" : "bg-danger"
                      )}
                    />
                    <span className={ragStatus === "online" ? "text-success" : "text-danger"}>
                      {ragStatus === "online" ? "Online" : "Offline"}
                    </span>
                    <span className="text-muted"> · RAG-powered</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => {
                const extra = renderMsgExtra(msg);
                return (
                  <>
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-2",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="shrink-0 w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mt-1">
                          <Sparkles size={12} className="text-accent" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-accent text-background rounded-br-md"
                            : "bg-card border border-border rounded-bl-md"
                        )}
                      >
                        <p className="whitespace-pre-line">{msg.content}</p>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs text-muted mb-1">Sources:</p>
                            {msg.sources.map((s, i) => (
                              <p key={i} className="text-xs text-muted/70">
                                {s}
                              </p>
                            ))}
                          </div>
                        )}
                        {msg.role === "assistant" && msg.id !== "welcome" && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20 justify-end text-muted-foreground">
                            <button
                              onClick={() => handleFeedback(msg.id, "up")}
                              disabled={msg.feedback !== undefined}
                              className={cn(
                                "p-1 rounded hover:bg-accent/10 transition-colors",
                                msg.feedback === "up" && "text-success bg-success/15 hover:bg-success/20"
                              )}
                              title="Helpful"
                            >
                              <ThumbsUp size={14} className={msg.feedback === "up" ? "fill-success" : ""} />
                            </button>
                            <button
                              onClick={() => handleFeedback(msg.id, "down")}
                              disabled={msg.feedback !== undefined}
                              className={cn(
                                "p-1 rounded hover:bg-accent/10 transition-colors",
                                msg.feedback === "down" && "text-danger bg-danger/15 hover:bg-danger/20"
                              )}
                              title="Not helpful"
                            >
                              <ThumbsDown size={14} className={msg.feedback === "down" ? "fill-danger" : ""} />
                            </button>
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="shrink-0 w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center mt-1">
                          <User size={12} className="text-foreground" />
                        </div>
                      )}
                    </motion.div>
                    {extra}
                  </>
                );
              })}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2 items-start"
                >
                  <div className="shrink-0 w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                    <Sparkles size={12} className="text-accent" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about NOC, dates, ViBe..."
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                  aria-label="Type your question"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className={cn(
                    "p-2.5 rounded-xl transition-all",
                    input.trim() && !isTyping
                      ? "bg-accent text-background hover:bg-accent-hover"
                      : "bg-card text-muted border border-border cursor-not-allowed"
                  )}
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </form>
              <p className="text-center text-xs text-muted mt-2">
                Powered by RAG · Vicharanashala FAQ
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}