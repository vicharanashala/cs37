# My New Feature Ideas for ViBe_RAG

> **Author:** Raju Kumar
> **Date:** 2026-05-27
> **Branch:** `feature/raju-new-ideas`
> **Status:** Implementation-ready

These ideas extend the existing ViBe_RAG platform (which currently has a RAG pipeline with FAQ parsing, chunking, embedding, and a FastAPI query endpoint) with six new features that enhance user engagement, admin control, and platform intelligence.

---

## 1. Question Status Tracking System

### Goal

Track every student question through a clear lifecycle from submission to FAQ promotion, giving students transparency and admins workflow control.

### Status Lifecycle

```text
  ┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────────┐
  │ 1.Pending │ ──► │ 2.Under      │ ──► │3.Answered│ ──► │ 4.Added to   │
  │           │     │   Review     │     │          │     │    FAQ       │
  └──────────┘     └──────────────┘     └──────────┘     └──────────────┘
```

#### 1.1 Pending
- Question is submitted but nobody has checked yet.
- Example: Student asks now → status = Pending

#### 1.2 Under Review
- Moderator/admin is checking the question.
- Example: They are discussing: "Is late joining allowed?"

#### 1.3 Answered
- Admin has provided an answer.
- Example: "Yes, joining in July is allowed for special cases."
- **User gets a notification** when their question transitions to this state.

#### 1.4 Added to FAQ
- If many people ask the same question, it becomes an official FAQ entry.
- Example:
  - Question: "Can I join late?"
  - Answer: "Yes, joining in July is allowed for special cases."
  - This gets promoted to the FAQ knowledge base for instant retrieval.

### Data Model

```json
{
  "question_id": "q_001",
  "user_id": "user_123",
  "question_text": "Is late joining allowed?",
  "status": "pending",           // pending | under_review | answered | added_to_faq
  "submitted_at": "2026-05-27T08:00:00Z",
  "reviewed_by": null,           // admin/moderator user_id
  "review_started_at": null,
  "answer_text": null,
  "answered_at": null,
  "answered_by": null,
  "faq_id": null,                // set when promoted to FAQ
  "promoted_to_faq_at": null,
  "category": "joining",
  "priority": "normal",          // low | normal | high
  "upvotes": 0,
  "downvotes": 0,
  "similar_question_ids": []
}
```

### API Endpoints

```text
POST   /questions                     → Submit a new question
GET    /questions?status=pending      → List questions by status
GET    /questions/:id                 → Get question details + status
PATCH  /questions/:id/status          → Update status (admin)
PATCH  /questions/:id/answer          → Provide answer (admin)
POST   /questions/:id/promote-to-faq  → Promote to FAQ (admin)
```

### Where to Implement

- New file: `RAG_pipeline/question_tracker.py`
- New endpoints in `rag_api.py`
- In-memory store (dict) for the current simple pipeline
- MongoDB collection `questions` in the planned PRD architecture

---

## 2. Crowd Voting System

### Goal

Let interns/students help improve FAQs through community voting — like Stack Overflow for the knowledge base.

### Features

- **Upvote** useful answers
- **Downvote** confusing or incorrect answers
- **"Was this helpful?"** button on every answer
- **Suggest better answer** — allow users to propose improved answers for admin review

This makes the FAQ system truly crowd-sourced.

### Data Model

```json
{
  "vote_id": "v_001",
  "target_type": "answer",       // "answer" | "faq" | "suggestion"
  "target_id": "q_001",
  "user_id": "user_456",
  "vote_type": "upvote",         // "upvote" | "downvote" | "helpful" | "not_helpful"
  "created_at": "2026-05-27T09:00:00Z"
}
```

```json
{
  "suggestion_id": "s_001",
  "question_id": "q_001",
  "user_id": "user_789",
  "suggested_answer": "Late joining is allowed till July 15th...",
  "status": "pending",           // "pending" | "approved" | "rejected"
  "upvotes": 3,
  "created_at": "2026-05-27T09:30:00Z"
}
```

### API Endpoints

```text
POST   /votes                         → Cast a vote
GET    /questions/:id/votes           → Get vote counts
POST   /questions/:id/suggestions     → Suggest a better answer
GET    /questions/:id/suggestions     → List suggestions
PATCH  /suggestions/:id/status        → Approve/reject suggestion (admin)
GET    /questions/:id/helpfulness     → Get helpfulness stats
```

### Usefulness Score Calculation

```text
usefulness_score = (upvotes + helpful) / (upvotes + downvotes + helpful + not_helpful)
```

Answers with `usefulness_score < 0.5` are flagged for admin review.

### Where to Implement

- New file: `RAG_pipeline/voting.py`
- New endpoints in `rag_api.py`
- In the PRD architecture: `services/api/src/modules/voting/`

---

## 3. Admin Dashboard (VERY IMPORTANT)

### Goal

Admin should be able to manage everything from a single dashboard with full visibility into the system.

### Dashboard Metrics

| Metric | Description |
|--------|-------------|
| Total questions asked | Cumulative count of all student questions |
| Most repeated questions | Top N questions by frequency (clustering) |
| Pending reviews | Questions in `pending` or `under_review` status |
| Top categories | Most active question categories |
| User activity | Daily/weekly active users, questions per user |
| FAQ usefulness analytics | Vote scores, helpfulness rates per FAQ |

### Admin Actions

| Action | Description |
|--------|-------------|
| Approve FAQ | Promote a question+answer to official FAQ |
| Reject FAQ | Mark a suggested FAQ as rejected |
| Merge duplicates | Combine duplicate questions into one canonical entry |
| Edit answers | Modify existing FAQ answers |
| Assign moderator | Assign a moderator to review specific questions |

### API Endpoints

```text
GET    /admin/dashboard/stats         → Aggregate dashboard statistics
GET    /admin/dashboard/questions     → Questions with filters (status, category, date)
GET    /admin/dashboard/top-repeated  → Most repeated questions (clustered)
GET    /admin/dashboard/categories    → Category breakdown
GET    /admin/dashboard/users         → User activity overview
POST   /admin/questions/:id/assign    → Assign moderator
POST   /admin/questions/merge         → Merge duplicate questions
```

### Where to Implement

- New file: `RAG_pipeline/admin_dashboard.py`
- New admin endpoints in `rag_api.py`
- In the PRD architecture: `services/api/src/modules/analytics/` + `apps/admin/`

---

## 4. Analytics Dashboard

### Goal

Visual analytics to impress mentors and provide data-driven insights into platform usage.

### Charts & Metrics

| Chart | Data Source |
|-------|------------|
| Questions/day | Time-series of question submissions |
| Most common categories | Bar chart of category distribution |
| Peak activity time | Heatmap of questions by hour/day |
| Unanswered questions | Count + list of questions without answers |
| Top searched terms | Word cloud or ranked list from queries |

### Technical Implementation

- Use **Chart.js** or **Recharts** on the frontend
- Backend provides pre-aggregated data via API endpoints

### API Endpoints

```text
GET    /analytics/questions-per-day?from=&to=    → Time-series data
GET    /analytics/categories                      → Category distribution
GET    /analytics/peak-hours                      → Activity heatmap data
GET    /analytics/unanswered                      → Unanswered questions list
GET    /analytics/top-searches?limit=20           → Top search terms
GET    /analytics/response-times                  → Average response time trends
```

### Where to Implement

- New file: `RAG_pipeline/analytics.py`
- Analytics endpoints in `rag_api.py`
- In the PRD architecture: `services/api/src/modules/analytics/`

---

## 5. FAQ Recommendation Engine

### Goal

Based on user activity and browsing patterns, recommend relevant FAQs — like Netflix recommendations for knowledge.

### Recommendation Strategies

1. **Category-based**: Show FAQs from the same category the user is browsing
2. **Popular FAQs**: Show most-viewed/upvoted FAQs
3. **Sequential**: "Users who asked X also asked Y"
4. **Lifecycle-based**: Recommend FAQs based on where the student is in their journey:
   - **Before joining**: Admission, eligibility, deadlines
   - **Exam related**: Exam schedule, grading, retakes
   - **Hostel related**: Accommodation, fees, facilities

### Data Model

```json
{
  "recommendation_id": "rec_001",
  "user_id": "user_123",
  "recommended_faqs": [
    {
      "faq_id": "faq_45",
      "reason": "popular_in_category",
      "score": 0.89,
      "category": "joining"
    }
  ],
  "context": "user_browsing_joining_faqs",
  "created_at": "2026-05-27T10:00:00Z"
}
```

### API Endpoints

```text
GET    /recommendations?user_id=&category=    → Get personalized recommendations
GET    /recommendations/popular               → Most popular FAQs
GET    /recommendations/trending              → Trending FAQs (recent surge)
GET    /recommendations/related/:faq_id       → Related FAQs
```

### Where to Implement

- New file: `RAG_pipeline/recommendations.py`
- New endpoints in `rag_api.py`
- In the PRD architecture: could use the memory module to track user activity

---

## 6. Notification System

### Goal

Keep users informed about important updates — their question status changes, FAQ updates, and platform announcements.

### Notification Types

| Type | Trigger | Channel |
|------|---------|---------|
| Question answered | Status → `answered` | In-app + Email |
| FAQ updated | Admin edits an FAQ the user asked about | In-app |
| New announcement | Admin posts internship announcement | In-app + Email |
| Similar question answered | A question similar to yours was answered | In-app |
| Weekly digest | Summary of new FAQs and popular questions | Email |

### Data Model

```json
{
  "notification_id": "n_001",
  "user_id": "user_123",
  "type": "question_answered",
  "title": "Your question has been answered!",
  "message": "Your question about late joining has been answered by an admin.",
  "reference_id": "q_001",
  "reference_type": "question",
  "channel": "in_app",          // "in_app" | "email" | "both"
  "is_read": false,
  "created_at": "2026-05-27T11:00:00Z",
  "read_at": null
}
```

### API Endpoints

```text
GET    /notifications?user_id=&unread=true   → Get notifications
PATCH  /notifications/:id/read               → Mark as read
PATCH  /notifications/mark-all-read          → Mark all as read
POST   /notifications/send                   → Send notification (admin/system)
GET    /notifications/preferences            → Get notification preferences
PATCH  /notifications/preferences            → Update notification preferences
```

### Where to Implement

- New file: `RAG_pipeline/notifications.py`
- New endpoints in `rag_api.py`
- In the PRD architecture: `services/api/src/modules/notifications/`

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 P0 | Admin Dashboard | High | Critical for management |
| 🔴 P0 | Question Status Tracking | Medium | Core workflow |
| 🟡 P1 | Notification System | Medium | User engagement |
| 🟡 P1 | Crowd Voting System | Medium | Quality improvement |
| 🟢 P2 | Analytics Dashboard | Medium | Insights & reporting |
| 🟢 P2 | FAQ Recommendation Engine | High | Advanced personalization |

---

## How These Ideas Integrate with Existing Codebase

### Current State (what exists)
- `parser.py` → Scrapes and cleans institutional FAQ/overview pages
- `chunk.py` → Splits documents into RAG-optimized chunks
- `embed_and_store.py` → Embeds chunks using Gemini and stores in ChromaDB
- `rag_api.py` → FastAPI with `/query`, `/search`, `/health` endpoints
- `IDEAS.md` → Existing ideas (duplicate question detection, auto-clustering, feedback loop, student memory, golden test set)

### Integration Points
1. **Question Status** → Wraps the existing `/query` endpoint flow
2. **Voting** → Adds metadata to query responses
3. **Admin Dashboard** → Aggregates data from questions, votes, and analytics
4. **Analytics** → Logs every query and builds time-series/category data
5. **Recommendations** → Uses FAQ embeddings + user history for suggestions
6. **Notifications** → Triggered by status changes and admin actions

### Complementary to Existing IDEAS.md
- The existing "Previously Asked Question Check Layer" naturally feeds into **Question Status** (a matched question can skip to "answered")
- The existing "Auto FAQ Clustering" feeds into **Admin Dashboard** (showing cluster insights)
- The existing "Answer Quality Feedback Loop" is enhanced by **Crowd Voting** (more signal)
- The existing "Student-Specific Memory" enables better **Recommendations**
