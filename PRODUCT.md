# Samagama FAQ Portal — CrowdSource FAQ (cs37)

An AI-powered FAQ and community Q&A platform built for the **Vicharanashala Internship Programme** at **IIT Ropar**.

---

## Overview

Samagama is a dual-purpose platform:

1. **FAQ Portal** — Browse, search, and vote on FAQs about the Vicharanashala internship programme. FAQs are enriched with AI-generated suggestions, duplicate detection, and category-based filtering.

2. **Community Q&A** — Students can ask questions, get answers from peers and AI, vote, report, and engage in threaded discussions — all moderated by an LLM safety layer.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16.2.6, React 19.2.4, TypeScript 5, Tailwind CSS 4 |
| **Backend API** | Next.js Route Handlers (Node.js), Mongoose 9 |
| **AI/RAG** | FastAPI (Python), Google Gemini, ChromaDB (vector store) |
| **Database** | MongoDB 7.0 |
| **UI** | Framer Motion, Lucide icons, Recharts, shadcn/ui |
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
2. Next.js API route persists it to MongoDB
3. A background call fires to the FastAPI RAG backend for:
   - **Validation**: Gemini checks question safety, relevance, and academic integrity
   - **Answer generation**: RAG retrieves relevant context from ChromaDB + DuckDuckGo web search, then Gemini generates a grounded answer
4. Community answers are also moderated through `/validate-reply`
5. All FAQs, questions, and answers are searchable via Fuse.js (client-side) or vector search (ChromaDB)

---

## Features

### User Features
- **FAQ Browsing** — Search, filter by category, expand/collapse cards, vote helpful/not helpful
- **Ask Questions** — Form with real-time duplicate detection; questions go to admin for review
- **Community Q&A** — Post questions, answer, vote, report, threaded replies
- **AI Chat Assistant** — Yaksha Chat floating widget on all pages
- **Voice Search** — Speech-to-text in the search bar
- **Overview** — Programme details page

### Admin Features
- **Dashboard** — Analytics, stats, recent activity
- **Pending Questions** — Review, resolve, or reject user questions
- **FAQ Management** — CRUD operations for FAQs and categories
- **Community Moderation** — Review questions, answers, and reports
- **User Management** — Manage user accounts
- **AI Resolve Assistant** — AI-suggested answers with RAG fallback + FAQ keyword search

### AI / RAG Pipeline
- Document scraping from samagama.in
- Chunking with sliding window (400-token target, 60-token overlap)
- Embedding via `gemini-embedding-001` stored in ChromaDB
- Generation via `gemini-3.1-flash-lite`
- Grounded answers with source citations
- DuckDuckGo web search fallback

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | FAQ browsing with search, filters, cards, stats |
| `/overview` | Programme overview |
| `/ask` | Ask a question with duplicate detection |
| `/resolve` | Admin resolve panel with AI suggestions |
| `/community` | Community Q&A feed |
| `/community/[id]` | Individual question thread |
| `/community/my` | My contributions |
| `/auth/signin` | Sign in |
| `/auth/signup` | Sign up |
| `/admin` | Admin panel |
| `/admin/dashboard` | Analytics dashboard |
| `/admin/faqs` | FAQ management |
| `/admin/categories` | Category management |
| `/admin/users` | User management |
| `/admin/community/*` | Community moderation hub |

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

This starts all 4 services: frontend (3000), backend RAG API (8000), ChromaDB (8001), MongoDB (27017).

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
├── faq-web/                    # Next.js application
│   ├── app/                    # Pages + API routes (App Router)
│   │   ├── page.tsx            # FAQ homepage
│   │   ├── overview/           # Programme overview
│   │   ├── ask/                # Ask question
│   │   ├── resolve/            # Admin resolve panel
│   │   ├── community/          # Community Q&A
│   │   ├── auth/               # Sign in / Sign up
│   │   ├── admin/              # Admin panel
│   │   └── api/                # API route handlers
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── context/            # Auth context
│   │   ├── lib/                # Utilities, DB, auth, AI client
│   │   ├── models/             # Mongoose schemas
│   │   └── data/               # Static data
│   └── package.json
├── rag-service/                # Python RAG backend
│   └── RAG_pipeline/
│       ├── rag_api.py          # FastAPI server
│       ├── embed_and_store.py  # Embedding pipeline
│       ├── chunk.py            # Document chunking
│       ├── parser.py           # HTML scraping
│       └── requirements.txt
├── docker-compose.yml          # Multi-service orchestration
└── README.md
```

---

## License

MIT
