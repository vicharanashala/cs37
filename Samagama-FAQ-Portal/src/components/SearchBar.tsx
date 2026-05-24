"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Mic, MicOff, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
}

export default function SearchBar({ value, onChange, resultCount }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("");
        onChange(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onChange]);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <motion.div
        className={cn(
          "relative flex items-center rounded-2xl border-2 transition-all duration-300 bg-card",
          isFocused
            ? "border-accent shadow-lg shadow-accent/10"
            : "border-border hover:border-muted"
        )}
        animate={isListening ? { borderColor: ["#f59e0b", "#ef4444", "#f59e0b"] } : {}}
        transition={isListening ? { duration: 1.5, repeat: Infinity } : {}}
      >
        <Search
          size={20}
          className={cn(
            "absolute left-4 transition-colors",
            isFocused ? "text-accent" : "text-muted"
          )}
        />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search FAQs — try 'NOC deadline' or 'can I take leave'..."
          className="w-full bg-transparent py-4 pl-12 pr-24 text-sm text-foreground placeholder:text-muted focus:outline-none"
          aria-label="Search frequently asked questions"
        />

        <div className="absolute right-3 flex items-center gap-2">
          {value && (
            <button
              onClick={() => onChange("")}
              className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}

          {voiceSupported && (
            <button
              onClick={toggleVoice}
              className={cn(
                "p-2 rounded-lg transition-all",
                isListening
                  ? "bg-danger/20 text-danger animate-pulse"
                  : "hover:bg-background text-muted hover:text-foreground"
              )}
              aria-label={isListening ? "Stop listening" : "Search by voice"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
        </div>
      </motion.div>

      {/* Search hints */}
      <AnimatePresence>
        {value && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-2 flex items-center gap-2 px-4"
          >
            <Sparkles size={14} className="text-accent" />
            <span className="text-xs text-muted">
              {resultCount !== undefined
                ? `${resultCount} result${resultCount !== 1 ? "s" : ""} found`
                : "Searching..."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {isListening && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-center text-xs text-danger"
        >
          🎙️ Listening... speak your question
        </motion.p>
      )}
    </div>
  );
}
