# 🎯 Samagama FAQ Portal 

> AI-powered FAQ portal for the Vicharanashala Internship Programme at IIT Ropar

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)

## ✨ Features

- **🔍 Semantic Search** — Fuzzy search that understands intent, not just keywords
- **🎙️ Voice Search** — Ask questions by speaking (Web Speech API)
- **🤖 Yaksha Chat** — AI-powered assistant that answers from the FAQ knowledge base
- **💡 Smart Duplicate Detection** — Real-time suggestions when asking a question
- **📱 Mobile-First** — Responsive design that works on all devices
- **⚡ Fast** — Static generation + client-side search = instant results
- **🎨 Beautiful UI** — Dark theme with smooth Framer Motion animations
- **👍 Feedback System** — Upvote/downvote answers to improve quality

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Client (Browser)               │
├─────────────────────────────────────────┤
│  FAQ Page → Search + Browse + Filter     │
│  Ask Page → Submit + Duplicate Detection │
│  Resolve Page → Admin Answer Panel       │
│  Yaksha Chat → AI Q&A from FAQ data      │
├─────────────────────────────────────────┤
│  Fuse.js (Client-side fuzzy search)      │
│  Framer Motion (Animations)              │
│  Web Speech API (Voice input)            │
└─────────────────────────────────────────┘
```

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/starfury9/Samagama-FAQ-Portal.git
cd Samagama-FAQ-Portal

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📁 Project Structure

```
samagama-faq-portal/
├── app/
│   ├── page.tsx          # FAQ browsing page
│   ├── ask/page.tsx      # Ask a question page
│   ├── resolve/page.tsx  # Admin resolve page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── src/
│   ├── components/
│   │   ├── Header.tsx         # Navigation header
│   │   ├── SearchBar.tsx      # Search with voice input
│   │   ├── FAQCard.tsx        # Individual FAQ card
│   │   ├── CategoryFilter.tsx # Category filter pills
│   │   └── YakshaChat.tsx     # AI chat assistant
│   ├── data/
│   │   └── faqData.ts         # FAQ content database
│   ├── lib/
│   │   └── utils.ts           # Utility functions
│   └── types/
│       └── speech.d.ts        # Web Speech API types
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts (v4 - via postcss)
```

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 | Framework (App Router, SSG) |
| React 19 | UI Components |
| TypeScript 5 | Type Safety |
| Tailwind CSS 4 | Styling |
| Framer Motion | Animations |
| Fuse.js | Fuzzy Search |
| Lucide React | Icons |
| Web Speech API | Voice Input |

## 📄 Pages

### 1. FAQ Page (`/`)
- Hero search bar with voice input
- Category filter pills (horizontal scroll)
- Expandable FAQ cards with highlighting
- Upvote/downvote feedback
- Share individual FAQ links

### 2. Ask a Question (`/ask`)
- Real-time duplicate detection as you type
- Category selection
- Priority levels (Normal/Urgent)
- Email notification field
- Success confirmation

### 3. Resolve Questions (`/resolve`)
- Admin dashboard with stats
- Filter by status (All/Pending/Urgent)
- AI-suggested answers
- Resolve or reject actions
- Split-panel layout

### 4. Yaksha Chat (floating)
- Available on all pages
- Answers from FAQ knowledge base
- Shows source citations
- Typing indicators
- Conversation history

## 👥 Team

Built as part of the Vicharanashala Internship Programme, IIT Ropar — 2026 Cycle.

## 📜 License

MIT
