/**
 * src/lib/ai/communityReview.ts
 *
 * The "AI service" review layer (QA_FEATURE.md → POST /review-community-answer).
 *
 * Because this deployment has no LLM/Python service wired up, the review is a
 * deterministic, rule-based engine that implements the SAME contract the doc
 * specifies. It performs, in order:
 *
 *   1. safety / abuse moderation
 *   2. spam detection
 *   3. relevance (question ↔ answer)
 *   4. question classification (policy / academic / social / general)
 *   5. academic-integrity check
 *   6. institutional grounding for policy questions (via retrieval.ts)
 *   7. a structured decision: approve | reject | needs_admin_review
 *
 * To plug in a real model later, replace `reviewCommunityAnswer()` with a call
 * to your Python service and keep the `ReviewResult` shape. Everything
 * downstream (the service + DB) depends only on this shape.
 */

import { coverage, jaccard, tokenize } from "@/lib/community/text";
import { retrieveOfficialSources } from "./retrieval";
import { REVIEW_ENGINE, type ReviewDecision } from "@/lib/community/constants";
import type { ICitation } from "@/models";

export interface ReviewInput {
  institutionId: string;
  question: { title: string; body: string; tags?: string[] };
  answer: string;
  studentContext?: { role: string };
}

export interface ReviewResult {
  decision: ReviewDecision;
  relevanceScore: number;
  safetyAllowed: boolean;
  policyGrounded: boolean;
  academicIntegrityAllowed: boolean;
  /** policy | academic_help | social | general */
  classification: string;
  reasons: string[];
  citations: ICitation[];
  model: string;
}

// ── Lexicons ──────────────────────────────────────────────────────────────────

const ABUSIVE = [
  "idiot", "stupid", "shut up", "moron", "loser", "dumb", "trash",
  "useless", "hate you", "kill yourself", "f***", "fuck", "shit", "bastard",
  "asshole", "bitch",
];

/** Phrases that suggest an answer enables cheating / academic dishonesty. */
const INTEGRITY_RED_FLAGS = [
  "exam answer", "answer key", "leak", "leaked", "question paper",
  "proxy attendance", "mark proxy", "do your assignment for you",
  "i'll write your", "buy the certificate", "fake noc", "forge",
  "bypass proctor", "cheat", "share the solved", "paid solution",
  "contract cheating",
];

/** Keywords that mark a question as touching official institutional policy. */
const POLICY_KEYWORDS = [
  "noc", "certificate", "offer letter", "policy", "deadline", "eligibility",
  "stipend", "fee", "refund", "rules", "official", "verification", "selection",
  "internship duration", "attendance", "exam", "evaluation", "rosetta",
  "vibe", "team formation", "code of conduct", "plagiarism",
];

const ACADEMIC_KEYWORDS = [
  "prepare", "study", "learn", "practice", "tips", "concept", "understand",
  "resource", "tutorial", "how to solve", "approach",
];

function containsAny(haystack: string, needles: string[]): string[] {
  const lower = haystack.toLowerCase();
  return needles.filter((n) => lower.includes(n));
}

// ── Sub-checks ──────────────────────────────────────────────────────────────

function checkSafety(answer: string): { allowed: boolean; reasons: string[] } {
  const hits = containsAny(answer, ABUSIVE);
  return hits.length > 0
    ? { allowed: false, reasons: ["abusive_or_unsafe_language"] }
    : { allowed: true, reasons: [] };
}

function checkSpam(answer: string): boolean {
  const urls = (answer.match(/https?:\/\//gi) ?? []).length;
  const repeated = /(.)\1{6,}/.test(answer); // "aaaaaaa"
  const tokens = tokenize(answer);
  const lowContent = tokens.length < 3;
  return urls >= 3 || repeated || lowContent;
}

function classify(questionText: string): string {
  const policyHits = containsAny(questionText, POLICY_KEYWORDS).length;
  const academicHits = containsAny(questionText, ACADEMIC_KEYWORDS).length;
  if (policyHits > 0) return "policy";
  if (academicHits > 0) return "academic_help";
  return "general";
}

function checkIntegrity(answer: string): {
  allowed: boolean;
  reasons: string[];
} {
  const hits = containsAny(answer, INTEGRITY_RED_FLAGS);
  return hits.length > 0
    ? { allowed: false, reasons: ["academic_integrity_violation"] }
    : { allowed: true, reasons: [] };
}

/**
 * Decide whether a policy answer is supported / contradicted / not-verifiable
 * by the retrieved official sources.
 */
function groundPolicy(
  answer: string,
  citations: ICitation[]
): { grounded: boolean; verifiable: boolean; reasons: string[] } {
  const strong = citations.filter((c) => c.score >= 0.4);
  if (strong.length === 0) {
    return {
      grounded: false,
      verifiable: false,
      reasons: ["no_strong_official_source"],
    };
  }
  // Does the answer actually align with the source text?
  const bestOverlap = Math.max(
    ...strong.map((c) => jaccard(answer, `${c.title} ${c.snippet}`))
  );
  if (bestOverlap >= 0.12) {
    return {
      grounded: true,
      verifiable: true,
      reasons: ["supported_by_source"],
    };
  }
  return {
    grounded: false,
    verifiable: false,
    reasons: ["not_clearly_supported_by_source"],
  };
}

// ── Main entry ──────────────────────────────────────────────────────────────

export async function reviewCommunityAnswer(
  input: ReviewInput
): Promise<ReviewResult> {
  const questionText = [
    input.question.title,
    input.question.body,
    ...(input.question.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const reasons: string[] = [];

  // 1+2. safety & spam
  const safety = checkSafety(input.answer);
  const isSpam = checkSpam(input.answer);

  // 3. relevance
  const relevanceScore = Number(
    Math.max(coverage(questionText, input.answer), jaccard(questionText, input.answer)).toFixed(2)
  );

  // 4. classification
  const classification = classify(questionText);

  // 5. academic integrity
  const integrity = checkIntegrity(input.answer);

  // 6. grounding (only for policy questions)
  let citations: ICitation[] = [];
  let policyGrounded = true; // non-policy answers are trivially "grounded"
  let verifiable = true;
  if (classification === "policy") {
    citations = await retrieveOfficialSources(questionText, 4);
    const g = groundPolicy(input.answer, citations);
    policyGrounded = g.grounded;
    verifiable = g.verifiable;
    reasons.push(...g.reasons);
  }

  // 7. decision
  reasons.push(...safety.reasons, ...integrity.reasons);
  let decision: ReviewDecision;

  if (!safety.allowed || isSpam) {
    decision = "reject";
    if (isSpam) reasons.push("detected_as_spam");
  } else if (!integrity.allowed) {
    decision = "reject";
  } else if (relevanceScore < 0.08) {
    decision = "reject";
    reasons.push("answer_unrelated_to_question");
  } else if (classification === "policy" && !policyGrounded) {
    // Policy claim we couldn't verify → humans decide (never auto-reject useful
    // but unverifiable policy info, never auto-approve it either).
    decision = "needs_admin_review";
    reasons.push(
      verifiable ? "sensitive_policy_claim" : "policy_claim_not_verifiable"
    );
  } else if (relevanceScore < 0.18) {
    decision = "needs_admin_review";
    reasons.push("low_relevance_confidence");
  } else {
    decision = "approve";
    reasons.push("answer_directly_addresses_question");
    if (classification === "policy") reasons.push("no_policy_conflict");
  }

  return {
    decision,
    relevanceScore,
    safetyAllowed: safety.allowed && !isSpam,
    policyGrounded,
    academicIntegrityAllowed: integrity.allowed,
    classification,
    reasons: Array.from(new Set(reasons)),
    citations: decision === "reject" ? [] : citations,
    model: REVIEW_ENGINE,
  };
}
