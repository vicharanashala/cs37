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


──────────────────────────────────────────────────────────────────────────────
SCHEMA UNIFICATION — pending_questions as single source of truth
Branch: feat/ai-helper-bot
Date: 2026-05-31

Background
──────────
  The `pending_questions` collection in `samagama` DB (written by
  /api/ask) and the `community` collection (seeded by seedCommunity.ts)
  had diverging schemas. The `/api/community/threads` endpoint was
  reading from `pending_questions` but mapping to a `Thread` type that
  expected fields (originalAuthor, initialAnswer, replies, views) that
  did not exist in pending_questions documents. A separate
  `RAG_Project.pending_questions` DB was also in use by the admin panel.

Changes Made
────────────

1. Unified Schema — src/models/PendingQuestion.ts
   `QuestionStatus` expanded to: pending | pending_rag | approved |
   rejected_by_rag | open | resolved | rejected
   New fields added:
     authorRole       "user"      (submitter role, always "user")
     initialAnswer    string|null (admin/mentor typed answer)
     answeredBy       string|null
     answeredByRole   "admin"|"mentor"|null
     views            number      (default 0)
     replies          Reply[]     (nested reply chain, default [])
     ragValidation    IRagValidation|undefined
   Reply subdocument schema added (id, author, authorRole, content,
   timestamp, likes, status, moderation).
   Compound index added: { category: 1, createdAt: -1 } for community
   page listing.

2. /api/ask — now writes to samagama.pending_questions (was using
   RAG_Project.pending_questions). Inserts all new thread fields with
   safe defaults. On RAG validation failure exhausts retries, falls back
   to samagama.pending_questions (was RAG_Project).

3. /api/community/threads — changed collection from "community" to
   "pending_questions". Field mapping corrected:
     d.id            → String(d._id)
     d.email         → originalAuthor  (pending_questions uses email)
     d.initialAnswer → initialAnswer (stored as answer in insert;
                              admin panel also syncs initialAnswer)
     d.resolvedAt    → resolvedAt (nullable string)
     d.status        → full unified QuestionStatus enum
   Replies filtered to hide rejected before sending to client.

4. /api/community/threads/[id]/replies — collection changed from
   "community" to "pending_questions". Reply $push and arrayFilters
   updates now target pending_questions.

5. /api/admin/pending-questions — DB changed from RAG_Project to
   samagama. On resolve action, now also syncs initialAnswer,
   answeredBy, answeredByRole alongside the existing answer field.
   DB_NAME constant added for consistency.

6. rag_api.py — FastAPI RAG validation writeback now targets
   samagama.pending_questions first (primary), RAG_Project.pending_questions
   second (legacy audit). The old community_questions target was
   removed since that collection is no longer part of this flow.

7. Migration script — src/lib/db/migratePendingQuestions.ts
   One-shot script to backfill new thread fields onto all existing
   pending_questions docs in samagama:
     Phase 1: $set authorRole="user", initialAnswer=null, answeredBy=null,
              answeredByRole=null, views=0, replies=[]
     Phase 2: For docs with answer!=null && resolvedAt==null, set
              resolvedAt=$updatedAt (treat as resolved)
     Phase 3: Report orphaned docs (answer present but status=pending)
   Run: npm run db:migrate:pending-questions
   After running, set MIGRATED_PENDING_QUESTIONS=true in .env to skip
   on future deploys.

Thread type — src/lib/community/threadModel.ts
   Updated to match unified schema:
     initialAnswer   string|null (was string — now nullable)
     answeredBy      string|null (was string — now nullable)
     resolvedAt      string|null (was string — now nullable)
     status          full QuestionStatus union (was "open"|"resolved")

npm scripts added
─────────────────
   db:migrate:pending-questions  — run the migration script

Env vars
────────
   MIGRATED_PENDING_QUESTIONS  — set to "true" after migration runs to
                                 prevent accidental re-runs

Known Limitations
──────────────────
   - The RAG_Project.pending_questions collection in the RAG_Project DB
     is retained as a legacy audit log. It receives RAG writebacks but
     is not read by the Next.js app. Safe to deprecate in a future sprint.
   - The community seed data (threadsData.ts + seedCommunity.ts) is
     no longer used at runtime since the community page now reads from
     pending_questions. The seed files can be removed in a future cleanup
     sprint if desired.
- The separate CommunityQuestion/CommunityAnswer Mongoose models
      (from the pre-schema-unification era) in src/models/ are retained
      but unused by the current API routes. They should be audited and
      removed in a future cleanup sprint to avoid confusion.
    - Removed: app/community/review/page.tsx — the admin moderation queue
      page that depended on CommunityAnswer/CommunityQuestion models.
      The page is not needed in the simplified unified schema where
      pending_questions is the source of truth and RAG moderation is
      fail-open (replies left "pending" on failure, no human override queue).
    - Removed: app/api/admin/community/ entire directory — review-queue and
      answer review routes were only used by the removed review page.
    - Fixed: reply input form was nested inside the replies expand/collapse
      panel, making it inaccessible when a thread had 0 replies. Reply form
      is now a standalone footer button with inline expansion, always visible.
    - Added X icon import to community/page.tsx for the cancel button.
    - Fixed: reply route POST /api/community/threads/:id/replies returned 404
      because _id in pending_questions is MongoDB ObjectId but the route was
      querying with a plain string. Added ObjectId import and new ObjectId(id)
      wrapper on both findOneAndUpdate calls. Also fixed ThreadDoc._id type
      from string → ObjectId. The after() callback correctly captures id from
      async closure since ctx.params is awaited before the callback fires.