"""
embed_and_store.py
────────────────────────────────────────────────────────────────────────────
Step 4 + Step 5: Embed -> Store in ChromaDB
────────────────────────────────────────────────────────────────────────────

Uses:
  - Gemini gemini-embedding-001  (free tier: 1500 req/min, 100 req/day batch)
  - ChromaDB (local persistent store, zero server setup)

Run:
  python embed_and_store.py

Requires:
  GEMINI_API_KEY in .env file (or set as environment variable)

After this script runs, your Chroma collection is persisted at:
  ./chroma_db/

and can be queried in your FastAPI app without re-embedding.
"""

import json
import os
import time
from pathlib import Path

import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
from google import genai
from google.genai import types

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv()  # reads GEMINI_API_KEY from .env file

GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")
EMBEDDING_MODEL  = "gemini-embedding-001"   # Gemini's best embedding model
TASK_TYPE        = "RETRIEVAL_DOCUMENT"   # tells Gemini this is for RAG storage
                                          # use "RETRIEVAL_QUERY" at query time

CHROMA_PATH      = "./chroma_db"          # persisted on disk
COLLECTION_NAME  = "samagama_internship"

INPUT_FILE       = "data/chunks.json"

# Rate limit: Gemini free tier = 100 requests/minute for embeddings
# We batch up to 10 texts per request to stay safe
BATCH_SIZE       = 10
REQUEST_DELAY    = 0.7   # seconds between batches

# ── Gemini client ─────────────────────────────────────────────────────────────

if not GEMINI_API_KEY:
    raise EnvironmentError(
        "GEMINI_API_KEY not found.\n"
        "Create a .env file in this directory with:\n"
        "  GEMINI_API_KEY=your_key_here\n"
        "Get a free key at: https://aistudio.google.com/app/apikey"
    )

client = genai.Client(api_key=GEMINI_API_KEY)

# ── Embedding helper ──────────────────────────────────────────────────────────

def embed_batch(texts: list[str], task_type: str = TASK_TYPE) -> list[list[float]]:
    """
    Embed a batch of texts using Gemini gemini-embedding-001.
    Returns a list of float vectors (one per input text).
    """
    response = client.models.embed_content(
        model   = f"models/{EMBEDDING_MODEL}",
        contents= texts,
        config  = types.EmbedContentConfig(task_type=task_type),
    )
    return [e.values for e in response.embeddings]


def embed_all(texts: list[str]) -> list[list[float]]:
    """
    Embed all texts in batches with rate-limit delay.
    Shows progress as it goes.
    """
    all_embeddings: list[list[float]] = []
    total_batches = (len(texts) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_idx in range(0, len(texts), BATCH_SIZE):
        batch      = texts[batch_idx : batch_idx + BATCH_SIZE]
        batch_num  = (batch_idx // BATCH_SIZE) + 1

        print(f"  Embedding batch {batch_num}/{total_batches} "
              f"({len(batch)} texts)...", end=" ", flush=True)

        try:
            embeddings = embed_batch(batch)
            all_embeddings.extend(embeddings)
            print(f"[OK] dim={len(embeddings[0])}")
        except Exception as e:
            print(f"[ERR] ERROR: {e}")
            # On rate limit: wait longer and retry once
            if "429" in str(e) or "quota" in str(e).lower():
                print(f"  Rate limited - waiting 60s...")
                time.sleep(60)
                embeddings = embed_batch(batch)
                all_embeddings.extend(embeddings)
                print(f"  Retry [OK]")
            else:
                raise

        if batch_idx + BATCH_SIZE < len(texts):
            time.sleep(REQUEST_DELAY)

    return all_embeddings

# ── ChromaDB setup ────────────────────────────────────────────────────────────

def get_or_create_collection() -> chromadb.Collection:
    """
    Create a persistent ChromaDB client and return (or create) the collection.
    We use cosine similarity - best for semantic text embeddings.
    """
    chroma_client = chromadb.PersistentClient(
        path     = CHROMA_PATH,
        settings = Settings(anonymized_telemetry=False),
    )

    # If collection already exists, delete and recreate
    # (so re-running the script always gives a clean state)
    existing = [c.name for c in chroma_client.list_collections()]
    if COLLECTION_NAME in existing:
        print(f"  Collection '{COLLECTION_NAME}' exists - recreating...")
        chroma_client.delete_collection(COLLECTION_NAME)

    collection = chroma_client.create_collection(
        name      = COLLECTION_NAME,
        metadata  = {"hnsw:space": "cosine"},   # cosine similarity for ANN search
    )
    print(f"  Collection '{COLLECTION_NAME}' created [OK]")
    return collection

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # ── Load chunks ───────────────────────────────────────────────────
    with open(INPUT_FILE, encoding="utf-8") as f:
        chunks = json.load(f)

    print(f"\n── Step 4: Embedding {len(chunks)} chunks with Gemini ────────")
    print(f"  Model      : {EMBEDDING_MODEL}")
    print(f"  Task type  : {TASK_TYPE}")
    print(f"  Batch size : {BATCH_SIZE}\n")

    texts = [c["content"] for c in chunks]

    embeddings = embed_all(texts)

    print(f"\n  [OK] Embedded {len(embeddings)} chunks")
    print(f"  Vector dimension: {len(embeddings[0])}")

    # ── Store in ChromaDB ─────────────────────────────────────────────
    print(f"\n── Step 5: Storing in ChromaDB ─────────────────────────")
    collection = get_or_create_collection()

    # ChromaDB upsert takes:
    #   ids        -> unique string ID per document
    #   embeddings -> pre-computed vectors (we skip Chroma's built-in embedding)
    #   documents  -> raw text (stored for retrieval)
    #   metadatas  -> dict of filterable fields

    collection.upsert(
        ids        = [c["chunk_id"] for c in chunks],
        embeddings = embeddings,
        documents  = [c["content"] for c in chunks],
        metadatas  = [
            {
                "doc_id":      c["doc_id"],
                "source":      c["source"],
                "section":     c["section"],
                "title":       c["title"],
                "url":         c["url"],
                "type":        c["type"],
                "chunk_index": c["chunk_index"],
            }
            for c in chunks
        ],
    )

    stored = collection.count()
    print(f"  [OK] {stored} chunks stored in ChromaDB at {CHROMA_PATH}/")

    # ── Smoke test - run a sample query ──────────────────────────────
    print(f"\n── Smoke test: sample RAG query ─────────────────────────")
    test_query = "How do I get the offer letter?"

    print(f"  Query: '{test_query}'")

    # Embed the query with RETRIEVAL_QUERY task type
    q_embedding = embed_batch([test_query], task_type="RETRIEVAL_QUERY")[0]

    results = collection.query(
        query_embeddings = [q_embedding],
        n_results        = 3,
        include          = ["documents", "metadatas", "distances"],
    )

    print(f"\n  Top 3 results:\n")
    for i, (doc, meta, dist) in enumerate(zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    )):
        score = round(1 - dist, 4)   # cosine similarity (1 = perfect match)
        print(f"  [{i+1}] score={score}  [{meta['type']}]  {meta['title'][:65]}")
        print(f"       {doc[:130].replace(chr(10), ' ')}...")
        print(f"       {meta['url']}\n")

    print("[OK] Pipeline complete! ChromaDB is ready for RAG queries.")
    print(f"   Collection : {COLLECTION_NAME}")
    print(f"   Location   : {Path(CHROMA_PATH).resolve()}")


if __name__ == "__main__":
    main()
