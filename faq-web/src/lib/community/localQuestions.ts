import { threadsData } from "@/data/threadsData";
import type { AnswerDTO, QuestionDTO } from "@/lib/community/types";

interface LocalCommunityState {
  questions: QuestionDTO[];
  answers: AnswerDTO[];
}

declare global {
  var _localCommunityQuestions: LocalCommunityState | undefined;
}

function toIsoish(value: string): string {
  return value.includes("T") ? value : value.replace(" ", "T");
}

function seedState(): LocalCommunityState {
  const questions: QuestionDTO[] = threadsData.map((thread) => ({
    id: thread.id,
    title: thread.question,
    body: "",
    tags: [thread.category.toLowerCase().replace(/\s+/g, "-")],
    status: thread.status === "resolved" ? "closed" : "open",
    authorStudentId: thread.originalAuthor,
    acceptedAnswerId: thread.initialAnswer ? `${thread.id}-answer` : null,
    approvedAnswerCount: thread.initialAnswer ? 1 : 0,
    viewCount: thread.views,
    voteScore: 0,
    lastActivityAt: toIsoish(thread.resolvedAt ?? thread.createdAt),
    createdAt: toIsoish(thread.createdAt),
  }));

  const answers: AnswerDTO[] = threadsData.flatMap((thread) => {
    const initial = thread.initialAnswer
      ? [
          {
            id: `${thread.id}-answer`,
            questionId: thread.id,
            body: thread.initialAnswer,
            status: "approved" as const,
            authorStudentId: thread.answeredBy,
            isMine: false,
            voteScore: 0,
            myVote: 0,
            citations: [],
            createdAt: toIsoish(thread.resolvedAt ?? thread.createdAt),
            questionTitle: thread.question,
          },
        ]
      : [];

    const replies = thread.replies.map((reply) => ({
      id: reply.id,
      questionId: thread.id,
      body: reply.content,
      status: "approved" as const,
      authorStudentId: reply.author,
      isMine: false,
      voteScore: reply.likes,
      myVote: 0,
      citations: [],
      createdAt: toIsoish(reply.timestamp),
      questionTitle: thread.question,
    }));

    return [...initial, ...replies];
  });

  return { questions, answers };
}

const state = globalThis._localCommunityQuestions ?? seedState();
globalThis._localCommunityQuestions = state;

export function listLocalQuestions(opts: {
  q?: string | null;
  tag?: string | null;
  sort?: string | null;
  limit?: number;
  page?: number;
} = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  let questions = state.questions.filter((q) =>
    ["approved", "open", "closed"].includes(q.status)
  );

  if (opts.tag) {
    questions = questions.filter((q) => q.tags.includes(opts.tag as string));
  }

  if (opts.q?.trim()) {
    const needle = opts.q.trim().toLowerCase();
    questions = questions.filter(
      (q) =>
        q.title.toLowerCase().includes(needle) ||
        q.body.toLowerCase().includes(needle) ||
        q.tags.some((tag) => tag.includes(needle))
    );
  }

  if (opts.sort === "unanswered") {
    questions = questions.filter((q) => q.approvedAnswerCount === 0);
  } else if (opts.sort === "answered") {
    questions.sort((a, b) => b.approvedAnswerCount - a.approvedAnswerCount);
  } else if (opts.sort === "trending") {
    questions.sort((a, b) => b.voteScore - a.voteScore);
  } else {
    questions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const total = questions.length;
  const start = (page - 1) * limit;
  return { questions: questions.slice(start, start + limit), total, page, limit };
}

export function createLocalQuestion(input: {
  title: string;
  body: string;
  tags: string[];
  authorStudentId: string;
}) {
  const duplicate = state.questions.find(
    (q) => q.title.toLowerCase() === input.title.toLowerCase()
  );
  if (duplicate) return { duplicate };

  const now = new Date().toISOString();
  const question: QuestionDTO = {
    id: `local-${Date.now().toString(36)}`,
    title: input.title,
    body: input.body,
    tags: input.tags,
    status: "open",
    authorStudentId: input.authorStudentId,
    acceptedAnswerId: null,
    approvedAnswerCount: 0,
    viewCount: 0,
    voteScore: 0,
    lastActivityAt: now,
    createdAt: now,
  };

  state.questions.unshift(question);
  return { question };
}

export function getLocalQuestion(questionId: string, studentId?: string | null) {
  const question = state.questions.find((q) => q.id === questionId);
  if (!question) return null;

  question.viewCount += 1;
  const answers = state.answers
    .filter((a) => a.questionId === questionId)
    .map((a) => ({ ...a, isMine: !!studentId && a.authorStudentId === studentId }));

  return { question, answers };
}

export function createLocalAnswer(input: {
  questionId: string;
  body: string;
  authorStudentId: string;
}) {
  const question = state.questions.find((q) => q.id === input.questionId);
  if (!question || !["open", "approved"].includes(question.status)) {
    return null;
  }

  const now = new Date().toISOString();
  const answer: AnswerDTO = {
    id: `local-answer-${Date.now().toString(36)}`,
    questionId: input.questionId,
    body: input.body,
    status: "pending_review",
    authorStudentId: input.authorStudentId,
    isMine: true,
    voteScore: 0,
    myVote: 0,
    citations: [],
    createdAt: now,
    questionTitle: question.title,
  };

  state.answers.unshift(answer);
  question.lastActivityAt = now;
  return answer;
}

export function getLocalContributions(studentId: string) {
  return {
    questions: state.questions.filter((q) => q.authorStudentId === studentId),
    answers: state.answers.filter((a) => a.authorStudentId === studentId),
  };
}
