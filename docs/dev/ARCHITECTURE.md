# Architecture

## System Design

```
┌──────────────┐     Vite Proxy      ┌──────────────────────────────┐
│   Browser    │ ──── /api/* ──────▶ │        Express API           │
│  (React 19)  │ ◀───────────────── │     (localhost:8788)         │
│ localhost:5173│                    │                              │
│              │                    │  ├── auth.ts (SQLite users)  │
│              │                    │  ├── storage.ts (SQLite docs)│
│              │                    │  ├── extractors.ts           │
│              │                    │  ├── ingest.ts               │
│              │                    │  ├── rag.ts (TF-IDF)         │
│              │                    │  ├── llm.ts (Groq)           │
│              │                    │  └── security.ts             │
└──────────────┘                    └──────────────────────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │    data/jini.sqlite   │
                                    │    data/uploads/      │
                                    └──────────────────────┘
```

## Data Flow

### Authentication
```
Signup/Login → scrypt(password) → SQLite users table
           → randomBytes(32) session token
           → sha256(token) → SQLite sessions table
           → HttpOnly SameSite=Lax cookie
```

### Document Upload
```
POST /api/documents (multipart)
  → Multer saves to data/uploads/
  → extractTextFromFile() (pdf/docx/xlsx/csv/txt)
  → createDocumentFromText():
      • inferCategory()
      • inferTags()
      • extractDates()
      • extractAmounts()
      • summarizeText()
      • splitIntoChunks()
      • createReminders()
  → SQLite INSERT (transaction)
  → Cleanup temp uploads
```

### Query Flow
```
POST /api/query { question, category?, history? }
  → listDocuments(ownerId)
  → searchDocuments(): TF-IDF token scoring
      • tokenize(question) → query tokens
      • for each chunk: score = frequency / sqrt(len) + title/category/tags boost
      • return top 8 scored chunks
  → createExtractiveAnswer():
      • Check conversational intents (hi, thanks, uploaded)
      • Check known intents (payments, dates, subscriptions)
      • Fallback: concatenate top 3 snippets
  → answerWithGroq() [if configured]:
      • Build system + history + context prompt
      • Send to Groq API
      • Return synthesized answer
  → Return { answer, mode, citations, suggestedActions }
```

## Database Schema

### Auth Tables (`jini.sqlite`)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('hr', 'guest', 'member')),
  created_at TEXT NOT NULL
);

-- Sessions
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### Vault Tables (same database)

```sql
-- Documents (JSON payload column)
CREATE TABLE vault_documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  payload TEXT NOT NULL        -- serialized VaultDocument JSON
);

-- Reminders (JSON payload column)
CREATE TABLE vault_reminders (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'done')),
  payload TEXT NOT NULL         -- serialized Reminder JSON
);
```

Documents and reminders use JSON payload columns for schema flexibility. The TypeScript types in `types.ts` define the shape.

## Key Design Decisions

### JSON Payload Columns
Rather than a fully normalized schema, documents and reminders store full objects as JSON. This avoids schema migration overhead and keeps the TypeScript types as the single source of truth. The `stored_name`, `owner_id`, and `due_date` columns enable indexing for common queries.

### In-Memory Rate Limiting
Rate limit buckets live in a `Map` in `security.ts`. This means rate limits reset on server restart. For multi-process deployments, a shared store (Redis) would be needed.

### Session-Only API Keys
Groq keys can be set via the Settings UI; they live only in server memory and vanish when the process restarts. Environment-level keys in `.env` persist.

### Chunking Strategy
Documents are split into ~850-character chunks with 120-character overlap at sentence boundaries. This ensures context continuity while keeping chunks small enough for meaningful TF-IDF scoring.

### TF-IDF Scoring
Each chunk is scored against the query tokens. Title, category, and tag matches receive bonus weight. Recent documents get a small time-based boost for "latest" queries.
