# Samagama FAQ Portal

An AI-powered FAQ and Community Q&A platform for the **Vicharanashala Internship Programme at IIT Ropar**, serving 600+ interns with instant answers and peer-to-peer knowledge sharing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Database | MongoDB (native driver + Mongoose) |
| AI/RAG | FastAPI + Gemini (embeddings + generation), ChromaDB |
| Search | Fuse.js (fuzzy client-side), MongoDB text index |
| Auth | JWT (students), cookie-based sessions (admins) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |

---

## Features

### Student Side

- **FAQ Browse** — Search with fuzzy matching, category filtering, expand/collapse, upvote/downvote
- **Ask a Question** — Submit questions with category, email, priority. Real-time duplicate detection shows similar already-answered questions
- **Yaksha AI Chat** — Floating chatbot powered by RAG. Answers from the FAQ knowledge base, shows source citations and confidence scores. Low-confidence responses prompt submission for admin review
- **Voice Search** — Ask questions by speaking via Web Speech API
- **Community Q&A** — Browse, search, sort (recent/most answered/unanswered/trending) community questions with replies
- **Answer & Vote** — Submit answers (AI-reviewed), upvote/downvote, report with reasons
- **My Contributions** — Track all your questions and answers with approval status
- **Profile** — View avatar, stats, and contribution history

### Admin Side

- **Admin Dashboard** — Overview stats, moderation queue, recent activity
- **Question Resolution** — Filter (All/Pending/Urgent/Rejected), answer, reject, or promote questions to FAQ
- **AI Suggest Reply** — Get keyword-matched suggested answers from the FAQ database (no paid APIs)
- **Live FAQs** — View, edit/rewrite, delete, and manage all FAQs with version tracking
- **Community Review** — Approve, rewrite (admin attribution), or reject student replies with AI pre-review scores
- **Manual FAQ** — Create FAQ entries directly
- **Category Management** — Create, edit, delete FAQ categories
- **User Management** — Manage admin users with roles (super_admin/admin/moderator)

### AI Pipeline

- **RAG Question Validation** — Every submitted question is validated against institutional knowledge
- **Auto Bot Reply** — AI-generated answers auto-attach to approved questions
- **Community Answer Review** — Safety, relevance, policy grounding, and academic integrity checks
- **Summary Synthesis** — AI-generated summaries separating official notes from student tips

---

## Project Structure

```
faq-web/
├── app/
│   ├── page.tsx                    # FAQ browse page
│   ├── ask/page.tsx                # Ask a question
│   ├── community/                  # Community Q&A
│   │   ├── page.tsx                # Community home
│   │   ├── [questionId]/page.tsx   # Question detail
│   │   └── my/page.tsx             # My contributions
│   ├── overview/page.tsx           # Programme overview
│   ├── resolve/page.tsx            # Student profile
│   ├── auth/                       # Sign in / Sign up
│   ├── admin/
│   │   ├── page.tsx                # Admin panel (5 tabs)
│   │   ├── login/page.tsx          # Admin login
│   │   ├── dashboard/page.tsx      # Admin dashboard
│   │   ├── faqs/page.tsx           # FAQ management
│   │   ├── categories/page.tsx     # Category management
│   │   └── users/page.tsx          # User management
│   └── api/                        # API routes
│       ├── faqs/                   # FAQ CRUD
│       ├── ask/                    # Question submission
│       ├── community/              # Community Q&A
│       ├── admin/                  # Admin APIs
│       ├── ai/                     # AI services
│       └── questions/              # AI suggest
├── src/
│   ├── components/                 # React components
│   ├── models/                     # Mongoose models
│   ├── lib/                        # Utilities, auth, AI, community
│   └── data/                       # Static data
rag-service/
├── RAG_pipeline/
│   ├── rag_api.py                  # FastAPI RAG endpoints
│   ├── embed_and_store.py          # ChromaDB embedding script
│   ├── chunk.py                    # Document chunking
│   └── data/                       # Raw documents + chunks
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB Atlas (or local)
- Gemini API key

### Installation

```bash
# Clone the repo
git clone https://github.com/vicharanashala/cs37.git
cd cs37/faq-web

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your MongoDB URI and Gemini key

# Seed the database
npm run db:seed
npm run db:seed:admin
```

### Running Locally

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: RAG API server
cd rag-service/RAG_pipeline
python -m venv venv
venv/Scripts/pip install -r requirements.txt
venv/Scripts/python embed_and_store.py   # Load knowledge base
uvicorn rag_api:app --host 0.0.0.0 --port 8000
```

Open [http://localhost:3000](http://localhost:3000)

### Admin Access

- **URL:** [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- **Email:** `admin@example.com`
- **Password:** `admin123`

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/faqs` | List published FAQs |
| GET/PUT/DELETE | `/api/faqs/[id]` | FAQ CRUD |
| POST | `/api/ask` | Submit a question |
| POST | `/api/questions/ai-suggest` | AI suggest reply |
| GET | `/api/community/questions` | List community threads |
| POST | `/api/community/questions/[id]/answers` | Submit answer |
| POST | `/api/community/answers/[id]/vote` | Vote on answer |
| POST | `/api/community/answers/[id]/report` | Report answer |
| GET/POST | `/api/admin/pending-questions` | Admin question management |
| POST | `/api/ai/resolve-assistant` | AI resolve assistant |
| POST | `/api/ai/review-community-answer` | AI answer review |
| POST | `/api/ai/generate-community-summary` | AI summary generation |

---

## Database

- **Database:** `samagama`
- **Key Collections:** `faqs`, `categories`, `pending_questions`, `admin_users`, `faq_replies`

### Seeding

```bash
npm run db:seed           # Seed FAQs + categories
npm run db:seed:community # Seed community data
npm run db:seed:admin     # Create admin user
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `COMMUNITY_ADMIN_KEY` | No | Admin key (default: `dev-admin`) |
| `JWT_SECRET` | No | JWT secret (default: `dev-secret`) |
| `RAG_API` | No | RAG backend URL (default: `http://localhost:8000`) |

---

## License

Built for the Vicharanashala Internship Programme at IIT Ropar.
