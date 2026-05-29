/**
 * src/lib/ai/communitySummary.ts
 *
 * The "AI service" RAG summary layer
 * (QA_FEATURE.md → POST /generate-community-summary).
 *
 * Synthesizes approved answers into a balanced "consensus summary" (never an
 * "average"). For policy questions it grounds the official portion against the
 * institutional FAQ corpus and KEEPS official facts separate from student tips,
 * exactly as the doc requires.
 *
 * As with the reviewer, this is a deterministic stand-in for the PRD's LLM
 * service. The `SummaryResult` contract is what a real model would fill in.
 */

import { firstSentences, jaccard } from "@/lib/community/text";
import { retrieveOfficialSources } from "./retrieval";
import { SUMMARY_ENGINE } from "@/lib/community/constants";
import type { ICitation } from "@/models";

export interface SummaryAnswerInput {
  id: string;
  body: string;
  voteScore: number;
}

export interface SummaryInput {
  institutionId: string;
  question: { title: string; body: string; tags?: string[] };
  answers: SummaryAnswerInput[];
}

export interface SummaryResult {
  summary: string;
  officialNotes: string;
  studentTips: string[];
  uncertainties: string[];
  citations: ICitation[];
  sourceAnswerIds: string[];
  model: string;
}

const POLICY_HINT = [
  "noc", "certificate", "offer letter", "policy", "deadline", "eligibility",
  "stipend", "fee", "refund", "official", "verification", "selection",
];

function isPolicyQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return POLICY_HINT.some((k) => lower.includes(k));
}

/** Group answers whose text substantially overlaps (rough consensus clusters). */
function largestAgreementCluster(
  answers: SummaryAnswerInput[]
): SummaryAnswerInput[] {
  if (answers.length <= 1) return answers;
  let best: SummaryAnswerInput[] = [answers[0]];
  for (let i = 0; i < answers.length; i++) {
    const cluster = answers.filter(
      (a) => a.id === answers[i].id || jaccard(answers[i].body, a.body) >= 0.25
    );
    if (cluster.length > best.length) best = cluster;
  }
  return best;
}

export async function generateCommunitySummary(
  input: SummaryInput
): Promise<SummaryResult> {
  const ranked = [...input.answers].sort((a, b) => b.voteScore - a.voteScore);
  const top = ranked.slice(0, 5);
  const questionText = [input.question.title, input.question.body]
    .filter(Boolean)
    .join(" ");
  const policy = isPolicyQuestion(questionText);

  // Official grounding for policy questions.
  let citations: ICitation[] = [];
  let officialNotes = "";
  if (policy) {
    citations = await retrieveOfficialSources(questionText, 3);
    const strong = citations.filter((c) => c.score >= 0.35);
    if (strong.length > 0) {
      officialNotes =
        `According to the institutional FAQ "${strong[0].title}" ` +
        `(${strong[0].section}, updated ${strong[0].version}): ${strong[0].snippet}`;
    } else {
      officialNotes =
        "No official institutional source strongly matched this question, so " +
        "the points below reflect student experience only — verify with the " +
        "portal or support before relying on them.";
    }
  }

  // Consensus across student answers.
  const cluster = largestAgreementCluster(top);
  const agreeRatio = top.length ? cluster.length / top.length : 0;
  const lead = top[0] ? firstSentences(top[0].body, 2) : "";

  let summary: string;
  if (top.length === 0) {
    summary = "No approved community answers yet.";
  } else if (top.length === 1) {
    summary = `One approved answer so far. It says: ${lead}`;
  } else if (agreeRatio >= 0.6) {
    summary = `Most approved answers agree: ${lead}`;
  } else {
    summary = `Approved answers offer differing views. The top-voted one says: ${lead}`;
  }

  // Student tips: one concise line per top answer (deduplicated).
  const tips: string[] = [];
  for (const a of top) {
    const tip = firstSentences(a.body, 1);
    if (tip && !tips.some((t) => jaccard(t, tip) >= 0.6)) tips.push(tip);
    if (tips.length >= 4) break;
  }

  // Uncertainties.
  const uncertainties: string[] = [];
  if (top.length > 1 && agreeRatio < 0.6)
    uncertainties.push(
      "Community answers disagree — read the individual answers below before deciding."
    );
  if (policy && citations.filter((c) => c.score >= 0.35).length === 0)
    uncertainties.push(
      "This looks like a policy question but no strong official source was found; treat student answers as unofficial."
    );

  return {
    summary,
    officialNotes,
    studentTips: tips,
    uncertainties,
    citations,
    sourceAnswerIds: top.map((a) => a.id),
    model: SUMMARY_ENGINE,
  };
}
