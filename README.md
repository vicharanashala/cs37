# CrowdSource FAQ

An **AI-powered, community-driven FAQ portal** for the *Vicharanashala / Samagama Internship Programme* at IIT Ropar.

> **Context:** The base FAQ problem statement was shared across 50 teams. This repository is **our team's submission** — the same core FAQ idea, extended with a Retrieval-Augmented-Generation (RAG) assistant, AI moderation, a full community Q&A layer, an AI helper bot, and a complete admin dashboard. This document describes everything the project does, the stack it runs on, and how to run it.

---

## 1. What it is

A monorepo with two cooperating services and two datastores:

| Service | Stack | Role |
|---|---|---|
| **`faq-web`** | Next.js 16 (App Router) + React 19 + TypeScript | Web app, user-facing pages, **and** the backend API (Next.js Route Handlers) |
| **`rag-service`** | Python + FastAPI | RAG pipeline — retrieves + generates AI answers and moderates content with Google Gemini |
| **MongoDB** | Atlas / Mongo 7 | Source of truth for FAQs, questions, community content, users |
| **ChromaDB** | Vector store | Embeddings of the institutional knowledge base for semantic retrieval |

The whole stack is orchestrated with **Docker Compose** (`frontend`, `backend`, `chromadb`, `mongodb`).

---

## 2. Architecture

```
                          ┌─────────────────────────────────────────────┐
                          │                Browser (User)               │
                          │   FAQ · Ask · Community · Yaksha Chat · Admin │
                          └───────────────────────┬─────────────────────┘
                                                  │  HTTP
                          ┌───────────────────────▼─────────────────────┐
                          │          faq-web  —  Next.js 16              │
                          │  • Pages (RSC + client components)           │
                          │  • API Route Handlers  (/api/**)             │
                          │  • Auth (JWT cookies) + admin middleware     │
                          └───────┬───────────────────────────┬─────────┘
                                  │ Mongoose                   │ HTTP (RAG_API)
                          ┌───────▼────────┐          ┌────────▼──────────────────┐
                          │   MongoDB      │          │  rag-service — FastAPI     │
                          │  faqs          │          │  /query        (RAG answer)│
                          │  pending_qs    │◄────────►│  /generate-answer (bot)    │
                          │  community_*   │ writeback│  /validate-question        │
                          │  users/admins  │          │  /validate-reply           │
                          └────────────────┘          │  /search · /health         │
                                                       └────────┬───────────────────┘
                                                        Gemini  │  ChromaDB │ Web (DDG)
                                                       embeddings▼  vectors  ▼ search
```

**Key design decision:** instead of running a separate Express backend, the Next.js app *is* the backend. Express-style endpoints from the original design map onto **Next.js Route Handlers** (`app/api/**`), using this version's conventions (async route params, `after()` for post-response work). The Python service is reserved for the ML-heavy work: embeddings, retrieval, generation, and LLM moderation.

---

## 3. Features

Features are the heart of this project. Each is implemented end-to-end (UI → API → data/AI).

### Knowledge base & search
1. **Semantic FAQ search** — client-side fuzzy search with **Fuse.js** that matches intent, not just keywords, with match highlighting.
2. **Voice search** — ask questions by speaking, via the Web Speech API.
3. **Browse & filter** — category filter pills, expandable FAQ cards, shareable per-FAQ links.
4. **Helpfulness feedback** — upvote / downvote on every answer (`helpful` / `notHelpful` counters) to surface quality.
5. **Overview page** — a concise programme briefing (badges, expectations, interview process, logistics, cost) so new interns get context fast.

### Yaksha Chat (AI assistant)
6. **RAG-grounded chat** — a floating assistant available on every page that answers from the institutional knowledge base via the FastAPI `/query` endpoint, with **source citations** and confidence scoring.
7. **Confidence-based fallback** — when RAG confidence is low (no good answer found), the question is automatically captured into `pending_questions` with `source = "yaksha_chat"` and surfaces in the admin **FAQ Suggestions** queue — turning unanswered questions into future FAQs.

### Ask a question
8. **Submit a question** (`/ask`) — category, priority (normal/urgent), and email, with **real-time duplicate detection** as you type.
9. **AI question moderation** — on submit, the question is persisted and then validated asynchronously (`after()`) against the FastAPI `/validate-question` endpoint, which runs it through Gemini and **writes the verdict (approved / rejected_by_rag + reason) straight back to MongoDB**. The flow is **fail-open**: if the RAG service is down, the question stays `pending` for manual review instead of blocking submission.

### Community Q&A
10. **Community questions & threaded replies** (`/community`) — students post questions and answer each other; replies support `admin`, `mentor`, `user`, and `bot` author roles.
11. **AI Helper Bot replies** — the FastAPI `/generate-answer` endpoint drafts answers from **two knowledge sources at once**: the institutional RAG corpus **and** live web search (DuckDuckGo via `ddgs`). Bot replies are rendered distinctly and carry their grounding `sources[]` (RAG + web).
12. **Voting & reputation** — one-vote-per-user scoring on answers (`CommunityVote`) to rank the best community content.
13. **Reporting & auto-moderation** — users can report answers (`CommunityReport`); heavily-reported answers are auto-pulled. Replies are screened by the FastAPI `/validate-reply` Gemini moderator (safety, relevance, academic-integrity, policy-grounding).
14. **Consensus summaries** — approved answers are synthesized into a balanced summary that **keeps official/cited facts separate from student tips** (never mixing student content into the official corpus), with staleness-aware caching.
15. **My contributions** (`/community/my`) — a personal view of a student's questions and answers.

### Admin dashboard
16. **Secure admin area** (`/admin`) — JWT session cookie enforced by Next.js **middleware** on all `/admin/**` routes, with a dedicated login page. Roles: `super_admin`, `admin`, `moderator`.
17. **Analytics** — dashboard with summary metrics and **Recharts** visualizations.
18. **FAQ management** — full CRUD over FAQs, **plus a Manual FAQ creator**, soft-publish (`isPublished`) and edit versioning.
19. **FAQ Suggestions** — review questions captured from Ask / Yaksha Chat and **promote them to published FAQs** (with back-reference `resolvedFrom`).
20. **Category management** — CRUD over FAQ categories.
21. **User management** — manage student accounts.
22. **Community moderation** — review queues for community questions, answers, and reports.

### Accounts & platform
23. **Student auth** — signup / signin with **bcrypt** password hashing and **JWT**.
24. **Markdown everywhere** — answers and replies render Markdown (`react-markdown` + `remark-gfm`).
25. **Polished UX** — dark theme, **Framer Motion** animations, mobile-first responsive layout, shadcn/ui components, and toast notifications.

---

## 4. Tech stack

**Frontend / API (`faq-web`)**
- Next.js 16 (App Router, Route Handlers), React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui (Radix / base-ui), Framer Motion, Lucide icons
- Fuse.js (fuzzy search), Recharts (charts), @tanstack/react-table (admin tables)
- react-markdown + remark-gfm, react-hot-toast
- Mongoose 9 (MongoDB ODM), bcryptjs, jsonwebtoken

**RAG service (`rag-service`)**
- Python, FastAPI, Uvicorn
- Google Gemini — `gemini-embedding-001` (embeddings) + `gemini-3.1-flash-lite` (generation/moderation)
- ChromaDB (vector store), pymongo (writeback)
- BeautifulSoup + lxml (scraping/cleaning), `ddgs` (DuckDuckGo web search)

**Infrastructure**
- Docker + Docker Compose (frontend, backend, chromadb, mongodb) with healthchecks and named volumes
- MongoDB 7 / Atlas, ChromaDB 0.5.x

---

## 5. Repository layout

```
CrowdSource_FAQ_monorepo/
├── docker-compose.yml          # 4-service orchestration
├── .env.example                # all required environment variables
├── start.sh                    # one-shot local setup & launch (idempotent)
│
├── faq-web/                    # Next.js app (frontend + API)
│   ├── app/
│   │   ├── page.tsx            # FAQ search/browse
│   │   ├── ask/                # Ask a question
│   │   ├── community/          # Community Q&A (list, detail, my)
│   │   ├── overview/           # Programme briefing
│   │   ├── auth/               # signup / signin
│   │   ├── admin/              # dashboard, faqs, categories, users, community, login
│   │   └── api/                # Route Handlers (community, admin, ai, ask, auth, faqs, chat-suggestion)
│   └── src/
│       ├── models/             # Mongoose schemas (see below)
│       ├── lib/ai/             # RAG client, retrieval, community review/summary
│       ├── lib/community/      # service, validation, rate-limit, serializers
│       ├── lib/db/             # seed + migration scripts
│       └── components/         # UI, admin, community, auth components
│
└── rag-service/RAG_pipeline/
    ├── parser.py / chunk.py / embed_and_store.py   # scrape → chunk → embed
    ├── rag_api.py                                  # FastAPI server
    └── data/ (raw_documents.json, chunks.json)     # knowledge base
```

**Core data models** (`faq-web/src/models/`): `FAQ`, `Category`, `PendingQuestion` (unified source of truth for asked/community questions, with nested `replies[]`, RAG validation, and moderation), `CommunityQuestion` / `CommunityAnswer` / `CommunityVote` / `CommunityReport` / `CommunityQuestionSummary`, `FAQReply`, `User`, `AdminUser`, `ChatSession`.

---

## 6. Getting started

### Option A — Docker Compose (recommended)
```bash
cp .env.example .env          # fill in MONGODB_URI, GEMINI_API_KEY, COMMUNITY_ADMIN_KEY, …
docker compose up --build
# Frontend → http://localhost:3000
# RAG API  → http://localhost:8000   (docs at /docs)
```

### Option B — one-shot script
```bash
chmod +x start.sh && ./start.sh   # sets up the Python venv + npm deps and launches both services
```

### Option C — manual
```bash
# RAG service
cd rag-service/RAG_pipeline
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # add GEMINI_API_KEY (+ MONGODB_URI for writeback)
python embed_and_store.py         # build the vector DB once
uvicorn rag_api:app --reload --port 8000

# Frontend (new terminal)
cd faq-web
npm install
cp .env.example .env.local        # add MONGODB_URI, RAG_API, COMMUNITY_ADMIN_KEY
npm run db:seed                   # seed the FAQ corpus
npm run dev                       # http://localhost:3000
```

### Required environment variables
| Variable | Used by | Purpose |
|---|---|---|
| `MONGODB_URI` | both | MongoDB Atlas connection string |
| `GEMINI_API_KEY` | rag-service | Gemini embeddings + generation ([get one](https://aistudio.google.com/apikey)) |
| `RAG_API` / `RAG_API_URL` | faq-web | URL of the FastAPI backend |
| `COMMUNITY_ADMIN_KEY` | both | shared admin/moderation key |
| `INSTITUTION_ID` | faq-web | institution identifier |

### Useful scripts (`faq-web`)
- `npm run db:seed` — seed the FAQ corpus · `db:seed:admin` — seed an admin user · `db:seed:community` — seed community data
- `npm run db:migrate:pending-questions` — backfill the unified `pending_questions` schema

---

## 7. RAG API surface (`rag-service`)

| Endpoint | Description |
|---|---|
| `POST /query` | Retrieve top-k chunks + generate an answer with sources (Yaksha Chat) |
| `POST /generate-answer` | AI helper bot — answer from **RAG corpus + live web search** |
| `POST /validate-question` | Moderate a submitted question and **write the verdict back to MongoDB** |
| `POST /validate-reply` | Moderate a community reply (stateless verdict) |
| `GET /search` | Raw vector search, no LLM (debugging) |
| `GET /health` | Health check + chunk count |

---

## 8. License

MIT — see [LICENSE](./LICENSE). Built for the Vicharanashala Internship Programme, IIT Ropar (2026 cycle).
```
