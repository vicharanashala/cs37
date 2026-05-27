# Community Q&A Feature

## Feature Summary

Students can create questions. Other students can submit answers under those questions. Each question can have multiple answers, but submitted answers should not become visible immediately.

Every answer first goes through an LLM-based review layer that checks:

- whether the answer is relevant to the question
- whether the answer is safe and non-abusive
- whether it appears factually aligned with institution policy where policy is involved
- whether it violates academic-integrity rules

Only approved answers are shown publicly. Rejected or uncertain answers are stored with review status for audit and possible admin review.

The RAG layer can then summarize approved answers into a balanced community answer, but that summary must still be grounded against institutional sources when the question touches official policy.

## Why This Fits the Project

The current PRD already separates the system into:

- MERN product layer for users, auth, chat, profiles, messages, analytics
- Python AI/RAG service for embeddings, retrieval, moderation, reranking, and generation
- Vector DB for institutional FAQ/document knowledge
- analytics events for observability

Community Q&A should live mostly in the MERN product layer, with AI checks delegated to the Python AI service.

This keeps the boundary clean:

```text
React UI
  -> Express API
  -> MongoDB for questions/answers
  -> AI service for moderation/relevance/RAG summary
  -> Vector DB for institutional grounding
```

## Core Concepts

### Question

A student-created discussion topic.

Examples:

- "How do I apply for a certificate name correction?"
- "What is the best way to prepare for the statistics internal exam?"
- "Where can I find internship offer letter status?"

### Answer

A student-submitted response under a question.

Answers should have lifecycle states:

```text
pending_review
approved
rejected
needs_admin_review
hidden
deleted
```

### Community Summary

An AI-generated synthesis of the approved answers under one question.

Important: avoid calling this an "average" answer in implementation. The safer term is "synthesized answer" or "consensus summary" because LLMs do not mathematically average natural-language answers. They summarize, reconcile, and highlight common points.

## Recommended Data Model

### `communityQuestions`

```js
{
  _id,
  institutionId,
  authorStudentId,
  title,
  body,
  normalizedTitle,
  questionHash,
  tags: ["certificate", "exam", "internship"],
  status: "open" | "closed" | "hidden" | "deleted",
  acceptedAnswerId,
  approvedAnswerCount,
  viewCount,
  voteScore,
  lastActivityAt,
  createdAt,
  updatedAt
}
```

Indexes:

```text
{ institutionId: 1, createdAt: -1 }
{ institutionId: 1, questionHash: 1 }
{ institutionId: 1, tags: 1 }
{ institutionId: 1, lastActivityAt: -1 }
```

### `communityAnswers`

```js
{
  _id,
  institutionId,
  questionId,
  authorStudentId,
  body,
  status: "pending_review" | "approved" | "rejected" | "needs_admin_review" | "hidden" | "deleted",
  review: {
    relevanceScore: 0.91,
    safetyAllowed: true,
    policyGrounded: true,
    academicIntegrityAllowed: true,
    decision: "approve" | "reject" | "needs_admin_review",
    reasons: ["directly_answers_question", "no_policy_conflict"],
    model: "configured-review-model",
    reviewedAt
  },
  citations: [
    {
      documentId,
      title,
      section,
      version,
      snippet,
      score
    }
  ],
  voteScore,
  reportCount,
  createdAt,
  updatedAt
}
```

Indexes:

```text
{ questionId: 1, status: 1, voteScore: -1 }
{ institutionId: 1, status: 1, createdAt: -1 }
{ authorStudentId: 1, createdAt: -1 }
```

### `communityQuestionSummaries`

```js
{
  _id,
  institutionId,
  questionId,
  summary,
  status: "fresh" | "stale" | "failed",
  sourceAnswerIds: [],
  citations: [],
  model,
  generatedAt,
  answerVersion,
  createdAt,
  updatedAt
}
```

Use this collection so summaries can be cached and regenerated only when needed.

## Answer Submission Flow

```text
Student submits answer
  -> Express creates communityAnswers row with status=pending_review
  -> Express calls AI service /review-community-answer
  -> AI service checks safety + relevance + policy grounding
  -> Express updates answer status
  -> if approved: answer becomes public
  -> if rejected: answer remains hidden with reason
  -> if uncertain: admin moderation queue
```

The user experience should be:

```text
"Your answer was submitted and is being reviewed."
```

For fast models this may complete in seconds, but the architecture should still treat review as asynchronous. This prevents the UI from hanging and makes retries safer.

## AI Review Logic

### Input

```json
{
  "institutionId": "inst_1",
  "question": {
    "title": "How do I get my offer letter?",
    "body": "I completed verification but cannot find the offer letter."
  },
  "answer": "You usually get it after NOC verification within 24-48 hours.",
  "studentContext": {
    "role": "student"
  }
}
```

### AI Service Steps

1. Run normal safety moderation on the answer text.
2. Check relevance between question and answer.
3. Classify whether the question is policy/institutional, academic-help, social, or general.
4. If policy/institutional, retrieve official source chunks from the Vector DB.
5. Ask the review model to decide whether the answer is supported, contradicted, or not verifiable from sources.
6. Return a structured decision.

### Output

```json
{
  "decision": "approve",
  "relevanceScore": 0.91,
  "safetyAllowed": true,
  "policyGrounded": true,
  "academicIntegrityAllowed": true,
  "reasons": ["answer_directly_addresses_question", "supported_by_source"],
  "citations": [
    {
      "documentId": "policy_2026",
      "title": "Internship Policy",
      "section": "Offer Letter",
      "version": "2026",
      "snippet": "...",
      "score": 0.88
    }
  ]
}
```

### Decision Rules

Approve when:

- answer is relevant
- answer is safe
- answer does not enable cheating
- policy claims are supported by retrieved institutional sources

Reject when:

- answer is unrelated
- answer is abusive/spam
- answer gives clearly unsafe or prohibited guidance
- answer directly contradicts known policy

Send to admin review when:

- answer may be useful but cannot be verified
- retrieved sources are weak
- the answer includes sensitive policy claims
- the LLM decision confidence is low

## Community Summary Flow

For multiple approved answers under the same question, the system can generate a synthesized answer.

```text
Question page requested
  -> load approved answers
  -> if no summary or summary is stale:
       enqueue summary job
  -> show existing summary if available
  -> show individual approved answers below
```

Regenerate summary when:

- a new answer is approved
- an approved answer is hidden/deleted
- an answer receives many upvotes
- institutional source documents are re-embedded or updated

### Summary Generation Rules

The summary prompt should include:

- original question
- top approved student answers
- vote scores
- retrieved official source chunks when institutional policy is involved
- instruction to separate official facts from student experience

The summary should produce:

```json
{
  "summary": "Most approved answers agree that...",
  "officialNotes": "According to the cited institutional source...",
  "studentTips": ["..."],
  "uncertainties": ["..."],
  "citations": []
}
```

For policy questions, the summary must not invent an answer only from student responses. It should say what the official source supports, then label community suggestions separately.

Example display:

```text
Verified Summary
Official policy says the offer letter is issued after NOC verification. Community answers commonly mention a 24-48 hour wait, but students should check the portal or contact support if delayed.

Community Answers
- Answer 1
- Answer 2
- Answer 3
```

## API Design

### Create Question

```http
POST /api/community/questions
```

```json
{
  "title": "How do I get my offer letter?",
  "body": "I completed verification but cannot find it.",
  "tags": ["internship", "offer-letter"]
}
```

### List Questions

```http
GET /api/community/questions?tag=internship&sort=recent
```

### Get Question Detail

```http
GET /api/community/questions/:questionId
```

Returns:

- question
- approved answers
- current synthesized summary
- whether current user can answer/report/vote

### Submit Answer

```http
POST /api/community/questions/:questionId/answers
```

```json
{
  "body": "You usually receive it within 24-48 hours after NOC verification."
}
```

Initial response:

```json
{
  "answerId": "ans_123",
  "status": "pending_review"
}
```

### Vote Answer

```http
POST /api/community/answers/:answerId/vote
```

```json
{
  "value": 1
}
```

### Report Answer

```http
POST /api/community/answers/:answerId/report
```

```json
{
  "reason": "incorrect_policy"
}
```

### Admin Review Queue

```http
GET /api/admin/community/review-queue
```

```http
POST /api/admin/community/answers/:answerId/review
```

```json
{
  "decision": "approve",
  "note": "Verified against policy source."
}
```

## AI Service Endpoints

### Review Community Answer

```http
POST /review-community-answer
```

Owned by the Python AI service.

Responsibilities:

- moderation
- relevance check
- institutional grounding check
- academic-integrity check
- structured decision response

### Generate Community Summary

```http
POST /generate-community-summary
```

Owned by the Python AI service.

Responsibilities:

- summarize approved answers
- retrieve official context when needed
- cite institutional sources
- distinguish official facts from student tips

## Vector DB Usage

This feature should use the Vector DB in three ways:

1. Check whether a new community question already exists.
2. Verify policy-related student answers against official source chunks.
3. Ground the synthesized summary in institutional documents.

Optional later step: embed approved community questions and approved answers into separate collections:

```text
community_questions
community_answers
```

Do not mix student-generated answers into the official institutional FAQ/document collection. Keep them separate because student content is less authoritative.

Recommended collections:

```text
official_documents
faq_questions
community_questions
community_answers_approved
```

## Frontend Pages

### Student Community Q&A Home

- search questions
- filter by tags
- sort by recent, most answered, unanswered, trending
- ask question button

### Question Detail Page

- question title/body
- synthesized summary if available
- official citations if any
- approved answers
- submit answer editor
- vote/report actions

### My Contributions

- questions I asked
- answers I submitted
- pending/rejected/approved statuses

### Admin Review Queue

- pending answers
- LLM decision and reason
- retrieved citations
- approve/reject controls

## Safety and Trust Requirements

- Never show unreviewed answers publicly.
- Store rejected answers for audit, but do not expose them to students.
- Add rate limits for asking and answering.
- Add spam detection.
- Add report/flag workflow.
- Keep student-generated content separate from official policy sources.
- Label AI summaries clearly as synthesized from approved answers.
- For policy topics, cite official institutional documents.
- Let admins override LLM decisions.

## Implementation Phases

### Phase 1: Basic Community Q&A

- Add MongoDB models for questions and answers.
- Add student APIs to create/list/view questions.
- Add student API to submit answers.
- Store answers as `pending_review`.
- Add basic UI pages.

### Phase 2: LLM Review Layer

- Add `/review-community-answer` to AI service.
- Add async review job with Redis or a background worker.
- Auto-approve, reject, or send to admin queue.
- Store review reasons and citations.
- Add analytics events for answer review.

### Phase 3: Admin Moderation

- Add review queue.
- Allow admin approve/reject overrides.
- Track moderation audit log.
- Add reporting and hiding.

### Phase 4: RAG Community Summary

- Add `/generate-community-summary`.
- Generate cached summaries from approved answers.
- Ground summaries with official document retrieval.
- Regenerate summary when approved answers change.

### Phase 5: Ranking and Quality

- Add voting.
- Rank answers by vote score, relevance, and freshness.
- Highlight accepted answers.
- Detect duplicate questions.
- Cluster common unanswered questions for admin FAQ creation.

## Main Technical Risks

### LLM Review Can Be Wrong

The LLM should not be the only authority for sensitive or uncertain answers. Use `needs_admin_review` for low-confidence decisions and policy-heavy topics.

### Student Answers Are Not Official Sources

Do not let community answers pollute the official RAG corpus. Keep community content separate and clearly labeled.

### Summary Can Hide Disagreement

A synthesized answer may smooth over conflicting answers. The summary should include uncertainty and still show individual answers below it.

### Policy Drift

An answer approved today may become wrong after policy changes. When documents are re-embedded or versions change, mark related community summaries as stale and optionally re-review approved answers with policy claims.

## Recommended MVP Decision

Build this as a separate `community` module, not inside the chat module.

Recommended first slice:

```text
Question CRUD
  -> answer submission
  -> pending_review status
  -> AI relevance/safety review
  -> approved answers visible
```

Do not start with AI-generated community summaries. First make the moderation and approval workflow reliable. Once approved answers are trustworthy enough, add the RAG summary layer.
