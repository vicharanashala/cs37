# Samagama FAQ Portal — CrowdSource FAQ (cs37)

An AI-powered FAQ and community Q&A platform built for the **Vicharanashala Internship Programme** at **IIT Ropar**.

- **License:** MIT
- **Git branch:** `feature/sannoji`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16.2.6, React 19.2.4, TypeScript 5, Tailwind CSS 4, Framer Motion |
| **Backend API** | Next.js Route Handlers (Node.js), Mongoose 9 |
| **AI/RAG** | FastAPI (Python), Google Gemini, ChromaDB (vector store) |
| **Database** | MongoDB 7.0 |
| **UI** | Lucide icons, Recharts, shadcn/ui, Fuse.js (fuzzy search) |
| **Search** | Fuse.js (client-side fuzzy search), ChromaDB (vector search) |

---

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │          Next.js 16 (faq-web)        │
                    │  ┌────────┐ ┌──────┐ ┌───────────┐  │
                    │  │ Pages  │ │ API  │ │ Components│  │
                    │  │ (SSR/  │ │Routes│ │ (React)   │  │
                    │  │  SPA)  │ │      │ │           │  │
                    │  └────────┘ └──┬───┘ └───────────┘  │
                    └───────────────┼─────────────────────┘
                                    │ HTTP
                    ┌───────────────┼─────────────────────┐
                    │     FastAPI RAG Backend (rag-service) │
                    │  /query  /validate-question          │
                    │  /search /validate-reply             │
                    │  /generate-answer  /health           │
                    │              │                       │
                    │     Gemini (LLM + Embedding)         │
                    └───────────────┼─────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
     ┌──────┴──────┐        ┌──────┴──────┐        ┌──────┴──────┐
     │   MongoDB   │        │   ChromaDB  │        │  DuckDuckGo │
     │ (faqs,      │        │ (vectors,   │        │  (web       │
     │  questions, │        │  chunks)    │        │  search)    │
     │  users,     │        │             │        │             │
     │  analytics) │        │             │        │             │
     └─────────────┘        └─────────────┘        └─────────────┘
```

### Data Flow

1. User submits a question via the **Ask** or **Community** page
2. Next.js API route persists to MongoDB (`pending_questions` collection)
3. A background call fires to FastAPI `/validate-question` for moderation
4. Gemini checks the question for safety, relevance, and academic integrity
5. If approved, FastAPI's `/generate-answer` creates a bot answer using RAG + DuckDuckGo web search
6. The question appears on the community page for others to see and answer
7. Community answers go through `/validate-reply` for safety/malpractice moderation
8. All FAQs, questions, and answers are searchable via Fuse.js (client-side) or vector search (ChromaDB)

---

## Features

### User Features
- **FAQ Browsing** — Search, filter by category, expand/collapse cards, vote helpful/not helpful
- **Ask Questions** — Form with real-time duplicate detection via Fuse.js; questions go to admin for review
- **Community Q&A** — Post questions, answer, vote, report, threaded replies
- **AI Chat Assistant** — Yaksha Chat floating widget on all pages
- **Voice Search** — Speech-to-text (Web Speech API) in the search bar
- **Overview** — Static programme details page

### Admin Features
- **Dashboard** — Analytics, stats, recent activity with Recharts
- **Pending Questions** — Review, resolve, or reject user questions
- **FAQ Management** — CRUD operations for FAQs and categories
- **Community Moderation** — Review questions, answers, reports, and review queue
- **User Management** — Manage user accounts
- **AI Resolve Assistant** — AI-suggested answers with RAG fallback + FAQ keyword search
- **Analytics** — Summary stats and trending data

### AI / RAG Pipeline
- Document scraping from samagama.in (HTML parsing with BeautifulSoup)
- Chunking with sliding window (400-token target, 60-token overlap) — QA and prose strategies
- Embedding via `gemini-embedding-001` stored in ChromaDB collection `samagama_internship`
- Generation via `gemini-3.1-flash-lite` (temperature 0.1 factual, 0.0 moderation)
- Top-K retrieval: 5 chunks
- Grounded answers with source citations
- DuckDuckGo web search fallback for unanswered questions

---

## Pages (App Router)

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | FAQ browsing with search, category filters, expandable FAQ cards, stats, voting |
| `/overview` | `app/overview/page.tsx` | Internship programme overview (static content page) |
| `/ask` | `app/ask/page.tsx` | Ask a question with real-time duplicate detection via Fuse.js |
| `/resolve` | `app/resolve/page.tsx` | Admin resolve panel with AI-suggested answers (split-panel layout) |
| `/community` | `app/community/page.tsx` | Community Q&A feed — search, filter, vote, ask, threaded replies |
| `/community/[questionId]` | `app/community/[questionId]/page.tsx` | Individual community question thread |
| `/community/my` | `app/community/my/page.tsx` | My contributions page |
| `/threads` | `app/threads/page.tsx` | Discussion threads (demo data) |
| `/auth/signin` | `app/auth/signin/` | Sign in page |
| `/auth/signup` | `app/auth/signup/` | Sign up page |
| `/admin/login` | `app/admin/login/page.tsx` | Admin login |
| `/admin` | `app/admin/page.tsx` | Admin panel — review/resolve pending questions, FAQ suggestions |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | Admin analytics dashboard (stats, recent activity) |
| `/admin/faqs` | `app/admin/faqs/page.tsx` | FAQ management (CRUD) |
| `/admin/categories` | `app/admin/categories/page.tsx` | Category management |
| `/admin/users` | `app/admin/users/page.tsx` | User management |
| `/admin/community` | `app/admin/community/page.tsx` | Community moderation hub |
| `/admin/community/questions` | `app/admin/community/questions/page.tsx` | Review community questions |
| `/admin/community/answers` | `app/admin/community/answers/page.tsx` | Review community answers |
| `/admin/community/reports` | `app/admin/community/reports/page.tsx` | Manage community reports |

### API Routes

**General:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/faqs` | List published FAQs + categories |
| GET | `/api/faqs/replies` | List FAQ replies |
| POST | `/api/ask` | Submit a question (persists to MongoDB, fires RAG validation) |
| POST | `/api/chat-suggestion` | Submit a chat-sourced question for FAQ review |
| POST | `/api/auth/signin` | User sign in |
| POST | `/api/auth/signup` | User sign up |

**Community:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/community/questions` | List/search/create community questions |
| GET | `/api/community/questions/[id]` | Get question detail |
| POST | `/api/community/questions/[id]/answers` | Submit an answer |
| POST | `/api/community/answers/[answerId]/vote` | Vote on an answer |
| POST | `/api/community/answers/[answerId]/report` | Report an answer |
| GET | `/api/community/my-contributions` | Get current user's contributions |

**Admin:**
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin/auth/login` | Admin login |
| POST | `/api/admin/auth/logout` | Admin logout |
| GET | `/api/admin/auth/me` | Get current admin session |
| GET | `/api/admin/analytics/summary` | Dashboard analytics |
| GET/POST | `/api/admin/pending-questions` | List/resolve pending questions |
| CRUD | `/api/admin/faqs` | Manage FAQs |
| CRUD | `/api/admin/categories` | Manage categories |
| CRUD | `/api/admin/users` | Manage users |
| GET/POST | `/api/admin/community/questions` | Moderate community questions |
| GET/POST | `/api/admin/community/answers` | Moderate community answers |
| GET/PATCH | `/api/admin/community/reports` | Handle community reports |
| GET | `/api/admin/community/review-queue` | Review queue |
| POST | `/api/admin/faq-fallback` | FAQ fallback actions |

**AI Endpoints (internal, proxied to RAG or self-contained):**
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/ai/generate-community-summary` | Generate community summary |
| POST | `/api/ai/review-community-answer` | Review answer safety/relevance |
| POST | `/api/ai/resolve-assistant` | AI-assisted question resolution |

---

## Frontend Components

| Component | Description |
|-----------|-------------|
| `Header.tsx` | Navigation header with role-based admin link |
| `SearchBar.tsx` | Search bar with voice input (Web Speech API) |
| `CategoryFilter.tsx` | Horizontal scrollable category pills |
| `FAQCard.tsx` | Expandable FAQ card |
| `FAQReply.tsx` | FAQ reply display |
| `FAQSuggestionBox.tsx` | Smart suggestion box for duplicate detection |
| `YakshaChat.tsx` | Floating AI chat assistant |
| `AuthProviderWrapper.tsx` | Auth context provider wrapper |

**Subcomponents:** `admin/` (AdminSidebar, AdminTopBar, DataTable, StatCard), `auth/` (AuthCard, AuthInput), `community/` (StatusBadge), `ui/` (18 shadcn-style components)

---

## Data Models (MongoDB / Mongoose)

| Model | Collection | Key Fields |
|-------|-----------|------------|
| `FAQ` | `faqs` | id, question, answer, category, categoryId, tags, helpful/notHelpful, isPublished, version, resolvedFrom |
| `Category` | `categories` | id, name, icon, description, count |
| `PendingQuestion` | `pending_questions` | question, category, email, priority, status, source, faqSuggestionStatus, authorRole, replies[] |
| `User` | `users` | Authentication model |
| `AdminUser` | `admin_users` | email, passwordHash, role (admin/super_admin) |
| `CommunityQuestion` | `community_questions` | institutionId, authorStudentId, title, body, normalizedTitle, questionHash, tags, status, ragValidation, voteScore, approvedAnswerCount |
| `CommunityAnswer` | `community_answers` | questionId, authorId, content, citations, status, review, moderation |
| `CommunityQuestionSummary` | `community_question_summaries` | questionId, summary, sources, model, version |
| `CommunityVote` | `community_votes` | answerId, voterId, vote (up/down) |
| `CommunityReport` | `community_reports` | answerId, reportedBy, reason, status |
| `FAQReply` | `faq_replies` | faqId, content, author, status |
| `ChatSession` | `chat_sessions` | messages[], userId, context |

---

## RAG Service (rag-service)

### FastAPI Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with chunk count |
| `/query` | POST | Full RAG pipeline: embed → retrieve from ChromaDB → build prompt → generate with Gemini → return answer + sources |
| `/search` | GET | Pure vector search (no LLM), returns raw chunks |
| `/validate-question` | POST | Moderates a submitted question via Gemini, writes verdict to MongoDB |
| `/validate-reply` | POST | Moderates a community reply for safety/malpractice |
| `/generate-answer` | POST | AI helper bot: retrieves RAG context + DuckDuckGo web search → generates grounded answer |

### Pipeline Steps
1. **parser.py** — Scrapes samagama.in/internship and /internship/faq → parses HTML → outputs `raw_documents.json`
2. **chunk.py** — Reads `raw_documents.json` → splits into chunks (400 tokens, 60-token overlap) → outputs `chunks.json`
3. **embed_and_store.py** — Reads `chunks.json` → embeds with `gemini-embedding-001` → stores in ChromaDB collection `samagama_internship`
4. **rag_api.py** — FastAPI server exposing endpoints using ChromaDB for RAG querying

### RAG Configuration
- Embedding model: `gemini-embedding-001`
- Generation model: `gemini-3.1-flash-lite`
- ChromaDB collection: `samagama_internship`
- Top-K retrieval: 5 chunks
- Temperature: 0.1 (factual), 0.0 (moderation)

---

## Docker Services

| Service | Technology | Purpose | Port |
|---------|-----------|---------|------|
| `frontend` | Next.js 16 | Main web application | 3000 |
| `backend` | FastAPI | AI/RAG API | 8000 |
| `chromadb` | chromadb/chroma:0.5.15 | Vector database | 8001 |
| `mongodb` | mongo:7.0.5 | Document database | 27017 |

All services share an `app-network` bridge with health checks and persistent volumes (`chroma-data`, `mongodb-data`).

---

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB 7.0 (local or Docker)
- Python 3.11+ (for RAG service)
- Google Gemini API key

### Environment Setup

Copy `.env.example` to `.env.local` in `faq-web/` and configure:

```env
MONGODB_URI=mongodb://localhost:27017/samagama
GEMINI_API_KEY=your_gemini_api_key
ADMIN_SECRET_KEY=your_admin_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run with Docker (recommended)

```bash
docker compose up --build
```

### Run locally

**Frontend:**
```bash
cd faq-web
npm install
npm run dev
```

**RAG service:**
```bash
cd rag-service/RAG_pipeline
pip install -r requirements.txt
python rag_api.py
```

---

## Project Structure

```
cs37/
├── faq-web/                    # Next.js 16 application
│   ├── app/                    # Pages + API routes (App Router)
│   │   ├── page.tsx            # FAQ homepage
│   │   ├── overview/           # Programme overview
│   │   ├── ask/                # Ask question
│   │   ├── resolve/            # Admin resolve panel
│   │   ├── community/          # Community Q&A
│   │   ├── auth/               # Sign in / Sign up
│   │   ├── admin/              # Admin panel (dashboard, FAQs, categories, users, community)
│   │   └── api/                # Route handlers (faqs, auth, community, admin, ai)
│   ├── src/
│   │   ├── components/         # React components (Header, SearchBar, FAQCard, etc.)
│   │   ├── context/            # Auth context
│   │   ├── lib/                # Utilities, MongoDB, auth, JWT, AI client
│   │   ├── models/             # Mongoose schemas (FAQ, Category, User, etc.)
│   │   └── data/               # Static data
│   ├── package.json
│   ├── README.md
│   ├── PRD.md                  # Product Requirements Document
│   ├── QA_FEATURE.md           # Community Q&A spec
│   ├── DATA.md                 # FAQ data content
│   ├── PROGRESS.md             # Development progress
│   └── AGENTS.md               # Next.js version notes
├── rag-service/                # Python RAG backend
│   ├── RAG_pipeline/
│   │   ├── rag_api.py          # FastAPI server (6 endpoints)
│   │   ├── embed_and_store.py  # Embedding + ChromaDB storage
│   │   ├── chunk.py            # Document chunking
│   │   ├── parser.py           # HTML scraping + parsing
│   │   ├── Dockerfile          # Multi-stage build
│   │   ├── requirements.txt
│   │   └── data/               # raw_documents.json, chunks.json, raw_html/
│   ├── PRD.MD                  # PRD (same as faq-web)
│   └── IDEAS.md                # Future feature ideas
├── docker-compose.yml          # 4-service orchestration
├── .env.example
├── INTEGRATION_AUDIT_REPORT.md # Frontend-RAG integration audit
├── start.sh                    # Startup script
└── LICENSE                     # MIT
```

---

## License

MIT
