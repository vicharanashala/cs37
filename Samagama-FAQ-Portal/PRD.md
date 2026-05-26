# AI-Powered FAQ & Personal Student Assistant Platform

## Foundational Architecture & Implementation Specification

**Version 2.0** · Stack: **MERN + polyglot AI service** · Status: Implementation-ready

> **Purpose of this document.** This is the single source of truth for building the platform. It is written to be consumed by **agentic coding systems** (Claude Code, Cursor, Windsurf, Codex, etc.) as well as human developers. Every architectural decision is explicit, every service boundary is named, and the build is broken into **atomic stages** — each stage is one feature or one process, with its own location, dependencies, contracts, and acceptance criteria, so it can be implemented and verified in isolation.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision (3 Stages of Maturity)](#3-product-vision)
4. [Guiding Engineering Principles](#4-guiding-engineering-principles)
5. [Technology Stack & Decisions](#5-technology-stack--decisions)
6. [System Architecture](#6-system-architecture)
7. [Repository & Project Structure](#7-repository--project-structure)
8. [Data Model (MongoDB)](#8-data-model-mongodb)
9. [Inter-Service Contracts](#9-inter-service-contracts)
10. [Public API Surface](#10-public-api-surface)
11. [RAG Subsystem (Detailed)](#11-rag-subsystem-detailed)
12. [Memory Architecture](#12-memory-architecture)
13. [AI Orchestration Layer](#13-ai-orchestration-layer)
14. [Safety & Moderation Layer](#14-safety--moderation-layer)
15. [Observability & Evaluation](#15-observability--evaluation)
16. [Security, Auth & Multi-Tenancy](#16-security-auth--multi-tenancy)
17. [Environment & Configuration](#17-environment--configuration)
18. [Implementation Roadmap — Atomic Stages](#18-implementation-roadmap--atomic-stages)
19. [Success Criteria & Acceptance Gates](#19-success-criteria--acceptance-gates)
20. [Glossary](#20-glossary)

---

# 1. Executive Summary

The platform is an AI-powered educational assistant with two primary capabilities, evolving toward a third:

1. **Institutional FAQ System** — answers questions about policies, admissions, fees, exams, assignments, deadlines, courses, certifications, and platform usage, grounded in institutional documents with **mandatory citations**.
2. **Personal Student AI Assistant** — understands individual student context (program, semester, grades, weak areas), provides personalized learning support, generates study plans, explains concepts, and helps students navigate academic challenges.
3. **(Future) Institutional AI Agent** — performs actions on the student's behalf (register for a workshop, book an appointment, create a support ticket) through governed, auditable tools.

The system combines: **Knowledge Retrieval (RAG)** · **Conversational AI** · **Student Context Awareness** · **Learning Analytics** · **Safety & Moderation** · **Administrative Knowledge Management**.

The goal is not "a chatbot" but **intelligent educational infrastructure** — a core, traceable, governable component of the institution's learning ecosystem.

---

# 2. Problem Statement

Educational institutions accumulate thousands of pieces of information — policies, regulations, course materials, lecture notes, FAQs, announcements, assignments, degree requirements — and students repeatedly ask the same questions: *How do I register? What happens if I miss an exam? Where are the lecture notes? How do I improve in statistics? Which course should I take next?*

Traditional support fails because of **delayed responses, repeated tickets, human workload, outdated documentation, and poor discoverability.**

The system solves this with **instant, cited, personalized, 24/7, context-aware** answers — and a path to taking action, not just answering.

---

# 3. Product Vision

The platform matures through three stages. Each maps to delivery phases in §18.

### Stage 1 — FAQ Assistant (grounded answers)
> **Student:** "What is the withdrawal policy?"
> **System:** Embeds the query → retrieves relevant policy chunks from the vector store → generates an answer → **returns it with citations** (document, section, version, paragraph).

### Stage 2 — Personalized Academic Assistant (student-aware guidance)
> **Student:** "I failed Probability and Statistics."
> **System:** Loads the student's profile and history → identifies weak areas → generates a recovery/study plan → recommends specific resources → remembers this across sessions.

### Stage 3 — Institutional AI Agent (governed action)
> **Student:** "Register me for the data-viz workshop."
> **System:** Validates eligibility → calls the registration tool → returns a confirmation → logs the action for audit.

---

# 4. Guiding Engineering Principles

These principles are binding on every stage. An agentic IDE should treat a violation as a defect.

1. **Maximal separation of concerns.** Each capability is its own service/package with a single responsibility, its own folder, its own tests, its own env, and a documented contract. A failing feature must be isolable to one service. No cross-service imports of internal code — services talk only over HTTP/queues using the contracts in §9.
2. **MERN is the spine.** MongoDB + Express + React + Node form the product backbone (auth, business logic, conversations, profiles, APIs, UI). The **only** approved escape hatch is the AI/RAG workload, which runs as a separate **Python (FastAPI)** service because the embedding/LLM/vector ecosystem is strongest there. This boundary is deliberate and fixed.
3. **Contracts before code.** Every inter-service interaction is defined as a typed contract (§9) before the implementation that consumes it. Contracts live in a shared package.
4. **Grounded or silent.** The FAQ assistant never answers institutional questions without retrieved evidence. If retrieval confidence is low, it says so and cites what it has — it does not hallucinate.
5. **Everything is observable.** Every LLM call, retrieval, and tool invocation is traced (Langfuse) with prompt, chunks, cost, and latency. "We can't see what happened" is not acceptable.
6. **Safety is not optional.** Input and output pass through moderation before reaching the user. Academic-integrity guardrails are first-class.
7. **Stateless services, stateful stores.** Services hold no session state in memory; state lives in MongoDB (durable) and Redis (ephemeral). Any instance can serve any request.
8. **Config over hardcoding.** Models, thresholds, chunk sizes, and provider keys come from environment/config, never literals in code.
9. **Idempotent ingestion.** Re-uploading or re-processing a document must not create duplicate vectors; it versions and replaces.

---

# 5. Technology Stack & Decisions

### 5.1 The MERN spine

| Layer | Technology | Responsibility |
|---|---|---|
| **Frontend (student)** | **React 18 + Vite** + TypeScript + Tailwind CSS + shadcn/ui | Chat UI, auth, profile, study plans |
| **Frontend (admin)** | **React 18 + Vite** + TypeScript + Tailwind + shadcn/ui | Document upload, knowledge mgmt, analytics |
| **API / business core** | **Node.js 20 + Express + TypeScript** | Auth, routing, chat orchestration, profiles, memory, safety orchestration, agent tools |
| **Primary database** | **MongoDB 7 + Mongoose** | Users, students, courses, enrollments, grades, conversations, messages, memories, document metadata, analytics events, audit log |

> **Why React + Vite, not Next.js?** The product is an **authenticated SPA** (chat, dashboards) where SEO and server rendering add little, and a plain SPA keeps the frontend cleanly separated from the API (your separation requirement). Streaming chat is handled via SSE/`fetch` streaming, which works fine in a SPA. *Next.js is documented as an optional drop-in alternative in §7 for teams that want SSR.*

### 5.2 The polyglot feature services (allowed "on top of" MERN)

| Service | Technology | Responsibility | Why not Node |
|---|---|---|---|
| **AI/RAG service** | **Python 3.11 + FastAPI** | Document parsing, chunking, embeddings, vector ops, retrieval + reranking, LLM provider adapters | Python owns the embedding/LLM/vector tooling (LangChain, unstructured, rerankers, provider SDKs) |
| **Ingestion worker** | **Python 3.11** worker consuming a Redis queue | Async parse → chunk → embed → upsert pipeline | Same ecosystem as RAG; keeps heavy jobs off the request path |

### 5.3 Supporting infrastructure

| Concern | Technology | Notes |
|---|---|---|
| **Vector database** | **Qdrant** | Collection per tenant/type; payload metadata for citation + filtering |
| **Cache / short-term memory / queue** | **Redis 7** | Conversation context window, session cache, rate limits, hot-query cache, ingestion job queue |
| **Object storage** | **MinIO** (S3-compatible) locally; S3 in prod | Raw uploaded documents |
| **LLM providers** | **Gemini · OpenAI (GPT) · Anthropic (Claude)** behind one adapter interface | Claude for document understanding, GPT for reasoning, Gemini for cost; runtime-swappable |
| **Embeddings** | Provider embedding model (config-driven), e.g. OpenAI `text-embedding-3-large` or Gemini embeddings | Single configured model; dimension stored with the collection |
| **Observability** | **Langfuse** | Traces every prompt, retrieval, response, cost, latency |
| **Auth** | JWT (access + refresh) issued by the Node API | Roles: `student`, `admin`, `super_admin` |
| **Containerization** | Docker + docker-compose (dev) → Kubernetes (prod) | Each service has its own Dockerfile |
| **Monorepo tooling** | pnpm workspaces (JS) + uv/poetry (Python) + Turborepo (task graph) | One repo, many independently runnable services |

### 5.4 Decision log (binding)

- **MongoDB replaces PostgreSQL** from v1.0 of this doc. Relational-looking entities (courses, enrollments, grades) are modeled as collections with references; aggregation pipelines cover analytics.
- **AI/RAG is the only non-Node service.** No other language sneaks in.
- **Qdrant remains** the vector store (best-fit, self-hostable, rich payload filtering).
- **Streaming** uses **Server-Sent Events (SSE)** from the Node API to the React client.

---

# 6. System Architecture

```text
                         ┌──────────────────────┐        ┌──────────────────────┐
                         │  apps/web (React SPA) │        │ apps/admin (React SPA)│
                         │  Student chat & study │        │ Upload · KM · analytics│
                         └──────────┬───────────┘        └───────────┬──────────┘
                                    │  HTTPS (REST + SSE)             │
                                    └───────────────┬─────────────────┘
                                                    ▼
                                   ┌─────────────────────────────────┐
                                   │   services/api  (Node + Express) │
                                   │  Auth · Routing · Orchestration  │
                                   │  Intent · Memory · Safety · Tools│
                                   └───┬──────────┬──────────┬────────┘
                  ┌────────────────────┘          │          └───────────────────┐
                  ▼                                ▼                              ▼
        ┌──────────────────┐          ┌────────────────────────┐       ┌──────────────────┐
        │   MongoDB         │          │ services/ai (FastAPI)  │       │   Redis           │
        │ users, students,  │          │  Retrieve · Rerank ·   │       │ ctx window, cache,│
        │ convos, memories, │          │  LLM adapters · Embed  │       │ rate limits, queue│
        │ docs meta, audit  │          └───────┬────────┬───────┘       └─────────┬────────┘
        └──────────────────┘                   │        │                         │
                                               ▼        ▼                         │
                                     ┌──────────────┐ ┌──────────────┐            │
                                     │   Qdrant     │ │ LLM Providers │            │
                                     │ vector store │ │ Gemini/GPT/   │            │
                                     └──────▲───────┘ │ Claude        │            │
                                            │         └──────────────┘            │
                                  ┌─────────┴───────────┐                          │
                                  │ services/ingestion  │◄─────────────────────────┘
                                  │ (Python worker)     │   consumes ingest jobs
                                  │ parse·chunk·embed   │
                                  └─────────┬───────────┘
                                            ▼
                                     ┌──────────────┐
                                     │  MinIO / S3  │  raw documents
                                     └──────────────┘

        Cross-cutting:  Langfuse (tracing)  ·  JWT auth  ·  structured logging  ·  health checks
```

**Request flow (FAQ):** `web` → `POST /api/chat` (Node) → moderation → intent = FAQ → Node calls `services/ai /retrieve` (returns top-k chunks + scores) → Node builds prompt → Node calls `services/ai /generate` (or `/chat` streaming) → output moderation → SSE stream back to `web` with citations → persist message + analytics event + Langfuse trace.

**Ingestion flow:** `admin` → `POST /api/documents` (Node stores file in MinIO, writes `documents` doc, enqueues job in Redis) → `services/ingestion` worker pops job → parse → chunk → embed → upsert to Qdrant → updates `documents.status` and `chunks` count.

---

# 7. Repository & Project Structure

A single monorepo, **every service independently runnable and debuggable**. Internal code is never imported across service boundaries — only the `packages/contracts` types are shared.

```text
edu-ai/
├── apps/
│   ├── web/                      # React + Vite student SPA
│   │   ├── src/{features,components,lib,routes,hooks,store}/
│   │   └── Dockerfile
│   └── admin/                    # React + Vite admin SPA
│       ├── src/{features,components,lib,routes}/
│       └── Dockerfile
│
├── services/
│   ├── api/                      # Node + Express (the MERN backend)
│   │   ├── src/
│   │   │   ├── modules/          # one folder per domain (separation!)
│   │   │   │   ├── auth/         # controllers, services, routes, models
│   │   │   │   ├── users/
│   │   │   │   ├── students/
│   │   │   │   ├── documents/    # upload + enqueue ingestion
│   │   │   │   ├── chat/         # orchestration entrypoint
│   │   │   │   ├── intent/       # intent classification
│   │   │   │   ├── memory/       # short + long term memory
│   │   │   │   ├── safety/       # moderation orchestration
│   │   │   │   ├── analytics/
│   │   │   │   ├── knowledge/    # admin KM (versions, re-embed, delete)
│   │   │   │   └── agent/        # Stage 3 tools + agent loop
│   │   │   ├── infra/            # db, redis, qdrant-client, ai-client, langfuse
│   │   │   ├── middleware/       # auth, rbac, rate-limit, error, validation
│   │   │   └── app.ts
│   │   └── Dockerfile
│   │
│   ├── ai/                       # Python + FastAPI (RAG + LLM)
│   │   ├── app/
│   │   │   ├── routers/          # /retrieve, /generate, /chat, /embed, /moderate
│   │   │   ├── rag/              # retrieval, reranking, hybrid search
│   │   │   ├── llm/              # adapters: gemini.py, openai.py, anthropic.py + base
│   │   │   ├── prompts/          # versioned prompt templates
│   │   │   └── main.py
│   │   └── Dockerfile
│   │
│   └── ingestion/                # Python worker (async pipeline)
│       ├── app/
│       │   ├── parsers/          # pdf, docx, markdown, html, web
│       │   ├── chunking/         # strategy implementations
│       │   ├── embed/            # embedding client
│       │   ├── worker.py         # Redis queue consumer
│       └── Dockerfile
│
├── packages/
│   ├── contracts/                # TS types + JSON Schemas for all inter-service APIs
│   ├── ui/                       # shared shadcn/ui components & theme
│   ├── config/                   # shared config loaders, zod env schemas
│   └── logger/                   # structured logging helpers
│
├── infrastructure/
│   ├── docker/                   # docker-compose.yml (mongo, redis, qdrant, minio, langfuse)
│   ├── kubernetes/               # manifests / helm
│   └── terraform/                # cloud provisioning
│
├── docs/                         # ADRs, runbooks, this PRD
├── evals/                        # golden Q&A sets + eval harness (RAG quality)
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

> **Optional SSR variant:** to use Next.js for `apps/web`, swap the Vite app for a Next app and keep `services/api` unchanged — the API stays a separate origin, preserving separation. Document the choice in an ADR under `docs/`.

---

# 8. Data Model (MongoDB)

Collections (Mongoose schemas). `institutionId` is present on every document for **multi-tenancy** from day one. All timestamps via `{ timestamps: true }`.

```text
users
  _id, institutionId, email (unique), passwordHash, role[student|admin|super_admin],
  name, isActive, lastLoginAt

students                       # 1:1 with a user of role=student
  _id, userId(ref users), institutionId, program, semester, cgpa,
  enrolledCourseIds[ref courses], weakSubjects[String],
  learningPreferences{ pace, style, goals[String] }

courses
  _id, institutionId, code, title, description, credits, prerequisites[ref courses]

enrollments
  _id, studentId(ref students), courseId(ref courses), term, status

grades
  _id, studentId(ref students), courseId(ref courses), term, score, grade, isPassing

conversations
  _id, studentId(ref students), institutionId, title, lastMessageAt

messages
  _id, conversationId(ref conversations), role[user|assistant|system],
  content, intent, citations[{documentId, title, section, version, snippet, score}],
  modelUsed, tokensIn, tokensOut, latencyMs, traceId, feedback[up|down|null]

memories                       # long-term student facts
  _id, studentId(ref students), type[goal|weak_area|preference|achievement|fact],
  content, source[derived|explicit], confidence, lastReinforcedAt

documents
  _id, institutionId, title, sourceType[pdf|docx|markdown|html|web],
  storageKey, version, status[uploaded|parsing|chunking|embedding|ready|failed],
  chunkCount, error, uploadedBy(ref users)
  # NOTE: chunk VECTORS live in Qdrant, not Mongo. Mongo stores doc-level metadata only.

analyticsEvents
  _id, institutionId, type[query|answer|feedback|retrieval|tool_call|moderation_block],
  studentId, conversationId, payload{...}, latencyMs, cost, createdAt

auditLog                       # Stage 3 + admin actions
  _id, institutionId, actorId, action, target, before, after, ip, createdAt
```

**Indexes (required):** `users.email` (unique), `{institutionId}` on every collection, `messages.conversationId`, `memories.studentId+type`, `documents.status`, `analyticsEvents.{type,createdAt}`.

---

# 9. Inter-Service Contracts

Defined in `packages/contracts`. The Node API is the only caller of the AI service; the ingestion worker is the only writer of vectors (besides re-embed jobs).

### 9.1 Node API → AI service: `POST /retrieve`
```jsonc
// request
{ "institutionId": "inst_1", "query": "withdrawal policy", "topK": 10,
  "filters": { "documentIds": [], "minVersion": null }, "hybrid": true }
// response
{ "chunks": [
    { "chunkId": "c_1", "documentId": "policy_2026", "title": "Academic Policy v2026",
      "section": "4.2 Examination Rules", "version": "2026",
      "text": "...", "score": 0.83 }
  ], "retrievalMs": 42 }
```

### 9.2 Node API → AI service: `POST /generate` (and `POST /chat` for SSE)
```jsonc
// request
{ "provider": "claude", "system": "<system instructions>",
  "messages": [{ "role": "user", "content": "..." }],
  "context": [ /* chunks from /retrieve */ ],
  "stream": true, "traceId": "tr_123", "maxTokens": 1024 }
// response (non-stream)
{ "content": "...", "citationsUsed": ["c_1","c_4"],
  "tokensIn": 812, "tokensOut": 240, "latencyMs": 1900, "provider": "claude" }
// stream: SSE events `token`, `citations`, `done`
```

### 9.3 Node API → AI service: `POST /moderate`
```jsonc
{ "text": "...", "stage": "input|output" }
// -> { "allowed": true, "categories": [], "action": "allow|block|safe_complete" }
```

### 9.4 Node API → AI service: `POST /embed` (used for query-time only; bulk embedding is the worker's job)
```jsonc
{ "texts": ["..."] } // -> { "vectors": [[...]], "model": "...", "dim": 3072 }
```

### 9.5 Node API → Ingestion worker: Redis job
```jsonc
// queue: "ingest"
{ "jobId": "j_1", "documentId": "doc_1", "institutionId": "inst_1",
  "storageKey": "raw/doc_1.pdf", "sourceType": "pdf", "version": "2026",
  "action": "ingest|reembed|delete" }
```

---

# 10. Public API Surface

Exposed by `services/api` (Express). All under `/api`, all (except auth) require a JWT.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create student account |
| POST | `/api/auth/login` | public | Issue access + refresh tokens |
| POST | `/api/auth/refresh` | public | Rotate tokens |
| GET | `/api/me` | any | Current user + profile |
| POST | `/api/chat` | student | Send message, stream answer (SSE) |
| GET | `/api/conversations` | student | List conversations |
| GET | `/api/conversations/:id/messages` | student | Message history |
| POST | `/api/messages/:id/feedback` | student | Thumbs up/down |
| GET/PUT | `/api/students/me/profile` | student | Read/update profile |
| POST | `/api/study-plan` | student | Generate a study plan |
| POST | `/api/documents` | admin | Upload + enqueue ingestion |
| GET | `/api/documents` | admin | List with status/version/chunkCount |
| POST | `/api/documents/:id/reembed` | admin | Re-process |
| DELETE | `/api/documents/:id` | admin | Remove doc + vectors |
| GET | `/api/analytics/overview` | admin | Top questions, failure rate, latency, hallucination rate |
| POST | `/api/agent/actions/:tool` | student | (Stage 3) Invoke a governed tool |
| GET | `/api/health` | public | Liveness/readiness of dependencies |

---

# 11. RAG Subsystem (Detailed)

Owned by `services/ai` + `services/ingestion`.

### 11.1 Ingestion pipeline (worker)
```text
Upload (Node→MinIO + Mongo doc + Redis job)
   ↓
Parse        parsers per sourceType (pdf/docx/markdown/html/web → clean text + structure)
   ↓
Chunk        300–800 tokens, section-aware, ~15% overlap; never split mid-sentence
   ↓
Enrich       attach metadata { documentId, title, section, version, sourceType }
   ↓
Embed        configured embedding model → vectors (dim stored on collection)
   ↓
Upsert       Qdrant: idempotent by deterministic chunkId (docId+version+index)
   ↓
Finalize     update documents.status='ready', chunkCount, emit analytics event
```

**Chunking rule:** a chunk is 300–800 tokens, respects section boundaries, carries its section heading, and overlaps neighbors by ~15% so context isn't lost at edges. Re-ingesting the same `(documentId, version)` replaces existing vectors (idempotent).

### 11.2 Retrieval (query time)
```text
Query → embed → Qdrant vector search (topK≈20)
      → (optional) BM25/keyword candidates  → fuse (hybrid)
      → rerank (cross-encoder)               → top 5–8
      → return chunks + scores to Node
```
- **Hybrid search** (vector + keyword) improves recall on exact policy terms ("Form 12B").
- **Reranking** sharpens precision before the LLM sees the context.
- **Low-confidence guard:** if top score < threshold, Node instructs the LLM to say it can't find an authoritative answer rather than guess.

### 11.3 Citations (mandatory)
Every FAQ answer returns, per cited chunk: `documentId`, `title`, `section`, `version`, `snippet`, `score`. The UI renders these as expandable source cards. Answers that use no retrieved chunk for an institutional question are blocked as ungrounded.

---

# 12. Memory Architecture

Two tiers, cleanly separated.

### 12.1 Short-term (Redis)
- Holds the **rolling conversation window** (last N turns) per conversation, TTL-bounded.
- Maintains continuity within and across near-term sessions cheaply.
- Key: `conv:{conversationId}:window`.

### 12.2 Long-term (MongoDB `memories`)
- Persistent, structured student facts: **goals, weak areas, preferences, achievements**.
- **Extraction:** after a conversation, an LLM pass extracts candidate facts → deduped against existing memories → stored with `confidence` and `source`.
- **Injection:** relevant memories are loaded into the prompt for personalized intents (Stage 2+).
- Example: Session 1 "I struggle with probability" → stored as `weak_area`. Session 2 "Make a study plan" → plan automatically targets probability.

---

# 13. AI Orchestration Layer

The brain, implemented in `services/api/modules/chat` + `intent` + `memory` + `safety`, calling `services/ai` for model work.

```text
User message
   ↓ input moderation (block/safe-complete if unsafe)
   ↓ intent classification  → { FAQ | course_help | personal_advice | agent_action }
   ↓ route:
       FAQ            → retrieve → build grounded prompt → generate (cited)
       course_help    → retrieve + student context → personalized explanation
       personal_advice→ student profile + long-term memory → guidance (no cheating)
       agent_action   → (Stage 3) tool selection → validate → execute → confirm
   ↓ output moderation
   ↓ stream to client, persist message, write analytics + Langfuse trace, extract memory
```

**Intent classification** is a fast, cheap LLM (or classifier) call returning a label + confidence. Prompt templates are **versioned** in `services/ai/app/prompts` so changes are traceable.

---

# 14. Safety & Moderation Layer

Mandatory, runs on **both** input and output via `services/ai /moderate`.

- **Risk categories:** self-harm, harassment, dangerous activities, misinformation, and **academic dishonesty** (doing graded work for the student).
- **Academic-integrity guardrail:** the assistant *teaches and guides* ("here's how to approach this proof") but refuses to *complete graded/assessed work verbatim*. This is a first-class, configurable policy.
- **Actions:** `allow`, `block` (with a supportive message + resources for self-harm), or `safe_complete` (answer a safer reframing).
- Every block is recorded as an `analyticsEvents` entry of type `moderation_block` and traced.

---

# 15. Observability & Evaluation

### 15.1 Tracing — Langfuse
Every chat turn produces one trace capturing: input, intent, retrieved chunks + scores, final prompt, model + provider, response, **tokens, cost, latency**, moderation results, and citations used.

### 15.2 Product analytics (Mongo aggregations)
- **Most asked questions** (clustered), **answer failure rate** (low-confidence or thumbs-down), **hallucination rate** (flagged ungrounded / negative feedback on cited answers), **average response time**, **cost per answer**.

### 15.3 Evaluation harness (`evals/`) — *new in v2.0*
- A **golden Q&A set** of institutional questions with expected source sections.
- Automated runs score **retrieval hit rate**, **citation correctness**, and **answer faithfulness** (LLM-as-judge against retrieved context).
- Runs in CI on changes to prompts, chunking, or models — preventing silent RAG regressions.

---

# 16. Security, Auth & Multi-Tenancy

- **Auth:** JWT access (short-lived) + refresh (rotating) issued by Node; passwords hashed with bcrypt/argon2.
- **RBAC:** `student` (own data only), `admin` (institution docs + analytics), `super_admin` (cross-institution).
- **Multi-tenancy:** `institutionId` on every record and every Qdrant payload; all queries are tenant-scoped by middleware. One deployment can serve many institutions.
- **Rate limiting:** Redis-backed per-user and per-IP limits on `/api/chat` and auth endpoints.
- **Input validation:** zod schemas on every Express route; reject unknown fields.
- **Secrets:** provider keys via env only; never in the repo. PII (grades, profile) is tenant-scoped and access-logged in `auditLog`.

---

# 17. Environment & Configuration

Each service ships a `.env.example`. zod/pydantic validates on boot; a missing required var fails fast.

```env
# services/api (Node)
PORT=4000
MONGO_URI=mongodb://localhost:27017/eduai
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
S3_ENDPOINT=http://localhost:9000
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...

# services/ai (Python)
PORT=8000
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIM=3072
DEFAULT_LLM_PROVIDER=claude
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
RETRIEVAL_TOPK=20
RERANK_TOPK=8
LOW_CONFIDENCE_THRESHOLD=0.35

# services/ingestion (Python)
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
S3_ENDPOINT=http://localhost:9000
CHUNK_MIN_TOKENS=300
CHUNK_MAX_TOKENS=800
CHUNK_OVERLAP=0.15
```

`infrastructure/docker/docker-compose.yml` brings up MongoDB, Redis, Qdrant, MinIO, and Langfuse for one-command local dev.

---

# 18. Implementation Roadmap — Atomic Stages

> **How to read this.** Each stage is **one feature or one process**. An agentic IDE should implement exactly one stage per work unit, satisfy its **Acceptance Criteria**, and stop. Stages list their **Location**, **Depends on**, **Tasks**, and **Done when**. Phases map to the product vision (§3). Do stages in order unless `Depends on` says otherwise.

## Phase 0 — Foundation & Infrastructure

### S0.1 — Monorepo scaffolding
- **Location:** repo root, `packages/`
- **Depends on:** —
- **Tasks:** Init pnpm workspace + Turborepo; create empty `apps/*`, `services/*`, `packages/*` per §7; root TS config; lint/format (ESLint, Prettier, Ruff for Python); commit hooks.
- **Done when:** `pnpm install` and `turbo run lint` succeed across all workspaces; folder tree matches §7.

### S0.2 — Local infrastructure (docker-compose)
- **Location:** `infrastructure/docker`
- **Depends on:** S0.1
- **Tasks:** compose file for MongoDB, Redis, Qdrant, MinIO, Langfuse with healthchecks and named volumes; `make up`/`make down` helpers.
- **Done when:** `docker compose up` brings all five healthy; each is reachable on its documented port.

### S0.3 — Shared packages: contracts, config, logger
- **Location:** `packages/contracts`, `packages/config`, `packages/logger`
- **Depends on:** S0.1
- **Tasks:** Encode all §9 contracts as TS types + JSON Schema; zod env loaders; structured JSON logger with request/trace IDs.
- **Done when:** Other services can import contract types; invalid env fails boot with a clear message.

### S0.4 — Health checks & CI baseline
- **Location:** each service, `.github/workflows`
- **Depends on:** S0.1
- **Tasks:** `/health` (Node) and `/healthz` (Python) verifying deps; CI runs lint + typecheck + unit tests + builds Docker images.
- **Done when:** CI is green on an empty skeleton; health endpoints report dependency status.

## Phase 1 — MVP: Auth · Chat · Upload · RAG · Citations (Product Stage 1)

### S1.1 — MongoDB connection & core models
- **Location:** `services/api/src/infra`, `modules/*/model.ts`
- **Depends on:** S0.2, S0.3
- **Tasks:** Mongoose connection; schemas for `users`, `documents` (others stubbed); indexes from §8.
- **Done when:** App connects; creating a `user` doc enforces unique email + required indexes exist.

### S1.2 — Auth module
- **Location:** `services/api/src/modules/auth`
- **Depends on:** S1.1
- **Tasks:** register/login/refresh; bcrypt/argon2 hashing; JWT access+refresh; `auth` + `rbac` middleware; rate limit on auth routes.
- **Done when:** A user can register, log in, hit a protected route with the access token, and rotate via refresh; wrong creds rejected.

### S1.3 — API gateway skeleton
- **Location:** `services/api/src/app.ts`, `middleware/`
- **Depends on:** S1.2
- **Tasks:** Express app; global error handler; zod validation middleware; CORS; request/trace-ID logging; mount auth + health.
- **Done when:** Unhandled errors return structured JSON; every request carries a trace ID; invalid bodies are 400s.

### S1.4 — AI service skeleton + LLM adapters
- **Location:** `services/ai`
- **Depends on:** S0.2, S0.3
- **Tasks:** FastAPI app; `LLMProvider` base + Gemini/OpenAI/Anthropic adapters selected by config; `/embed`, `/generate` (non-stream first); Langfuse hook.
- **Done when:** `POST /generate` returns a completion from the default provider; switching `DEFAULT_LLM_PROVIDER` swaps providers with no code change.

### S1.5 — Document upload & ingestion enqueue
- **Location:** `services/api/src/modules/documents`
- **Depends on:** S1.3
- **Tasks:** `POST /api/documents` (multipart) → store raw file in MinIO → create `documents` doc (`status=uploaded`) → push `ingest` job to Redis; `GET /api/documents` listing.
- **Done when:** Uploading a PDF returns a `documentId`, the file is in MinIO, and a job is visible in the Redis queue.

### S1.6 — Ingestion worker: parse
- **Location:** `services/ingestion`
- **Depends on:** S1.5
- **Tasks:** Redis queue consumer; parsers for pdf/docx/markdown/html/web → normalized text with section structure; update `status`.
- **Done when:** Worker consumes a job, extracts clean sectioned text from each supported format, sets `status=chunking`.

### S1.7 — Ingestion worker: chunk
- **Location:** `services/ingestion/app/chunking`
- **Depends on:** S1.6
- **Tasks:** Implement §11.1 chunking (300–800 tokens, section-aware, ~15% overlap); attach metadata; deterministic `chunkId`.
- **Done when:** A parsed doc yields chunks within bounds, each carrying section + version metadata; identical re-run yields identical chunkIds.

### S1.8 — Ingestion worker: embed + Qdrant upsert
- **Location:** `services/ingestion/app/embed`
- **Depends on:** S1.7
- **Tasks:** Embed chunks (configured model); ensure tenant collection exists (dim from config); idempotent upsert keyed by chunkId; set `documents.status=ready`, `chunkCount`.
- **Done when:** After upload, vectors exist in Qdrant with full payload; re-ingesting the same version does not duplicate vectors; doc shows `ready`.

### S1.9 — Retrieval endpoint
- **Location:** `services/ai/app/rag`
- **Depends on:** S1.8
- **Tasks:** `POST /retrieve` per §9.1 — embed query, vector search topK, hybrid fuse, rerank to top 5–8, tenant-filtered; return chunks + scores + `retrievalMs`.
- **Done when:** A known policy query returns the correct chunk in the top results with citation metadata populated.

### S1.10 — Safety/moderation endpoint
- **Location:** `services/ai/app/routers/moderate.py`, `services/api/src/modules/safety`
- **Depends on:** S1.4
- **Tasks:** `POST /moderate` (input/output) covering §14 categories incl. academic integrity; Node safety orchestrator wraps chat I/O; record `moderation_block` events.
- **Done when:** Unsafe input is blocked with an appropriate message; a "do my graded exam for me" request is refused with a guidance reframing.

### S1.11 — Chat orchestration (FAQ path) + SSE
- **Location:** `services/api/src/modules/chat`
- **Depends on:** S1.9, S1.10, S1.4
- **Tasks:** `POST /api/chat` → input moderation → (Phase 1: assume FAQ) → `/retrieve` → build grounded prompt → `/chat` streaming → output moderation → SSE to client; persist `messages` with citations; low-confidence guard; write analytics + trace.
- **Done when:** A policy question streams a grounded answer with correct citations; an unanswerable question yields an honest "no authoritative source" reply, not a hallucination.

### S1.12 — Frontend: auth + shell
- **Location:** `apps/web`
- **Depends on:** S1.2
- **Tasks:** React + Vite + Tailwind + shadcn/ui; login/register; token storage + refresh; protected routing; app shell/nav.
- **Done when:** A user registers, logs in, and lands on an authenticated home; refresh works after token expiry.

### S1.13 — Frontend: chat UI with streaming + citations
- **Location:** `apps/web/src/features/chat`
- **Depends on:** S1.11, S1.12
- **Tasks:** Conversation list + thread; SSE streaming render; expandable citation source cards; thumbs up/down → `/feedback`; conversation history.
- **Done when:** User chats, sees tokens stream in, expands cited sources, and submits feedback; reloading shows history.

### S1.14 — Admin: document upload UI
- **Location:** `apps/admin`
- **Depends on:** S1.5
- **Tasks:** Admin SPA shell (admin-role login); upload form; document list showing `status`, `version`, `chunkCount` with live status polling.
- **Done when:** Admin uploads a doc and watches it progress `uploaded → … → ready`.

### ✅ Phase 1 Gate
A student logs in, asks an institutional question, and receives a **streamed, grounded, cited** answer; an admin can upload a document that becomes searchable. Eval harness (S3.x is later, but) — at minimum a manual golden question returns the right source.

## Phase 2 — Personalization: Student Context · Memory · Study Plans (Product Stage 2)

### S2.1 — Student profile models & APIs
- **Location:** `services/api/src/modules/students`
- **Depends on:** S1.1
- **Tasks:** `students`, `courses`, `enrollments`, `grades` schemas; `GET/PUT /api/students/me/profile`; seed/import path for courses & grades.
- **Done when:** A student can read/update profile; grades and enrollments are queryable per student.

### S2.2 — Short-term memory (Redis)
- **Location:** `services/api/src/modules/memory`
- **Depends on:** S1.11
- **Tasks:** Rolling window per conversation in Redis (TTL, last-N turns); inject window into prompts.
- **Done when:** Multi-turn context is preserved within a conversation without re-sending full history from the client.

### S2.3 — Long-term memory extraction & injection
- **Location:** `services/api/src/modules/memory`, `services/ai/app/prompts`
- **Depends on:** S2.2
- **Tasks:** Post-conversation LLM extraction of goals/weak-areas/preferences → dedupe → `memories`; relevant-memory injection for personalized intents.
- **Done when:** "I struggle with probability" in session 1 influences a study plan in session 2 with no restatement.

### S2.4 — Intent classifier (full)
- **Location:** `services/api/src/modules/intent`
- **Depends on:** S1.11
- **Tasks:** Classify into `FAQ | course_help | personal_advice | agent_action` (+confidence); route in chat orchestration; trace the label.
- **Done when:** Sample queries route correctly; the chosen intent is visible in the trace and on the message record.

### S2.5 — Personalized answer composition
- **Location:** `services/api/src/modules/chat`
- **Depends on:** S2.1, S2.3, S2.4
- **Tasks:** For `course_help`/`personal_advice`, build prompts that combine retrieved knowledge + student profile + long-term memory; keep academic-integrity guardrail.
- **Done when:** The same question yields differently tailored guidance for two student profiles, while staying grounded for any factual claims.

### S2.6 — Study plan generation
- **Location:** `services/api/src/modules/students` (or `studyplan` module)
- **Depends on:** S2.5
- **Tasks:** `POST /api/study-plan` → uses weak areas, grades, course load → structured plan (milestones, resources, schedule); persist + return.
- **Done when:** A failing-in-probability student receives a concrete, resource-linked recovery plan targeting the right topics.

### S2.7 — Frontend: profile + study plan
- **Location:** `apps/web/src/features/{profile,study-plan}`
- **Depends on:** S2.1, S2.6
- **Tasks:** Profile editor; study-plan view (milestones, resources, progress).
- **Done when:** Student edits profile and generates/views a study plan in the UI.

### ✅ Phase 2 Gate
The assistant gives student-specific guidance that reflects profile + remembered history across sessions, and produces actionable study plans.

## Phase 3 — Admin, Analytics & Knowledge Management (Product Stage 1.5)

### S3.1 — Knowledge management APIs
- **Location:** `services/api/src/modules/knowledge`
- **Depends on:** S1.8
- **Tasks:** `POST /documents/:id/reembed` and `DELETE /documents/:id` → enqueue `reembed`/`delete` jobs; worker handles vector replacement/removal; document **versioning**.
- **Done when:** Re-embedding updates vectors without duplicates; deleting a doc removes its vectors and metadata; old versions are superseded.

### S3.2 — Analytics capture
- **Location:** `services/api/src/modules/analytics`
- **Depends on:** S1.11
- **Tasks:** Emit `analyticsEvents` for query/answer/feedback/retrieval/moderation with latency + cost.
- **Done when:** Every chat turn produces consistent analytics rows.

### S3.3 — Analytics aggregations & API
- **Location:** `services/api/src/modules/analytics`
- **Depends on:** S3.2
- **Tasks:** `GET /api/analytics/overview` — most-asked (clustered), failure rate, hallucination rate, avg latency, cost; Mongo aggregation pipelines.
- **Done when:** The endpoint returns correct metrics over seeded event data.

### S3.4 — Langfuse integration (full)
- **Location:** `services/ai`, `services/api`
- **Depends on:** S1.4, S1.11
- **Tasks:** End-to-end trace per turn: input, intent, chunks+scores, prompt, model, output, tokens, cost, latency, moderation.
- **Done when:** A single turn appears as one coherent Langfuse trace with all spans populated.

### S3.5 — Evaluation harness
- **Location:** `evals/`
- **Depends on:** S1.9, S1.11
- **Tasks:** Golden Q&A set; scripts scoring retrieval hit-rate, citation correctness, answer faithfulness (LLM-as-judge); CI job on prompt/chunking/model changes.
- **Done when:** `pnpm eval` (or `make eval`) prints scores; CI fails if scores drop below configured thresholds.

### S3.6 — Admin dashboard UI
- **Location:** `apps/admin`
- **Depends on:** S3.1, S3.3
- **Tasks:** Knowledge management views (versions, chunks, embedding status, re-embed/delete); analytics charts.
- **Done when:** Admin manages the knowledge base and reads analytics entirely from the UI — no engineering intervention.

### ✅ Phase 3 Gate
Admins update knowledge and read quality/cost/usage analytics themselves; RAG quality is guarded by automated evals.

## Phase 4 — Institutional AI Agent (Product Stage 3)

### S4.1 — Tool framework & registry
- **Location:** `services/api/src/modules/agent`
- **Depends on:** S2.4, S1.10
- **Tasks:** Tool interface (schema, validate, execute, audit); registry; `agent_action` route in orchestration; every invocation written to `auditLog`.
- **Done when:** A no-op demo tool can be registered, selected by intent, validated, executed, and audited end-to-end.

### S4.2 — Agent loop (plan → act → confirm)
- **Location:** `services/api/src/modules/agent`
- **Depends on:** S4.1
- **Tasks:** Bounded plan/execute loop with explicit user confirmation before any state-changing action; guardrails + step limits.
- **Done when:** The agent proposes an action, requests confirmation, executes only on approval, and returns a verifiable result.

### S4.3 — Concrete tools
- **Location:** `services/api/src/modules/agent/tools`
- **Depends on:** S4.2
- **Tasks:** Implement `registerCourse`, `bookAppointment`, `downloadNotes`, `createTicket` against institutional API adapters (mockable); eligibility validation per tool.
- **Done when:** "Register me for the workshop" validates eligibility, calls the (mock) institution API, and returns a confirmation; ineligible requests are refused with reasons.

### S4.4 — Institutional integration adapters
- **Location:** `services/api/src/modules/agent/integrations`
- **Depends on:** S4.3
- **Tasks:** Adapter layer for external institution APIs (auth, retries, idempotency keys, error mapping); config-driven endpoints.
- **Done when:** Tools work against a real or sandbox institutional API via swappable adapters; failures are surfaced safely and audited.

### ✅ Phase 4 Gate
The assistant safely performs governed, audited actions on the student's behalf with eligibility checks and explicit confirmation.

---

# 19. Success Criteria & Acceptance Gates

The platform is successful when:

- Students stop manually searching PDFs — they ask and get **cited** answers.
- Support ticket volume drops measurably.
- Students receive **personalized**, history-aware academic guidance and study plans.
- Admins update the knowledge base (upload, version, re-embed, delete) and read analytics **without engineering help**.
- Every AI answer is **traceable** (citations + Langfuse) and **safe** (moderation + academic-integrity guardrails).
- RAG quality is protected by **automated evals** in CI.
- The product evolves cleanly from FAQ → personalized assistant → governed agent, with each capability isolated in its own service for straightforward debugging.

Each phase gate above must pass before the next phase begins.

---

# 20. Glossary

- **RAG** — Retrieval-Augmented Generation: ground LLM answers in retrieved documents to cut hallucination and enable citations.
- **Chunk** — a 300–800 token, section-aware slice of a document, embedded and stored in Qdrant with metadata.
- **Hybrid search** — combining vector similarity with keyword (BM25) matching for better recall.
- **Reranking** — a precision pass (cross-encoder) over retrieved candidates before the LLM sees them.
- **Short-term memory** — Redis rolling conversation window.
- **Long-term memory** — durable student facts in MongoDB, extracted from conversations.
- **Grounded** — an answer supported by retrieved evidence; ungrounded institutional answers are blocked.
- **Tenant** — an institution; isolated by `institutionId` across Mongo and Qdrant.
- **MERN** — MongoDB, Express, React, Node — the product spine. The AI/RAG workload is the single, deliberate polyglot exception (Python/FastAPI).

---

*This document is the foundational architecture specification for implementation by human developers or agentic coding systems (Claude Code, Cursor, Windsurf, Codex, or similar). Each stage in §18 is independently implementable and verifiable.*
