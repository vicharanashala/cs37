"""
rag_api.py
────────────────────────────────────────────────────────────────────────────
Step 6: FastAPI RAG Query Endpoint
────────────────────────────────────────────────────────────────────────────

Run:
  uvicorn rag_api:app --reload --port 8000

Endpoints:
  POST /query             ->  RAG: retrieve chunks + generate answer with Gemini
  GET  /search            ->  Pure vector search (no LLM, returns raw chunks)
  POST /validate-question ->  Moderate a submitted question + write verdict to MongoDB
  POST /validate-reply    ->  Moderate a community reply (stateless verdict)
  GET  /health            ->  Health check

Your MERN frontend / backend calls POST /query with:
  { "question": "How do I get the offer letter?" }

And gets back:
  {
    "answer":  "To get your offer letter...",
    "sources": [ { "title": "...", "url": "...", "score": 0.91 }, ... ]
  }
"""

import json
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv()

GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")
MONGODB_URI      = os.getenv("MONGODB_URI")   # same Atlas cluster as the Next.js app
EMBEDDING_MODEL  = "gemini-embedding-001"
GENERATION_MODEL = "gemini-3.1-flash-lite"   # fast + free tier
COLLECTION_NAME  = "samagama_internship"
CHROMA_PATH      = "./chroma_db"

TOP_K            = 5   # number of chunks to retrieve per query

# Where submitted questions live, keyed by their MongoDB ObjectId. The
# /validate-question payload carries no discriminator, so we update both;
# only the collection actually holding the _id matches (the other is a no-op).
QUESTION_COLLECTIONS = [
    ("samagama", "community_questions"),  # unified community Q&A source of truth (where CommunityQuestion model stores)
    ("samagama", "pending_questions"),    # legacy admin-only DB (kept for audit)
    ("RAG_Project", "pending_questions"), # legacy
]

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
        ).get_or_create_collection(COLLECTION_NAME)
    )
    count = app_state["collection"].count()
    print(f"[OK] ChromaDB loaded - {count} chunks in '{COLLECTION_NAME}'")

    # MongoDB is only needed to write back /validate-question verdicts. If the
    # URI is missing we still serve every other endpoint (fail-open on writeback).
    if MONGODB_URI:
        app_state["mongo"] = MongoClient(MONGODB_URI)
        print("[OK] MongoDB client connected")
    else:
        app_state["mongo"] = None
        print("[WARN] MONGODB_URI not set - /validate-question writeback disabled")

    yield

    mongo = app_state.get("mongo")
    if mongo is not None:
        mongo.close()
    app_state.clear()


app = FastAPI(
    title      = "Samagama Internship RAG API",
    version    = "1.0.0",
    lifespan   = lifespan,
)

# Allow your MERN frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["http://localhost:3000", "http://localhost:5173"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# ── Pydantic schemas ──────────────────────────────────────────────────────────

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


class ReplyValidationRequest(BaseModel):
    """Sent by the Next.js backend after a reply is saved to MongoDB."""
    reply_id:  str
    thread_id: str
    content:   str
    question:  Optional[str] = None   # the thread's question, for context


class ReplyValidationResponse(BaseModel):
    """Moderation verdict returned to the Next.js backend."""
    reply_id:   str
    thread_id:  str
    status:     str            # "approved" | "rejected"
    reason:     str
    categories: list[str]
    model:      str


class QuestionValidationRequest(BaseModel):
    """Sent by the Next.js backend after a question is saved to MongoDB."""
    question_id:    str
    question_text:  str
    category:       Optional[str] = None
    institution_id: Optional[str] = None


class QuestionValidationResponse(BaseModel):
    """
    Verdict echoed back to the Next.js backend. The backend ignores this body
    (it relies on the MongoDB writeback); it is returned for curl/tests.
    """
    question_id: str
    status:      str           # "approved" | "rejected"
    reason:      str
    model:       str

# ── Helpers ───────────────────────────────────────────────────────────────────

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


# Allowed violation labels the moderator may emit.
MODERATION_CATEGORIES = [
    "harassment", "hate", "threats", "sexual", "violence", "self_harm",
    "doxxing", "malware", "cheating", "plagiarism", "leak", "credentials",
    "proctoring_bypass", "unofficial_group", "scam", "spam",
]


def _parse_json_verdict(text: str) -> dict:
    """Extract the JSON object from an LLM response, tolerating ``` fences."""
    cleaned = text.strip()
    # Strip ```json ... ``` or ``` ... ``` fences if present.
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    # Fall back to the first {...} block if there is extra prose.
    if not cleaned.startswith("{"):
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if match:
            cleaned = match.group(0)
    return json.loads(cleaned)


def moderate_reply(content: str, question: Optional[str]) -> dict:
    """
    Classify a community reply for malicious content and academic malpractice
    using Gemini. Returns {"status", "reason", "categories"}.
    Raises on LLM / parsing failure so the caller can fail open (stay pending).
    """
    prompt = f"""You are a content-moderation classifier for the student community forum of the \
Vicharanashala internship programme at IIT Ropar. Classify the REPLY below.

Mark decision = "rejected" if the reply contains ANY of:
- Malicious content: harassment, hate speech, threats, violence, sexual content, \
self-harm encouragement, personal data / doxxing, or malware / hacking instructions.
- Malpractice / academic dishonesty: sharing or soliciting exam/quiz answers, cheating, \
plagiarism, leaking confidential or proprietary material, sharing account credentials, \
or instructions to bypass ViBe proctoring.
- Policy violations: soliciting or sharing links to UNOFFICIAL WhatsApp / Telegram / peer \
groups (only official channels are allowed), scams, spam, or advertising.

Otherwise decision = "approved".

Respond with ONLY a JSON object (no markdown, no prose) in exactly this form:
{{"decision": "approved" | "rejected", "reason": "<one short sentence>", "categories": ["<zero or more of: {', '.join(MODERATION_CATEGORIES)}>"]}}

THREAD QUESTION: {question or "(not provided)"}
REPLY: {content}
JSON:"""

    response = app_state["gemini"].models.generate_content(
        model    = GENERATION_MODEL,
        contents = prompt,
        config   = types.GenerateContentConfig(
            temperature       = 0.0,   # deterministic moderation
            max_output_tokens = 256,
        ),
    )

    verdict = _parse_json_verdict(response.text)

    decision = str(verdict.get("decision", "")).lower()
    status   = "rejected" if decision == "rejected" else "approved"
    reason   = str(verdict.get("reason", "")).strip() or (
        "Flagged by moderation" if status == "rejected" else "No issues detected"
    )
    raw_cats = verdict.get("categories") or []
    categories = [
        c for c in raw_cats
        if isinstance(c, str) and c in MODERATION_CATEGORIES
    ]
    return {"status": status, "reason": reason, "categories": categories}


def moderate_question(question_text: str, category: Optional[str]) -> dict:
    """
    Validate a submitted question before it is shown publicly. Approves genuine
    questions about the internship programme; rejects malicious content, spam,
    or off-topic questions. Returns {"status", "reason"}.
    Raises on LLM / parsing failure so the caller can fail open (stay pending).
    """
    prompt = f"""You are a content gate for the student community forum of the \
Vicharanashala internship programme at IIT Ropar. Decide whether the QUESTION below \
should be published.

Mark decision = "rejected" if the question is ANY of:
- Malicious content: harassment, hate speech, threats, violence, sexual content, \
self-harm encouragement, personal data / doxxing, or malware / hacking instructions.
- Malpractice / academic dishonesty: soliciting exam/quiz answers, cheating, plagiarism, \
leaking confidential material, sharing account credentials, or bypassing ViBe proctoring.
- Spam / advertising: scams, promotions, or links to UNOFFICIAL WhatsApp / Telegram / peer groups.
- Off-topic: unrelated to the Vicharanashala internship programme, the application/NOC/offer-letter \
process, ViBe, mentorship, or student life in the programme.

Otherwise decision = "approved".

Respond with ONLY a JSON object (no markdown, no prose) in exactly this form:
{{"decision": "approved" | "rejected", "reason": "<one short sentence>", "categories": ["<zero or more of: {', '.join(MODERATION_CATEGORIES)}>"]}}

CATEGORY: {category or "(not provided)"}
QUESTION: {question_text}
JSON:"""

    response = app_state["gemini"].models.generate_content(
        model    = GENERATION_MODEL,
        contents = prompt,
        config   = types.GenerateContentConfig(
            temperature       = 0.0,   # deterministic gating
            max_output_tokens = 256,
        ),
    )

    verdict = _parse_json_verdict(response.text)

    decision = str(verdict.get("decision", "")).lower()
    status   = "rejected" if decision == "rejected" else "approved"
    reason   = str(verdict.get("reason", "")).strip() or (
        "Flagged by validation" if status == "rejected" else "No issues detected"
    )
    return {"status": status, "reason": reason}


def _write_question_verdict(question_id: str, status: str, reason: str) -> None:
    """
    Write the validation verdict back onto the question document in MongoDB.

    The Next.js backend ignores the HTTP response and relies on this writeback.
    Since the payload has no collection discriminator, we update every known
    question collection by _id; only the one holding the id matches.
    Fails open (logs + returns) if Mongo is unavailable or the id is malformed.
    """
    mongo = app_state.get("mongo")
    if mongo is None:
        print(f"[WARN] No MongoDB client - skipping writeback for {question_id}")
        return

    try:
        oid = ObjectId(question_id)
    except (InvalidId, TypeError):
        print(f"[WARN] Invalid question_id '{question_id}' - skipping writeback")
        return

    now = datetime.now(timezone.utc)
    decision   = "approved" if status == "approved" else "rejected"
    doc_status = "approved" if status == "approved" else "rejected_by_rag"
    set_doc = {
        "status": doc_status,
        "ragValidation": {
            "decision":    decision,
            "reason":      reason,
            "model":       GENERATION_MODEL,
            "validatedAt": now,
        },
        "updatedAt": now,
    }

    for db_name, coll_name in QUESTION_COLLECTIONS:
        try:
            res = mongo[db_name][coll_name].update_one(
                {"_id": oid}, {"$set": set_doc}
            )
            if res.matched_count:
                print(f"[OK] Wrote verdict '{doc_status}' to {db_name}.{coll_name} for {question_id}")
        except Exception as err:
            print(f"[WARN] Writeback to {db_name}.{coll_name} failed for {question_id}: {err}")

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    count = app_state["collection"].count()
    return {
        "status":     "ok",
        "collection": COLLECTION_NAME,
        "chunks":     count,
    }


@app.post("/query", response_model=QueryResponse)
def rag_query(req: QueryRequest):
    """
    Full RAG pipeline:
      1. Embed the question
      2. Retrieve top_k relevant chunks from ChromaDB
      3. Build a prompt with the chunks as context
      4. Generate an answer with Gemini
      5. Return answer + source citations
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Retrieve
    chunks = retrieve(req.question, req.top_k)

    if not chunks:
        return QueryResponse(
            answer  = "No relevant information found in the knowledge base.",
            sources = [],
        )

    # Generate
    prompt = build_prompt(req.question, chunks)
    answer = generate_answer(prompt)

    # Build source citations
    # Deduplicate by URL (multiple chunks can come from same doc)
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


@app.post("/validate-reply", response_model=ReplyValidationResponse)
def validate_reply(req: ReplyValidationRequest):
    """
    Moderate a community reply for malicious content and malpractice.

    Stateless: returns the verdict to the Next.js backend, which writes the
    `status` + `moderation` fields back onto the nested reply in MongoDB.
    """
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Reply content cannot be empty")

    try:
        result = moderate_reply(content, req.question)
    except Exception as err:   # LLM / parse failure -> let caller stay "pending"
        raise HTTPException(
            status_code=502,
            detail=f"Moderation failed: {err}",
        )

    return ReplyValidationResponse(
        reply_id   = req.reply_id,
        thread_id  = req.thread_id,
        status     = result["status"],
        reason     = result["reason"],
        categories = result["categories"],
        model      = GENERATION_MODEL,
    )


@app.post("/validate-question", response_model=QuestionValidationResponse)
def validate_question(req: QuestionValidationRequest):
    """
    Validate a submitted question, then write the verdict back to MongoDB.

    The Next.js backend fires this after saving the question (status "pending" /
    "pending_rag") and does NOT read the response — it relies on the writeback to
    flip the document's status to "approved" / "rejected_by_rag".
    """
    text = req.question_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Question text cannot be empty")

    try:
        result = moderate_question(text, req.category)
    except Exception as err:   # LLM / parse failure -> let caller stay "pending"
        raise HTTPException(
            status_code=502,
            detail=f"Validation failed: {err}",
        )

    _write_question_verdict(req.question_id, result["status"], result["reason"])

    return QuestionValidationResponse(
        question_id = req.question_id,
        status      = result["status"],
        reason      = result["reason"],
        model       = GENERATION_MODEL,
    )


@app.get("/search", response_model=SearchResponse)
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
