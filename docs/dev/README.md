# Jini — Developer Guide

**Private Document Intelligence**

Jini is a local-first RAG workspace for personal documents. It turns policies, statements, agreements, invoices, tax records, and other life-admin files into searchable answers, reminders, and structured insights.

---

## Quick Start

```bash
# Clone and install
git clone <repo-url> jini
cd jini
npm install

# Copy environment file
cp .env.example .env

# Start development (web + API concurrently)
npm run dev
```

- **Web app:** http://localhost:5173
- **API server:** http://localhost:8788
- **In-app docs:** http://localhost:5173/docs

### Default test accounts

| Account  | Email              | Password       |
|----------|--------------------|----------------|
| Test     | test@jini.local    | JiniTest123!   |
| HR       | hr@jini.local      | JiniHR123!     |
| Guest    | guest@jini.local   | JiniGuest123!  |

The guest button on the login screen also provides one-click access with pre-seeded demo data.

---

## Project Structure

```
jini/
├── server/              # Express API server (Node SQLite backend)
│   ├── index.ts         # Route definitions, middleware, bootstrap
│   ├── auth.ts          # User signup/login/sessions (scrypt, SQLite)
│   ├── storage.ts       # Vault document/reminder CRUD (SQLite)
│   ├── aiConfig.ts      # Groq API key management (env + session)
│   ├── extractors.ts    # PDF, DOCX, XLSX, CSV, TXT text extraction
│   ├── ingest.ts        # Category inference, chunking, reminder creation
│   ├── rag.ts           # TF-IDF retrieval, extractive answers, intent matching
│   ├── llm.ts           # Groq LLM answer synthesis
│   ├── insights.ts      # Dashboard aggregates (payments, dates, tax checklist)
│   ├── security.ts      # CSP headers, rate limiting
│   ├── textUtils.ts     # Tokenizer, date/amount extraction, summarization
│   ├── types.ts         # Shared TypeScript types
│   └── sampleData.ts    # Demo document seeding
├── src/                 # React SPA (Vite + TypeScript)
│   ├── main.tsx         # App entry — routes /docs vs /app
│   ├── Jini.tsx         # Main app component (1900+ lines)
│   ├── Jini.css         # Dark Supabase-inspired styles
│   ├── Docs.tsx         # In-app documentation page
│   ├── Docs.css         # Documentation styles
│   └── index.css        # Global reset styles
├── data/                # Local storage (gitignored)
│   ├── jini.sqlite      # SQLite database (users, sessions, documents, reminders)
│   └── uploads/         # Uploaded file storage
├── public/              # Static assets
│   ├── favicon.svg
│   └── icons.svg
├── dist/                # Production build output (gitignored)
├── docs/dev/            # Developer documentation (you are here)
└── logs/                # Log output (gitignored)
```

---

## Tech Stack

| Layer        | Technology                            |
|--------------|---------------------------------------|
| Frontend     | React 19, TypeScript, Vite 8          |
| Backend      | Express 5, TypeScript, tsx runner     |
| Database     | SQLite (Node built-in `node:sqlite`)  |
| Auth         | scrypt hashing, HMAC session tokens   |
| LLM          | Groq (OpenAI-compatible API)          |
| File parsing | pdf-parse, mammoth, read-excel-file   |
| Dev runner   | concurrently (web + API)              |

---

## Key Architecture Decisions

### Local-First by Default
All data lives in `data/jini.sqlite` and `data/uploads/`. No cloud dependency. The app works fully offline without any API key.

### Extractive RAG Without an API Key
Document retrieval uses TF-IDF scoring on chunked text. Answers are built from ranked snippets. This works entirely on-device.

### Optional Groq Synthesis
When a Groq API key is configured (via `.env` or in-app Settings), retrieved evidence is sent to Groq for a cited natural-language answer. The API key never reaches the browser.

### SQLite with WAL Mode
Both auth (users, sessions) and vault (documents, reminders) use Node's built-in `node:sqlite` with WAL journal mode for concurrent read performance.

### Security Headers
Every response includes CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and Cross-Origin-Opener-Policy headers.

---

## Available Scripts

| Script          | Description                                      |
|-----------------|--------------------------------------------------|
| `npm run dev`   | Start web (Vite) + API (tsx watch) concurrently  |
| `npm run dev:web` | Start Vite dev server only                     |
| `npm run dev:api` | Start API with hot-reload (tsx watch)          |
| `npm run api`   | Start API server only (no watch)                 |
| `npm start`     | Start API server (production entrypoint)         |
| `npm run build` | Type-check + build frontend (tsc + vite build)   |
| `npm run lint`  | Run ESLint across all TS/TSX files               |
| `npm run preview` | Preview production build locally               |

---

## Development Workflow

### 1. Environment Setup

```bash
cp .env.example .env
```

Key variables:

| Variable             | Required | Default                     | Description                              |
|----------------------|----------|-----------------------------|------------------------------------------|
| `PORT`               | No       | `8788`                      | API server port                          |
| `GROQ_API_KEY`       | No       | —                           | Groq API key for LLM answers             |
| `GROQ_MODEL`         | No       | `llama-3.3-70b-versatile`   | Groq model name                          |
| `ALLOWED_ORIGINS`    | No       | —                           | Comma-separated CORS origins             |
| `COOKIE_SECURE`      | No       | `false`                     | Set `true` behind HTTPS                  |
| `TRUST_PROXY`        | No       | —                           | Set `true` behind a reverse proxy        |

### 2. Run Tests

There are currently no automated tests. To verify changes:

```bash
# Start the API
npm run dev:api

# In another terminal, verify health
curl http://localhost:8788/api/health

# Run the linter
npm run lint

# Build the frontend
npm run build
```

### 3. Making Changes

- The API server uses `tsx watch` for auto-restart on file changes.
- Vite's dev server proxies `/api` to `http://localhost:8788`.
- Frontend changes reflect instantly via HMR.
- Add server routes in `server/index.ts`.
- Add frontend views in `src/` (all state is in `Jini.tsx`).

---

## API Overview

All authenticated routes require a session cookie set by `POST /api/auth/login`, `/signup`, or `/guest`.

| Method | Path                    | Description                          |
|--------|-------------------------|--------------------------------------|
| POST   | `/api/auth/signup`      | Create account + start session       |
| POST   | `/api/auth/login`       | Authenticate + start session         |
| POST   | `/api/auth/guest`       | Guest session                        |
| GET    | `/api/auth/me`          | Current user info                    |
| POST   | `/api/auth/logout`      | End session                          |
| GET    | `/api/documents`        | List user's documents                |
| GET    | `/api/documents/:id`    | Get document detail                  |
| POST   | `/api/documents`        | Upload and index documents           |
| DELETE | `/api/documents/:id`    | Delete a document                    |
| POST   | `/api/query`            | Ask a question (RAG)                 |
| GET    | `/api/search?q=&cat=`   | Raw search                           |
| GET    | `/api/reminders`        | List reminders                       |
| PATCH  | `/api/reminders/:id`    | Update reminder status               |
| GET    | `/api/insights`         | Dashboard aggregates                 |
| GET    | `/api/settings/ai`      | Get AI config status                 |
| PUT    | `/api/settings/ai`      | Set session-only Groq config         |
| DELETE | `/api/settings/ai`      | Clear session Groq config            |
| POST   | `/api/demo/seed`        | Seed demo documents                  |
| GET    | `/api/health`           | Health check                         |

Full details in [API.md](./API.md).

---

## Document Processing Pipeline

```
Upload → Extract (PDF/DOCX/XLSX/CSV/TXT) → Ingest:
  1. Infer category (keyword rules)
  2. Infer tags
  3. Extract dates (regex + date-fns parsing)
  4. Extract amounts (INR currency regex)
  5. Generate summary (keyword-scored sentence selection)
  6. Split into chunks (850 char, 120 overlap, sentence boundaries)
  7. Create reminders from expiry/payment dates
→ Store in SQLite
```

---

## Deployment

See [DEPLOY.md](./DEPLOY.md) for EC2, Docker, and PM2 deployment guides.

---

## Security

See [SECURITY.md](./SECURITY.md) for the full security model, CSP details, and threat considerations.

---

## Comparison with In-App Docs

The in-app docs at `/docs` are end-user product documentation. These `docs/dev/` files are for developers contributing to or deploying Jini.
