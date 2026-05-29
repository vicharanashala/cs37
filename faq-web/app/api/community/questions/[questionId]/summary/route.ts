/**
 * app/api/community/questions/[questionId]/summary/route.ts
 *
 *   GET  /api/community/questions/:questionId/summary  — get (generate if needed)
 *   POST /api/community/questions/:questionId/summary  — force regeneration
 *
 * Unlike the question detail (which regenerates in the background), these
 * endpoints generate synchronously so callers — e.g. a "Refresh summary"
 * button or an admin — get the up-to-date synthesis in the response.
 */

import type { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { ensureSummary } from "@/lib/community/service";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await ctx.params;
  const summary = await ensureSummary(questionId);
  if (summary === null)
    return ok({ summary: null, message: "No approved answers to summarize yet." });
  return ok({ summary });
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await ctx.params;
  const summary = await ensureSummary(questionId, { force: true });
  if (summary === null)
    return ok({ summary: null, message: "No approved answers to summarize yet." });
  return ok({ summary, regenerated: true });
}
