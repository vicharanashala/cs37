"""
rag_api.py
────────────────────────────────────────────────────────────────────────────
FastAPI RAG Query Endpoint  +  Feature Modules
────────────────────────────────────────────────────────────────────────────

Run:
  uvicorn rag_api:app --reload --port 8000

Core Endpoints:
  POST /query          ->  RAG: retrieve chunks + generate answer with Gemini
  GET  /search         ->  Pure vector search (no LLM, returns raw chunks)
  GET  /health         ->  Health check

New Feature Endpoints:
  POST   /questions                            -> Submit a question
  GET    /questions                            -> List questions (filter by status)
  GET    /questions/{question_id}              -> Get single question
  PATCH  /questions/{question_id}/status       -> Update question status (admin)
  PATCH  /questions/{question_id}/answer       -> Answer a question (admin)
  POST   /questions/{question_id}/promote      -> Promote to FAQ (admin)
  GET    /questions/stats                      -> Question counts by status

  POST   /votes                                -> Cast a vote
  GET    /votes/{target_id}                    -> Get vote counts
  GET    /votes/{target_id}/helpfulness        -> Get helpfulness score
  POST   /suggestions                          -> Submit an answer suggestion
  GET    /suggestions/{question_id}            -> List suggestions for a question
  PATCH  /suggestions/{suggestion_id}/status   -> Approve/reject suggestion (admin)

  GET    /admin/stats                          -> Full dashboard statistics
  GET    /admin/repeated                       -> Most repeated questions
  GET    /admin/categories                     -> Category breakdown
  GET    /admin/users                          -> User activity
  GET    /admin/pending                        -> Pending review queue
  GET    /admin/faq-usefulness                 -> FAQ usefulness scores
  POST   /admin/assign-moderator               -> Assign moderator
  POST   /admin/merge                          -> Merge duplicate questions

  GET    /analytics/stats                      -> Complete analytics summary
  GET    /analytics/questions-per-day          -> Time-series data
  GET    /analytics/peak-hours                 -> Peak activity heatmap
  GET    /analytics/top-searches               -> Most searched terms
  GET    /analytics/categories                 -> Category distribution
  GET    /analytics/unanswered                 -> Unanswered query count

  GET    /recommendations                      -> Personalised recommendations
  GET    /recommendations/popular              -> Most popular FAQs
  GET    /recommendations/trending             -> Trending FAQs
  GET    /recommendations/category/{category}  -> FAQs by category
  GET    /recommendations/related/{faq_id}     -> Related FAQs
  POST   /recommendations/view                 -> Record a FAQ view

  GET    /notifications                        -> Get user notifications
  PATCH  /notifications/{id}/read              -> Mark notification as read
  PATCH  /notifications/mark-all-read          -> Mark all as read
  GET    /notifications/unread-count           -> Get unread count
  GET    /notifications/preferences            -> Get preferences
  PATCH  /notifications/preferences            -> Update preferences
  POST   /notifications/send                   -> Send notification (admin)
"""

import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel

# ── Feature module imports ────────────────────────────────────────────────────

from question_tracker import (
    QuestionCreate,
    QuestionOut,
    QuestionStatus,
    question_store,
)
from voting import (
    SuggestionCreate,
    SuggestionOut,
    VoteCreate,
    VoteOut,
    suggestion_store,
    vote_store,
)
from analytics import QueryEvent, analytics_store
from recommendations import RecommendationRequest, rec_engine
from admin_dashboard import MergeRequest, admin_dashboard
from notifications import (
    NotificationCreate,
    NotificationOut,
    notification_store,
)

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv()

GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")
EMBEDDING_MODEL  = "gemini-embedding-001"
GENERATION_MODEL = "gemini-2.0-flash-lite"   # fast + free tier
COLLECTION_NAME  = "samagama_internship"
CHROMA_PATH      = "./chroma_db"

TOP_K            = 5   # number of chunks to retrieve per query

# ── App state (loaded once at startup) ───────────────────────────────────────

app_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load Gemini client and ChromaDB collection once on startup."""
    if not GEMINI_API_KEY:
        raise EnvironmentError("GEMINI_API_KEY not set in .env")

    app_state["gemini"]     = genai.Client(api_key=GEMINI_API_KEY)
    app_state["collection"] = (
        chromadb.PersistentClient(
            path     = CHROMA_PATH,
            settings = Settings(anonymized_telemetry=False),
        ).get_collection(COLLECTION_NAME)
    )
    count = app_state["collection"].count()
    print(f"[OK] ChromaDB loaded - {count} chunks in '{COLLECTION_NAME}'")
    yield
    app_state.clear()


app = FastAPI(
    title      = "Samagama Internship RAG API  +  Feature Modules",
    version    = "2.0.0",
    lifespan   = lifespan,
    description= (
        "ViBe_RAG: AI-powered FAQ assistant with Question Tracking, "
        "Crowd Voting, Admin Dashboard, Analytics, Recommendations & Notifications."
    ),
)

# Allow your MERN frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["http://localhost:3000", "http://localhost:5173"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# ── Pydantic schemas (RAG core) ───────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = TOP_K


class SourceDoc(BaseModel):
    title:   str
    section: str
    url:     str
    score:   float
    snippet: str


class QueryResponse(BaseModel):
    answer:  str
    sources: list[SourceDoc]


class SearchResponse(BaseModel):
    results: list[SourceDoc]

# ── Helpers (RAG core) ────────────────────────────────────────────────────────

def embed_query(question: str) -> list[float]:
    """Embed a user question using RETRIEVAL_QUERY task type."""
    resp = app_state["gemini"].models.embed_content(
        model    = f"models/{EMBEDDING_MODEL}",
        contents = [question],
        config   = types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
    )
    return resp.embeddings[0].values


def retrieve(question: str, top_k: int) -> list[dict]:
    """Vector search ChromaDB and return top_k chunks with metadata."""
    q_vec   = embed_query(question)
    results = app_state["collection"].query(
        query_embeddings = [q_vec],
        n_results        = top_k,
        include          = ["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "content": doc,
            "title":   meta["title"],
            "section": meta["section"],
            "url":     meta["url"],
            "score":   round(1 - dist, 4),   # convert distance -> similarity
        })
    return chunks


def build_prompt(question: str, chunks: list[dict]) -> str:
    """
    Build the RAG prompt: inject retrieved chunks as context.
    Instructs Gemini to answer ONLY from the provided context.
    """
    context_blocks = []
    for i, chunk in enumerate(chunks):
        context_blocks.append(
            f"[Source {i+1}: {chunk['title']}]\n{chunk['content']}"
        )
    context = "\n\n---\n\n".join(context_blocks)

    return f"""You are a helpful assistant for the Vicharanashala Internship programme at IIT Ropar.
Answer the user's question using ONLY the context provided below.
If the answer is not in the context, say: "I don't have information about that. Please contact support via the Yaksha chat at samagama.in."
Be concise, friendly, and accurate. Do not make up information.

CONTEXT:
{context}

QUESTION: {question}

ANSWER:"""


def generate_answer(prompt: str) -> str:
    """Call Gemini to generate an answer from the RAG prompt."""
    response = app_state["gemini"].models.generate_content(
        model    = GENERATION_MODEL,
        contents = prompt,
        config   = types.GenerateContentConfig(
            temperature      = 0.1,   # low temp = factual, less creative
            max_output_tokens= 512,
        ),
    )
    return response.text.strip()

# ── Routes: RAG Core ──────────────────────────────────────────────────────────

@app.get("/health", tags=["Core"])
def health():
    count = app_state["collection"].count()
    return {
        "status":     "ok",
        "collection": COLLECTION_NAME,
        "chunks":     count,
        "version":    "2.0.0",
    }


@app.post("/query", response_model=QueryResponse, tags=["Core"])
def rag_query(req: QueryRequest):
    """
    Full RAG pipeline:
      1. Embed the question
      2. Retrieve top_k relevant chunks from ChromaDB
      3. Build a prompt with the chunks as context
      4. Generate an answer with Gemini
      5. Return answer + source citations
      6. Log the event to analytics
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    start_ms = int(time.time() * 1000)

    # Retrieve
    chunks = retrieve(req.question, req.top_k)

    if not chunks:
        analytics_store.log_query_event(QueryEvent(
            question        = req.question,
            category        = "general",
            response_time_ms= int(time.time() * 1000) - start_ms,
            was_answered    = False,
            source          = "rag",
        ))
        return QueryResponse(
            answer  = "No relevant information found in the knowledge base.",
            sources = [],
        )

    # Generate
    prompt = build_prompt(req.question, chunks)
    answer = generate_answer(prompt)

    # Log to analytics
    analytics_store.log_query_event(QueryEvent(
        question        = req.question,
        category        = "general",
        response_time_ms= int(time.time() * 1000) - start_ms,
        was_answered    = True,
        source          = "rag",
    ))

    # Build source citations  (deduplicate by URL)
    seen_urls = set()
    sources   = []
    for chunk in chunks:
        if chunk["url"] not in seen_urls:
            seen_urls.add(chunk["url"])
            sources.append(SourceDoc(
                title   = chunk["title"],
                section = chunk["section"],
                url     = chunk["url"],
                score   = chunk["score"],
                snippet = chunk["content"][:200] + "...",
            ))

    return QueryResponse(answer=answer, sources=sources)


@app.get("/search", response_model=SearchResponse, tags=["Core"])
def vector_search(q: str, top_k: int = TOP_K):
    """
    Pure vector search - returns raw chunks without LLM generation.
    Useful for debugging retrieval quality.
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query 'q' cannot be empty")

    chunks = retrieve(q, top_k)
    results = [
        SourceDoc(
            title   = c["title"],
            section = c["section"],
            url     = c["url"],
            score   = c["score"],
            snippet = c["content"][:200] + "...",
        )
        for c in chunks
    ]
    return SearchResponse(results=results)


# ── Routes: Question Tracking ─────────────────────────────────────────────────

@app.post("/questions", response_model=QuestionOut, tags=["Questions"])
def submit_question(data: QuestionCreate):
    """Submit a new student question. Status starts as 'pending'."""
    return question_store.submit_question(data)


@app.get("/questions/stats", tags=["Questions"])
def question_stats():
    """Return counts of questions grouped by status."""
    return question_store.get_stats()


@app.get("/questions", response_model=list[QuestionOut], tags=["Questions"])
def list_questions(status: Optional[str] = None, limit: int = 50):
    """List questions, optionally filtered by status (pending/under_review/answered/added_to_faq)."""
    return question_store.list_questions(status=status, limit=limit)


@app.get("/questions/{question_id}", response_model=QuestionOut, tags=["Questions"])
def get_question(question_id: str):
    """Get a single question by ID including full status history."""
    try:
        return question_store.get_question(question_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


class StatusUpdateRequest(BaseModel):
    new_status:  str
    reviewer_id: Optional[str] = None

@app.patch("/questions/{question_id}/status", response_model=QuestionOut, tags=["Questions"])
def update_question_status(question_id: str, body: StatusUpdateRequest):
    """Update question status (admin/moderator action)."""
    try:
        return question_store.update_status(question_id, body.new_status, body.reviewer_id)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


class AnswerRequest(BaseModel):
    answer_text: str
    answered_by: str

@app.patch("/questions/{question_id}/answer", response_model=QuestionOut, tags=["Questions"])
def answer_question(question_id: str, body: AnswerRequest):
    """Provide an answer and move the question to 'answered' state."""
    try:
        q = question_store.answer_question(question_id, body.answer_text, body.answered_by)
        # Auto-notify the user
        from notifications import notify_question_answered
        notify_question_answered(question_id, q.user_id, body.answer_text[:100])
        return q
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/questions/{question_id}/promote", response_model=QuestionOut, tags=["Questions"])
def promote_to_faq(question_id: str):
    """Promote an answered question to official FAQ status."""
    try:
        return question_store.promote_to_faq(question_id)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Routes: Crowd Voting ──────────────────────────────────────────────────────

@app.post("/votes", response_model=VoteOut, tags=["Voting"])
def cast_vote(data: VoteCreate):
    """Cast or update a vote (upvote/downvote/helpful/not_helpful) on a target."""
    return vote_store.cast_vote(data)


@app.get("/votes/{target_id}", tags=["Voting"])
def get_votes(target_id: str):
    """Get aggregated vote counts for any target (question, answer, suggestion)."""
    return vote_store.get_votes(target_id)


@app.get("/votes/{target_id}/helpfulness", tags=["Voting"])
def get_helpfulness(target_id: str):
    """Get usefulness score for a target: (upvotes + helpful) / total_votes."""
    score = vote_store.get_helpfulness(target_id)
    return {"target_id": target_id, "helpfulness_score": score}


@app.post("/suggestions", response_model=SuggestionOut, tags=["Voting"])
def submit_suggestion(data: SuggestionCreate):
    """Submit a better-answer suggestion for a question."""
    return suggestion_store.submit_suggestion(data)


@app.get("/suggestions/{question_id}", response_model=list[SuggestionOut], tags=["Voting"])
def get_suggestions(question_id: str):
    """List all community suggestions for a question, newest first."""
    return suggestion_store.get_suggestions(question_id)


class SuggestionStatusUpdate(BaseModel):
    status: str  # approved | rejected

@app.patch("/suggestions/{suggestion_id}/status", response_model=SuggestionOut, tags=["Voting"])
def update_suggestion_status(suggestion_id: str, body: SuggestionStatusUpdate):
    """Approve or reject a suggestion (admin/moderator)."""
    try:
        return suggestion_store.update_suggestion_status(suggestion_id, body.status)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Routes: Admin Dashboard ───────────────────────────────────────────────────

@app.get("/admin/stats", tags=["Admin Dashboard"])
def admin_stats():
    """Full dashboard stats: questions, votes, suggestions, queries aggregated."""
    return admin_dashboard.get_dashboard_stats()


@app.get("/admin/repeated", tags=["Admin Dashboard"])
def top_repeated(limit: int = 10):
    """Most repeated/similar questions grouped by normalised text."""
    return admin_dashboard.get_top_repeated(limit=limit)


@app.get("/admin/categories", tags=["Admin Dashboard"])
def category_breakdown():
    """Question count per category."""
    return admin_dashboard.get_category_breakdown()


@app.get("/admin/users", tags=["Admin Dashboard"])
def user_activity(limit: int = 20):
    """Top users ranked by number of submitted questions."""
    return admin_dashboard.get_user_activity(limit=limit)


@app.get("/admin/pending", tags=["Admin Dashboard"])
def pending_reviews():
    """All questions currently in 'pending' or 'under_review' status."""
    return admin_dashboard.get_pending_reviews()


@app.get("/admin/faq-usefulness", tags=["Admin Dashboard"])
def faq_usefulness():
    """FAQ items with their community vote scores."""
    return admin_dashboard.get_faq_usefulness()


class AssignModeratorRequest(BaseModel):
    question_id:  str
    moderator_id: str

@app.post("/admin/assign-moderator", tags=["Admin Dashboard"])
def assign_moderator(body: AssignModeratorRequest):
    """Assign a moderator to a question and move it to 'under_review'."""
    return admin_dashboard.assign_moderator(body.question_id, body.moderator_id)


@app.post("/admin/merge", tags=["Admin Dashboard"])
def merge_questions(body: MergeRequest):
    """Merge duplicate questions into one canonical question."""
    return admin_dashboard.merge_questions(body)


# ── Routes: Analytics ─────────────────────────────────────────────────────────

@app.get("/analytics/stats", tags=["Analytics"])
def analytics_stats():
    """Complete analytics summary: all metrics in one call."""
    return analytics_store.get_stats()


@app.get("/analytics/questions-per-day", tags=["Analytics"])
def questions_per_day(from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Time-series of question counts per day. Filter with from_date/to_date (YYYY-MM-DD)."""
    return analytics_store.get_questions_per_day(from_date=from_date, to_date=to_date)


@app.get("/analytics/peak-hours", tags=["Analytics"])
def peak_hours():
    """Query counts grouped by hour of day (0–23) for heatmap charts."""
    return analytics_store.get_peak_hours()


@app.get("/analytics/top-searches", tags=["Analytics"])
def top_searches(limit: int = 20):
    """Most frequently asked questions (top search terms)."""
    return analytics_store.get_top_searches(limit=limit)


@app.get("/analytics/categories", tags=["Analytics"])
def analytics_categories():
    """Category distribution with counts and percentages."""
    return analytics_store.get_category_distribution()


@app.get("/analytics/unanswered", tags=["Analytics"])
def unanswered_count():
    """Count of queries that returned no answer from the knowledge base."""
    return {"unanswered_count": analytics_store.get_unanswered_count()}


# ── Routes: Recommendations ───────────────────────────────────────────────────

@app.get("/recommendations", tags=["Recommendations"])
def get_recommendations(user_id: str, category: Optional[str] = None, limit: int = 10):
    """Personalised FAQ recommendations for a user (trending + category + popular blend)."""
    return rec_engine.get_recommendations(user_id=user_id, category=category, limit=limit)


@app.get("/recommendations/popular", tags=["Recommendations"])
def popular_faqs(limit: int = 10):
    """Most-viewed FAQs overall."""
    return rec_engine.get_popular(limit=limit)


@app.get("/recommendations/trending", tags=["Recommendations"])
def trending_faqs(hours: int = 24, limit: int = 10):
    """FAQs with the highest view surge in the last N hours."""
    return rec_engine.get_trending(hours=hours, limit=limit)


@app.get("/recommendations/category/{category}", tags=["Recommendations"])
def faqs_by_category(category: str, limit: int = 10):
    """Most-viewed FAQs within a specific category (joining/exam/hostel/certificate)."""
    return rec_engine.get_by_category(category=category, limit=limit)


@app.get("/recommendations/related/{faq_id}", tags=["Recommendations"])
def related_faqs(faq_id: str, limit: int = 5):
    """FAQs frequently asked alongside this one ('users also asked')."""
    return rec_engine.get_related(faq_id=faq_id, limit=limit)


class FaqViewRequest(BaseModel):
    user_id:  str
    faq_id:   str
    category: str = "general"

@app.post("/recommendations/view", tags=["Recommendations"])
def record_faq_view(body: FaqViewRequest):
    """Record that a user viewed a FAQ (updates recommendation signals)."""
    rec_engine.record_faq_view(body.user_id, body.faq_id, body.category)
    return {"recorded": True, "faq_id": body.faq_id, "user_id": body.user_id}


# ── Routes: Notifications ─────────────────────────────────────────────────────

@app.get("/notifications", response_model=list[NotificationOut], tags=["Notifications"])
def get_notifications(user_id: str, unread_only: bool = False):
    """Get all notifications for a user, optionally filtered to unread only."""
    return notification_store.get_notifications(user_id=user_id, unread_only=unread_only)


@app.get("/notifications/unread-count", tags=["Notifications"])
def unread_count(user_id: str):
    """Get the count of unread notifications for a user."""
    return {"user_id": user_id, "unread_count": notification_store.get_unread_count(user_id)}


@app.patch("/notifications/{notification_id}/read", response_model=NotificationOut, tags=["Notifications"])
def mark_notification_read(notification_id: str):
    """Mark a single notification as read."""
    try:
        return notification_store.mark_read(notification_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


class MarkAllReadRequest(BaseModel):
    user_id: str

@app.patch("/notifications/mark-all-read", tags=["Notifications"])
def mark_all_notifications_read(body: MarkAllReadRequest):
    """Mark all notifications for a user as read."""
    count = notification_store.mark_all_read(body.user_id)
    return {"user_id": body.user_id, "marked_read": count}


@app.get("/notifications/preferences", tags=["Notifications"])
def get_notification_preferences(user_id: str):
    """Get notification preferences for a user."""
    return notification_store.get_preferences(user_id)


@app.patch("/notifications/preferences", tags=["Notifications"])
def update_notification_preferences(user_id: str, prefs: dict):
    """Update notification preferences for a user."""
    return notification_store.update_preferences(user_id, prefs)


@app.post("/notifications/send", response_model=NotificationOut, tags=["Notifications"])
def send_notification(data: NotificationCreate):
    """Send a notification to a user (admin/system use)."""
    return notification_store.send_notification(data)
