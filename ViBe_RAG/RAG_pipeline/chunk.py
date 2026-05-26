"""
chunk.py
────────────────────────────────────────────────────────────────────────────
Step 3: Chunking
────────────────────────────────────────────────────────────────────────────

Strategy:
  - "qa"    docs  →  already one Q+A pair = one chunk (no splitting needed
                      unless the answer is very long > MAX_TOKENS)
  - "prose" docs  →  sliding window split with OVERLAP tokens of context

Why this matters for RAG quality:
  Too small  → retrieved chunk lacks enough context to answer the question
  Too large  → embedding is diluted; irrelevant content drags down similarity

Gemini text-embedding-004 max input: 2048 tokens
Safe chunk target: 400 tokens (leaves room for the query in the prompt)
Overlap: 60 tokens (~15%) so no idea gets cut at a boundary

Output → data/chunks.json
Each chunk:
  {
    "chunk_id":   "faq_3_7_c0",
    "doc_id":     "faq_3_7",
    "source":     "faq",
    "section":    "3. NOC (No Objection Certificate)",
    "title":      "3.7 Can my HOD email the NOC...",
    "content":    "Yes — there is a fully-equivalent...",
    "url":        "https://samagama.in/...",
    "type":       "qa",
    "chunk_index": 0,
    "total_chunks": 1,
    "token_count": 187
  }
"""

import json
import os
import re
from dataclasses import asdict, dataclass


# ── Config ────────────────────────────────────────────────────────────────────

INPUT_FILE  = "data/raw_documents.json"
OUTPUT_FILE = "data/chunks.json"

MAX_TOKENS  = 400   # target max tokens per chunk
OVERLAP     = 60    # token overlap between consecutive chunks
# Gemini text-embedding-004 hard limit — never exceed this
GEMINI_MAX  = 2048

# ── Helpers ───────────────────────────────────────────────────────────────────

def count_tokens(text: str) -> int:
    """
    Lightweight offline token estimator.
    Rule of thumb: 1 token ≈ 4 characters for English text.
    Accurate enough for chunking decisions; Gemini's own tokenizer may
    differ slightly but this keeps us well within safe limits.
    """
    return max(1, len(text) // 4)


def split_into_sentences(text: str) -> list[str]:
    """
    Split text into sentences using punctuation boundaries.
    Preserves list items (lines starting with - or •) as atomic units.
    """
    # Split on sentence-ending punctuation followed by whitespace
    parts = re.split(r"(?<=[.!?])\s+", text)
    result: list[str] = []
    for p in parts:
        p = p.strip()
        if p:
            result.append(p)
    return result


def sliding_window_chunks(
    text: str,
    max_tokens: int = MAX_TOKENS,
    overlap: int = OVERLAP,
) -> list[str]:
    """
    Split text into overlapping token windows.

    1. Split into sentences (atomic units — we never cut mid-sentence).
    2. Greedily pack sentences into a window until max_tokens is reached.
    3. Slide forward by (window_tokens - overlap) for the next window.
    """
    sentences = split_into_sentences(text)
    if not sentences:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    for sent in sentences:
        sent_tokens = count_tokens(sent)

        # Single sentence longer than max → force it as its own chunk
        if sent_tokens > max_tokens:
            if current:
                chunks.append(" ".join(current))
            chunks.append(sent)
            current = []
            current_tokens = 0
            continue

        if current_tokens + sent_tokens > max_tokens and current:
            # Emit current window
            chunks.append(" ".join(current))

            # Slide back: keep the last OVERLAP tokens worth of sentences
            overlap_sents: list[str] = []
            overlap_tokens = 0
            for s in reversed(current):
                t = count_tokens(s)
                if overlap_tokens + t > overlap:
                    break
                overlap_sents.insert(0, s)
                overlap_tokens += t

            current = overlap_sents
            current_tokens = overlap_tokens

        current.append(sent)
        current_tokens += sent_tokens

    if current:
        chunks.append(" ".join(current))

    return chunks

# ── Chunker ───────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    chunk_id:     str
    doc_id:       str
    source:       str
    section:      str
    title:        str
    content:      str
    url:          str
    type:         str
    chunk_index:  int
    total_chunks: int
    token_count:  int


def chunk_document(doc: dict) -> list[Chunk]:
    """
    Decide chunking strategy per document type:
      - qa    → if short enough, 1 chunk; else sliding window on answer only
      - prose → sliding window
    Both prepend "Q: <title>\nA: " to QA chunks so the embedding captures
    the question context alongside the answer.
    """
    doc_id   = doc["doc_id"]
    doc_type = doc["type"]

    if doc_type == "qa":
        # Prepend question to the answer so the chunk is self-contained
        full_text = f"Q: {doc['title']}\nA: {doc['content']}"
    else:
        full_text = f"{doc['title']}\n\n{doc['content']}"

    total_tokens = count_tokens(full_text)

    # Short enough to be one chunk?
    if total_tokens <= MAX_TOKENS:
        return [Chunk(
            chunk_id     = f"{doc_id}_c0",
            doc_id       = doc_id,
            source       = doc["source"],
            section      = doc["section"],
            title        = doc["title"],
            content      = full_text,
            url          = doc["url"],
            type         = doc_type,
            chunk_index  = 0,
            total_chunks = 1,
            token_count  = total_tokens,
        )]

    # Needs splitting — run sliding window on the content part only
    windows = sliding_window_chunks(doc["content"], MAX_TOKENS, OVERLAP)
    chunks: list[Chunk] = []

    for i, window in enumerate(windows):
        # Re-attach the title as context for every sub-chunk
        if doc_type == "qa":
            chunk_text = f"Q: {doc['title']}\nA: {window}"
        else:
            chunk_text = f"{doc['title']}\n\n{window}"

        # Hard safety: Gemini won't accept > 2048 tokens
        if count_tokens(chunk_text) > GEMINI_MAX:
            chunk_text = chunk_text[:GEMINI_MAX * 4]  # rough char truncation

        chunks.append(Chunk(
            chunk_id     = f"{doc_id}_c{i}",
            doc_id       = doc_id,
            source       = doc["source"],
            section      = doc["section"],
            title        = doc["title"],
            content      = chunk_text,
            url          = doc["url"],
            type         = doc_type,
            chunk_index  = i,
            total_chunks = len(windows),
            token_count  = count_tokens(chunk_text),
        ))

    return chunks

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(INPUT_FILE, encoding="utf-8") as f:
        documents = json.load(f)

    all_chunks: list[Chunk] = []
    multi_chunk_docs = []

    for doc in documents:
        chunks = chunk_document(doc)
        all_chunks.extend(chunks)
        if len(chunks) > 1:
            multi_chunk_docs.append((doc["doc_id"], len(chunks)))

    # ── Stats ─────────────────────────────────────────────────────────
    token_counts = [c.token_count for c in all_chunks]
    print(f"\n── Step 3: Chunking results ────────────────────────────")
    print(f"  Input documents  : {len(documents)}")
    print(f"  Output chunks    : {len(all_chunks)}")
    print(f"  Avg tokens/chunk : {sum(token_counts) // len(token_counts)}")
    print(f"  Max tokens/chunk : {max(token_counts)}")
    print(f"  Min tokens/chunk : {min(token_counts)}")

    if multi_chunk_docs:
        print(f"\n  Documents split into multiple chunks:")
        for doc_id, n in multi_chunk_docs:
            print(f"    {doc_id}  →  {n} chunks")

    # ── Save ──────────────────────────────────────────────────────────
    os.makedirs("data", exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump([asdict(c) for c in all_chunks], f, ensure_ascii=False, indent=2)

    print(f"\n✓ Saved → {OUTPUT_FILE}")

    # ── Preview ───────────────────────────────────────────────────────
    print("\n── Sample chunks ───────────────────────────────────────")
    for chunk in all_chunks[:3]:
        print(f"\n  [{chunk.chunk_id}]  tokens={chunk.token_count}")
        print(f"  {chunk.content[:160].replace(chr(10), ' ')}...")


if __name__ == "__main__":
    main()
