# RAG Pipeline — Samagama Internship Chatbot

scraping → cleaning → embeddings → API.
MERN team just calls `POST /query`. That's it.

---

## How it works

```
Website HTML  →  Clean Text  →  Chunks  →  Embeddings  →  ChromaDB
                                                               ↓
                                          User Question  →  FastAPI  →  Answer
```

---

## Folder structure

```
rag-pipeline/
├── scrape_and_clean.py   # fetch + parse HTML
├── chunk.py              # split text into pieces
├── embed_and_store.py    # embed with Gemini + save to ChromaDB
├── rag_api.py            # FastAPI server (the endpoint MERN calls)
├── requirements.txt
├── .env.example
└── data/
    ├── raw_html/         # cached HTML (committed to git)
    ├── raw_documents.json
    └── chunks.json
```

> `chroma_db/` is in `.gitignore` — each dev generates it locally.

---

## Setup

```bash
pip install -r requirements.txt

cp .env.example .env
# paste your Gemini key → https://aistudio.google.com/app/apikey

# run once to build the vector DB
python scrape_and_clean.py
python chunk.py
python embed_and_store.py

# start the server
uvicorn rag_api:app --reload --port 8000
```

---

## API

### `POST /query`
```json
// request
{ "question": "How do I get my offer letter?" }

// response
{
  "answer": "Your offer letter is issued within 24–48 hours after NOC verification.",
  "sources": [{ "title": "4.3 When do I get the offer letter?", "url": "...", "score": 0.94 }]
}
```

### `GET /search?q=...` — raw vector search, no LLM (for debugging)
### `GET /health` — check server + chunk count

---

## MERN integration

```js
// your Express backend
const res = await fetch('http://localhost:8000/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question })
});
const { answer, sources } = await res.json();
```

CORS is already open for `localhost:3000` and `localhost:5173`.

---

## Why these tools?

| What | Tool | Why not alternatives |
|---|---|---|
| Scraping | requests + BeautifulSoup | Pages are static HTML — Scrapy/Playwright is overkill |
| Embedding | Gemini text-embedding-004 | Free tier, 768-dim quality, same key as generation |
| Vector DB | ChromaDB | Zero setup for dev — upgrade to Qdrant for production |
| API | FastAPI | Async, auto docs, Python-native for ML libraries |
| Chunking | Custom | LangChain splitters break Q&A pairs mid-answer |

---

## Refresh pipeline (when site content changes)

```bash
# save pages manually: open in browser → Ctrl+S → save to data/raw_html/
python scrape_and_clean.py
python chunk.py
python embed_and_store.py
# restart server
```
