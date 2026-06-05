"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { PlusCircle, Loader2 } from "lucide-react";
import type { Category } from "@/data/faqData";

export default function ManualFAQForm() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/faqs");
        const data = await res.json();
        if (data.ok) {
          setCategories(data.categories ?? []);
        } else {
          toast.error("Failed to load categories for select menu");
        }
      } catch (err) {
        toast.error("Network error loading categories");
      } finally {
        setLoadingCats(false);
      }
    };
    void fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim() || !category) {
      toast.error("Please fill in all required fields (Question, Answer, and Category)");
      return;
    }

    setSubmitting(true);
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    try {
      const res = await fetch("/api/admin/faqs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": localStorage.getItem("samagama_admin_key") ?? "dev-admin",
        },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          category,
          tags,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success("Manual FAQ entry created successfully!");
        setQuestion("");
        setAnswer("");
        setCategory("");
        setTagsInput("");
      } else {
        toast.error(data.error?.message ?? "Failed to create manual FAQ");
      }
    } catch (err) {
      toast.error("Network error: failed to submit manual FAQ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 shadow-md"
    >
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
        <PlusCircle className="text-accent" size={20} />
        <h2 className="text-lg font-bold">Create Manual FAQ</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground/95">
            Question <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Can I use a mobile phone for the test?"
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
            disabled={submitting}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground/95">
            Answer <span className="text-danger">*</span>
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type the detailed answer here..."
            rows={5}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-muted"
            disabled={submitting}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground/95">
              Category <span className="text-danger">*</span>
            </label>
            {loadingCats ? (
              <div className="flex items-center gap-2 text-xs text-muted py-3">
                <Loader2 size={14} className="animate-spin text-accent" />
                <span>Loading categories...</span>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
                disabled={submitting}
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground/95">
              Tags <span className="text-xs text-muted">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. vibe, proctoring, test"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !question.trim() || !answer.trim() || !category}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all bg-accent text-background hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <PlusCircle size={16} />
                <span>Create FAQ Entry</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
