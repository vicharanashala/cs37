# Ideas

## 1. Previously Asked Question Check Layer

### Goal

Before generating a new answer, detect whether a student's question is the same as, or very close to, an FAQ/question that already exists in the knowledge base. If it is already covered, return the existing canonical answer or route the user to the existing FAQ result with citations.

This should sit before the expensive answer-generation step:

```text
Student question
  -> normalize question
  -> exact duplicate check
  -> semantic duplicate check in Vector DB
  -> optional rerank / threshold decision
  -> reuse existing FAQ answer OR continue normal RAG answer generation
```

### Recommended Data Model

Store FAQs/questions as their own searchable records, separate from document chunks.

For Chroma in the current simple pipeline, use a separate collection:

```text
faq_questions
```

For Qdrant in the planned architecture, use either:

```text
collection: faq_questions_{institutionId}
```

or one shared collection with payload filters:

```json
{
  "institutionId": "inst_1",
  "type": "faq_question",
  "faqId": "faq_123",
  "canonicalQuestion": "How do I get my offer letter?",
  "canonicalAnswer": "Your offer letter is issued within 24-48 hours after NOC verification.",
  "sourceDocumentId": "doc_1",
  "section": "4.3",
  "version": "2026",
  "normalizedQuestion": "how do i get my offer letter",
  "questionHash": "sha256(normalizedQuestion)",
  "tags": ["offer_letter", "noc"],
  "status": "active"
}
```

Do not rely only on document chunks for duplicate detection. Document chunks answer factual questions, but canonical FAQ questions give a cleaner duplicate-match surface.

### Step 1: Normalize and Exact-Match

Create a small normalizer before embedding:

- lower-case text
- trim whitespace
- remove repeated spaces
- remove trailing punctuation
- normalize common variants such as "what's" -> "what is"
- optionally remove filler words like "please", "can you tell me"

Then compute a stable hash:

```text
questionHash = sha256(normalizedQuestion)
```

Check MongoDB or FAQ metadata for the same `(institutionId, questionHash)`.

If found, this is a direct duplicate. Return the existing FAQ answer immediately.

### Step 2: Semantic Search in Vector DB

If exact-match fails:

1. Embed the student's normalized question with the same embedding model used for FAQ questions.
2. Search the `faq_questions` vector collection with tenant/institution filters.
3. Retrieve top 5-10 candidate FAQ questions.
4. Compare using similarity score and optional reranking.

Suggested starting thresholds:

```text
>= 0.88 similarity: treat as duplicate and reuse canonical FAQ
0.78 - 0.88: likely similar; show suggested existing FAQs or use LLM/reranker to decide
< 0.78: not a duplicate; continue normal RAG flow
```

Tune these with real student questions. The exact score range depends on the embedding model and vector DB distance metric.

### Step 3: Optional Reranker / LLM Judge

For borderline cases, use a cheap decision step:

```text
Input:
- student question
- top candidate FAQ question
- candidate answer title/source

Output:
same_question: true | false
reason: short explanation
```

This avoids false positives such as:

```text
"When will I get my offer letter?"
"How do I download my offer letter?"
```

These are related, but not always the same intent.

### Step 4: Response Behavior

For high-confidence duplicate:

```json
{
  "matchType": "duplicate_faq",
  "faqId": "faq_123",
  "confidence": 0.91,
  "answer": "...",
  "sources": [...]
}
```

For medium-confidence similar questions:

```json
{
  "matchType": "similar_faq",
  "suggestions": [
    {
      "faqId": "faq_123",
      "question": "How do I get my offer letter?",
      "confidence": 0.82
    }
  ]
}
```

For no match:

```text
continue normal RAG retrieval -> grounded answer generation -> citations
```

### Where to Implement

Current `RAG_pipeline` version:

- Add a `faq_questions` Chroma collection during `embed_and_store.py`.
- Add a helper such as `check_existing_question(question)` in `rag_api.py`.
- Call it at the start of `POST /query`.
- If a high-confidence match exists, return the canonical FAQ answer without calling the LLM.

Planned PRD architecture:

- Add `POST /check-question` or fold this into `POST /retrieve`.
- Location: `services/ai/app/rag` for vector search logic.
- Node chat flow should call this before generation:

```text
POST /api/chat
  -> input moderation
  -> intent classification
  -> check existing FAQ question
  -> if duplicate: return cached/canonical answer with citations
  -> else: retrieve chunks + generate grounded answer
```

### Minimal API Shape

```http
POST /check-question
```

```json
{
  "institutionId": "inst_1",
  "question": "When do I get offer letter?",
  "topK": 5
}
```

```json
{
  "matchType": "duplicate_faq",
  "confidence": 0.91,
  "faqId": "faq_123",
  "canonicalQuestion": "How do I get my offer letter?",
  "answer": "Your offer letter is issued within 24-48 hours after NOC verification.",
  "sources": [
    {
      "title": "4.3 When do I get the offer letter?",
      "url": "...",
      "score": 0.94
    }
  ]
}
```

### Important Safeguards

- Always filter by `institutionId` so one institution's FAQ never answers another institution's student.
- Keep FAQ-question vectors separate from raw document chunk vectors.
- Store the embedding model name and dimension with the collection metadata.
- Version FAQ answers, because policy answers can change.
- Log duplicate matches in analytics so admins can see what students repeatedly ask.
- Do not auto-create a new FAQ from every student question. First cluster repeated questions, then let an admin approve canonical FAQs.

### Acceptance Criteria

- Exact duplicate questions return the existing FAQ answer without LLM generation.
- Similar wording maps to the same FAQ when similarity is above threshold.
- Borderline matches are not incorrectly treated as duplicates.
- All reused answers still include source/citation metadata.
- Each check writes an analytics event with match type, score, and selected FAQ id.

## 2. Auto FAQ Clustering for Admins

Cluster student questions from analytics events weekly or daily. Show admins groups such as:

```text
Cluster: offer letter timing
Questions asked: 48
Current FAQ coverage: yes
Top source: Internship onboarding FAQ, section 4.3
Recommended action: keep existing FAQ
```

For uncovered clusters:

```text
Cluster: certificate name correction
Questions asked: 31
Current FAQ coverage: no
Recommended action: create FAQ from approved policy source
```

This turns repeated student confusion into a knowledge-base improvement workflow.

## 3. Answer Quality Feedback Loop

Use thumbs up/down feedback plus retrieval scores to find weak answers:

- low retrieval confidence
- high number of downvotes
- repeated follow-up questions after an answer
- answer generated without strong citation support

Create an admin view: "Questions that need better source material." This is useful because many RAG failures are content gaps, not model failures.

## 4. Student-Specific Memory With Controls

The PRD already includes long-term memory. Add a student-facing memory page where students can view and delete stored facts:

- goals
- weak areas
- preferred learning style
- achievements
- recurring academic blockers

This improves trust and keeps personalization explainable.

## 5. Golden Question Evaluation Set

Create a small test set of 30-50 important institutional questions:

- expected source document
- expected section
- acceptable answer points
- unacceptable hallucinations

Run this after changing chunking, embeddings, prompts, or thresholds. This will catch regressions before they reach students.
