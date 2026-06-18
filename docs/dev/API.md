# API Reference

Base URL: http://localhost:8788 (proxied through Vite at /api in development)

## Authentication

All endpoints except /api/health, /api/auth/login, /api/auth/signup, and /api/auth/guest require a valid session cookie (jini_session).

### POST /api/auth/signup

Create a new user account and start an authenticated session.

**Body:**
`json
{
  "name": "string (2-80 chars)",
  "email": "valid email",
  "password": "string (8-128 chars)"
}
`

**Response** 201:
`json
{
  "user": { "id": "string", "name": "string", "email": "string", "role": "member" }
}
`

**Errors:** 409 if email already exists, 400 for validation.

### POST /api/auth/login

Authenticate with email and password.

**Body:**
`json
{
  "email": "valid email",
  "password": "string"
}
`

**Response** 200:
`json
{
  "user": { "id": "string", "name": "string", "email": "string", "role": "string" }
}
`

**Error:** 401 for invalid credentials.

### POST /api/auth/guest

Start a session as the pre-seeded guest user.

**Response** 200:
`json
{
  "user": { "id": "seed-guest", "name": "Guest User", "email": "guest@jini.local", "role": "guest" }
}
`

### GET /api/auth/me

Get the currently authenticated user's info.

**Response** 200:
`json
{
  "user": { "id": "string", "name": "string", "email": "string", "role": "string" }
}
`

**Error:** 401 if not authenticated.

### POST /api/auth/logout

End the current session.

**Response:** 204 No Content

---

## Documents

### GET /api/documents

List all documents owned by the current user.

**Response** 200:
`json
[
  {
    "id": "string",
    "ownerId": "string",
    "title": "string",
    "originalName": "string",
    "mimeType": "string",
    "size": 12345,
    "uploadedAt": "ISO-8601",
    "category": "General",
    "tags": ["tag1"],
    "summary": "string",
    "dates": [],
    "amounts": []
  }
]
`

Note: extractedText and chunks are omitted from the list response.

### GET /api/documents/:id

Get a single document with full extracted text and chunks.

**Response** 200: Full VaultDocument object.

**Error:** 404 if not found or not owned by user.

### POST /api/documents

Upload and index one or more documents.

- **Content-Type:** multipart/form-data
- **Field name:** documents (array of files)
- **Limits:** 25 MB per file, 12 files per request
- **Accepted types:** .pdf, .docx, .xlsx, .csv, .txt, .md, .json

**Response** 201:
`json
{
  "documents": [],
  "reminders": []
}
`

### DELETE /api/documents/:id

Delete a document and its reminders. Also deletes the uploaded file.

**Response:** 204 if deleted, 404 if not found.

---

## Query and Search

### POST /api/query

Ask a question against the user's document vault using RAG.

**Body:**
`json
{
  "question": "string (min 2 chars)",
  "category": "string (optional, filter by category)",
  "history": [
    { "role": "user", "content": "string (max 1600)" },
    { "role": "assistant", "content": "string (max 1600)" }
  ]
}
`

history is limited to 8 turns.

**Response** 200:
`json
{
  "answer": "string",
  "mode": "extractive | llm",
  "citations": [
    {
      "documentId": "string",
      "documentTitle": "string",
      "category": "string",
      "chunkId": "string",
      "snippet": "string (360 chars)",
      "score": 0.123
    }
  ],
  "suggestedActions": ["string"]
}
`

- mode: "llm" when Groq synthesized the answer; "extractive" when local.
- Citations contain the top 5 matching chunks.

### GET /api/search

Raw search across user documents.

**Query parameters:**
- q (string): search query
- category (string, default "All"): filter by category

**Response** 200:
`json
[
  {
    "documentId": "string",
    "documentTitle": "string",
    "category": "string",
    "snippet": "string (360 chars)",
    "score": 0.123
  }
]
`

---

## Reminders

### GET /api/reminders

List all reminders for the current user, ordered by due date ascending.

**Response** 200:
`json
[
  {
    "id": "string",
    "ownerId": "string",
    "documentId": "string",
    "documentTitle": "string",
    "title": "string",
    "dueDate": "2026-05-14",
    "sourceText": "string",
    "category": "string",
    "status": "open | done",
    "createdAt": "ISO-8601"
  }
]
`

### PATCH /api/reminders/:id

Update reminder status.

**Body:**
`json
{ "status": "open | done" }
`

**Response** 200: Updated reminder object.

**Error:** 404 if not found.

---

## Insights

### GET /api/insights

Dashboard aggregates.

**Response** 200:
`json
{
  "totals": {
    "documents": 5,
    "chunks": 42,
    "reminders": 3,
    "extractedAmounts": 12
  },
  "categoryCounts": { "General": 2, "Banking": 1 },
  "highValuePayments": [],
  "subscriptions": [],
  "upcomingDates": [],
  "taxChecklist": []
}
`

---

## AI Settings

### GET /api/settings/ai

Get current AI configuration status.

**Response** 200:
`json
{
  "configured": true,
  "model": "llama-3.3-70b-versatile",
  "source": "environment | session | none",
  "provider": "Groq"
}
`

### PUT /api/settings/ai

Set a session-only Groq API key and model.

**Body:**
`json
{
  "apiKey": "string (min 20 chars)",
  "model": "string (default: llama-3.3-70b-versatile)"
}
`

**Response** 200: Updated AI settings.

### DELETE /api/settings/ai

Clear the session-only Groq configuration.

**Response** 200: AI settings (configured: false).

---

## Demo

### POST /api/demo/seed

Replace demo documents for the current user with fresh sample data.

**Response** 201:
`json
{
  "documents": [],
  "reminders": []
}
`

---

## Health

### GET /api/health

**Response** 200:
`json
{
  "ok": true,
  "service": "Jini",
  "groq": true
}
`

---

## Error Responses

All errors return JSON:

`json
{
  "error": "Human-readable error message",
  "requestId": "unique-id"
}
`

| Status | Description |
|--------|-------------|
| 400    | Validation error, unsupported file type, multer error |
| 401    | Authentication required |
| 404    | Resource not found |
| 409    | Email already exists |
| 429    | Rate limited (includes Retry-After header) |
| 500    | Unexpected server error |

---

## Rate Limiting

| Route prefix | Window | Max requests |
|-------------|--------|--------------|
| /api/auth | 15 min | 60 |
| /api | 1 min | 240 |

Rate limit buckets reset on server restart.
