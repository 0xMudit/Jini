# Jini — Developer Guide

**Private Document Intelligence** — a local-first RAG workspace for personal documents.

---

## Quick Start

```bash
git clone https://github.com/0xMudit/Jini.git
cd Jini
npm install
cp .env.example .env
npm run dev
```

- **Web app:** http://localhost:5173
- **API server:** http://localhost:8788
- **In-app docs:** http://localhost:5173/docs

### Default test accounts

| Account | Email | Password |
|---------|-------|----------|
| Test | test@jini.local | JiniTest123! |
| HR | hr@jini.local | JiniHR123! |
| Guest | guest@jini.local | JiniGuest123! |

The guest button on the login screen also provides one-click access with pre-seeded demo data.

---

## Project Structure

```
jini/
├── server/                 # Express API server
│   ├── index.ts            # Routes, middleware, bootstrap
│   ├── auth.ts             # User auth (scrypt, SQLite sessions)
│   ├── storage.ts          # Document/reminder CRUD (SQLite)
│   ├── aiConfig.ts         # Groq API key management
│   ├── extractors.ts       # PDF, DOCX, XLSX, CSV, TXT extraction
│   ├── ingest.ts           # Category inference, chunking, reminders
│   ├── rag.ts              # TF-IDF retrieval, extractive answers
│   ├── llm.ts              # Groq LLM synthesis
│   ├── insights.ts         # Dashboard aggregates
│   ├── security.ts         # CSP headers, rate limiting
│   ├── textUtils.ts        # Tokenizer, date/amount extraction
│   ├── types.ts            # Shared TypeScript types
│   ├── sampleData.ts       # Demo document seeding
│   ├── textUtils.test.ts   # Unit tests for text utilities
│   └── rag.test.ts         # Unit tests for RAG pipeline
├── src/                    # React SPA (Vite + TypeScript)
│   ├── main.tsx            # Entry point with ErrorBoundary
│   ├── Jini.tsx            # Main app component
│   ├── Jini.css            # Dark UI styles
│   ├── Docs.tsx / Docs.css # In-app documentation
│   ├── index.css           # Global reset styles
│   ├── types.ts            # Shared frontend types
│   ├── lib/
│   │   └── api.ts          # API client, error handling, formatters
│   ├── components/         # Reusable UI components
│   │   ├── ErrorBoundary.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Metric.tsx
│   │   ├── ProductTour.tsx
│   │   ├── ReminderRow.tsx
│   │   └── SectionHeading.tsx
│   └── views/              # Page-level view components
│       ├── AuthScreen.tsx
│       ├── HomeView.tsx
│       ├── AssistantView.tsx
│       ├── LibraryView.tsx
│       ├── TimelineView.tsx
│       └── SettingsView.tsx
├── data/                   # Local storage (gitignored)
│   ├── jini.sqlite         # SQLite database
│   └── uploads/            # Uploaded files
├── dist/                   # Production build (gitignored)
├── docs/dev/               # Developer docs (you are here)
├── Dockerfile              # Multi-stage production build
├── vitest.config.ts        # Test configuration
└── .github/workflows/ci.yml # CI/CD pipeline
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start web (Vite) + API (tsx watch) concurrently |
| `npm run dev:web` | Start Vite dev server only |
| `npm run dev:api` | Start API with hot-reload (tsx watch) |
| `npm run api` | Start API server only (no watch) |
| `npm start` | Start API server (production entrypoint) |
| `npm run build` | Type-check + build frontend (tsc + vite build) |
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint across all TS/TSX files |
| `npm run preview` | Preview production build locally |

---

## Testing

30 unit tests covering the core extraction and RAG logic:

```bash
npm test                # Run once
npm run test:watch      # Watch mode
```

See [TESTING.md](./TESTING.md) for details.

---

## CI/CD

Push to `main` triggers GitHub Actions:
1. **Lint** — ESLint
2. **Test** — Vitest (30 tests)
3. **Build** — TypeScript check + Vite production build
4. **Docker** — Build and push to `ghcr.io/0xMudit/Jini:latest`

See `.github/workflows/ci.yml` for the full pipeline.

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

### Structured Logging
Uses Pino with request-level logging (method, path, status, duration per request). Pretty-printed in development, JSON in production.

### Graceful Shutdown
Handles SIGTERM/SIGINT with a 10-second forced shutdown timeout. Unhandled rejections and uncaught exceptions are logged.

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

See [DEPLOY.md](./DEPLOY.md) for Docker and EC2 deployment guides.

---

## Security

See [SECURITY.md](./SECURITY.md) for the full security model, CSP details, and threat considerations.

---

## Comparison with In-App Docs

The in-app docs at `/docs` are end-user product documentation. These `docs/dev/` files are for developers contributing to or deploying Jini.
