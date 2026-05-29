Summary

  I implemented the full Community Q&A feature from QA_FEATURE.md,
   adapting its multi-service architecture (MERN + Python AI
  service + Vector DB + Redis) onto this single Next.js 16 app
  without breaking its theme or conventions. As AGENTS.md
  instructed, I read the bundled Next.js docs first and used this
  version's conventions (async route params, after()).

  How the PRD's pieces were mapped

  - Express API → Next.js Route Handlers (app/api/community/*,
  app/api/admin/community/*).
  - Python AI service → src/lib/ai/ (review + summary), also
  exposed as the documented /review-community-answer and
  /generate-community-summary endpoints. There's no LLM key in
  this project, so these are deterministic rule-based engines
  (safety / relevance / academic-integrity / policy-grounding) —
  clearly labeled and swappable for a real model behind the same
  return contracts. I did not fake LLM calls.
  - Vector DB grounding → retrieval over the existing FAQ 
  collection (the institutional corpus) via its $text index.
  Student content is never written into the FAQ corpus.
  - Async review (Redis/worker) → answer saved pending_review,
  reviewed via after() after the response; the detail page polls
  until status settles.
  - No auth exists here → identity via client-generated
  x-student-id header (mirrors the chat sessionId pattern); admin
  via x-admin-key (default dev-admin). In-memory rate limiting.

  Schema changes (new Mongoose models)

  CommunityQuestion, CommunityAnswer (with embedded review +
  citations + moderationLog), CommunityQuestionSummary,
  CommunityVote (one-per-user), CommunityReport — all with the
  indexes from the doc. Added to the src/models barrel.

  Backend

  - lib/community/: constants, identity, rate-limit, text utils
  (normalize/hash/tokenize/coverage), validation, serializers
  (enforces "never expose rejected answers"), and the
  orchestration service (review pipeline, score/stat recompute,
  summary caching with staleness).
  - lib/ai/: retrieval, reviewer, summarizer.
  - Routes: create/list questions, question detail, submit answer,
   vote, report (auto-pulls heavily-reported answers),
  my-contributions, summary get/regenerate, admin review-queue,
  admin override.

  Frontend (same dark theme / framer-motion)

  /community (search, tag filter, sort), /community/ask (with
  duplicate detection), /community/[questionId] (synthesized
  summary with official citations kept separate from student tips,
   voting, reporting, async-review status), /community/my,
  /community/review (admin queue showing the AI decision +
  citations with approve/reject/hide). Added a Community link to
  the global header.

  Verification

  ✅ tsc --noEmit, ✅ eslint (clean), ✅ next build (all API
  routes dynamic, pages static).

  Not done: a live end-to-end run — there's no MongoDB reachable
  in this environment. To exercise it: set MONGODB_URI in
  .env.local, run npm run db:seed (seeds the FAQ corpus that
  grounding uses), then npm run dev and visit /community. New env
  vars are documented in .env.local.example.

  One design note worth your call: rate limiting is in-memory,
  which is correct for a single process but won't span instances —
   fine for now, swap for Redis if you scale horizontally.