import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ok, errors, readJson } from "@/lib/api";
import { generateBotAnswer } from "@/lib/ai/ragClient";
import { FAQ } from "@/models";

export async function POST(req: NextRequest) {
  const body = await readJson<{ question?: string }>(req);
  if (!body?.question || body.question.trim().length < 5) {
    return errors.badRequest("Question must be at least 5 characters");
  }

  const question = body.question.trim();

  let answer: string;
  let sources: { title: string; snippet: string }[] = [];
  let model = "resolve-assistant";

  try {
    const ai = await generateBotAnswer({
      question_id: `resolve-${Date.now()}`,
      question_text: question,
    });
    if (ai) {
      answer = ai.answer;
      sources = (ai.sources ?? []).map((s) => ({
        title: s.title,
        snippet: s.snippet,
      }));
      model = ai.model;
    } else {
      throw new Error("AI unavailable");
    }
  } catch {
    await connectDB();
    const faqs = await FAQ.find(
      {
        isPublished: true,
        $or: [
          { question: { $regex: question.split(" ").map((w) => `(?=.*${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`).join(""), $options: "i" } },
          { answer: { $regex: question.split(" ").map((w) => `(?=.*${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`).join(""), $options: "i" } },
        ],
      },
      { question: 1, answer: 1, category: 1, _id: 0 }
    )
      .limit(5)
      .lean();

    if (faqs.length > 0) {
      answer = faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n---\n\n");
      sources = faqs.map((f: any) => ({ title: f.question, snippet: f.answer.slice(0, 150) }));
      model = "faq-fallback";
    } else {
      answer = "I couldn't find a relevant answer in the FAQ database. Try rephrasing your question or contact an admin.";
    }
  }

  return ok({ answer, sources, model });
}
