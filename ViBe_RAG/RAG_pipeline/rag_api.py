"""
rag_api.py
────────────────────────────────────────────────────────────────────────────
Step 6: FastAPI RAG Query Endpoint
────────────────────────────────────────────────────────────────────────────

Run:
  uvicorn rag_api:app --reload --port 8000

Endpoints:
  POST /query          ->  RAG: retrieve chunks + generate answer with Gemini
  GET  /search         ->  Pure vector search (no LLM, returns raw chunks)
  GET  /health         ->  Health check

Your MERN frontend / backend calls POST /query with:
  { "question": "How do I get the offer letter?" }

And gets back:
  {
    "answer":  "To get your offer letter...",
    "sources": [ { "title": "...", "url": "...", "score": 0.91 }, ... ]
  }
"""

import os
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
