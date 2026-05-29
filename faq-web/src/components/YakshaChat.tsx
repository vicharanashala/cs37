"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { faqData as staticFaqData, type FAQ } from "@/data/faqData";
import Fuse from "fuse.js";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: string[];
}

function buildAnswer(
  query: string,
  fuse: Fuse<FAQ>
): { answer: string; sources: string[] } {
  const results = fuse.search(query);

  if (results.length === 0) {
    return {
      answer:
        "I couldn't find a specific answer to your question in our FAQ database. Please try rephrasing your question, or submit it through the 'Ask a Question' page and our team will respond soon.",
      sources: [],
    };
  }

  const topResults = results.slice(0, 3);
  const bestMatch = topResults[0].item;

  let answer = bestMatch.answer;

  if (topResults.length > 1) {
    answer += "\n\n---\n\n**Related:**";
    topResults.slice(1).forEach((r) => {
      answer += `\n• ${r.item.question} (FAQ ${r.item.id})`;
    });
  }

  return {
    answer,
    sources: topResults.map((r) => `FAQ ${r.item.id}: ${r.item.question}`),
  };
}

export default function YakshaChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [faqData, setFaqData] = useState<FAQ[]>(staticFaqData);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(
    () =>
      new Fuse(faqData, {
        keys: ["question", "answer", "tags"],
        threshold: 0.4,
        includeScore: true,
      }),
    [faqData]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/faqs");
        const data = await res.json();
        if (data.ok && data.faqs.length > 0) {
          setFaqData(data.faqs);
        }
      } catch {
        // Fall back to static data
      }
    };
    void load();
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI thinking delay
    setTimeout(() => {
      const { answer, sources } = buildAnswer(userMessage.content, fuse);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: answer,
        timestamp: new Date(),
        sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 800 + Math.random() * 700);
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
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[550px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
                  <Bot size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Yaksha</h3>
                  <p className="text-xs text-success flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                    Online · Answers from FAQ
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
              {messages.map((msg) => (
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
                            📄 {s}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center mt-1">
                      <User size={12} className="text-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}

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
                  handleSend();
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
                  disabled={!input.trim()}
                  className={cn(
                    "p-2.5 rounded-xl transition-all",
                    input.trim()
                      ? "bg-accent text-background hover:bg-accent-hover"
                      : "bg-card text-muted border border-border"
                  )}
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </form>
              <p className="text-center text-xs text-muted mt-2">
                Answers sourced from official FAQ · v22.1.0
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
