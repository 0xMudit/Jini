# Jini

**Private Document Intelligence** — a local-first RAG workspace for personal documents.

Turn policies, statements, agreements, invoices, tax records, and other life-admin files into searchable answers, reminders, and structured insights.

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:8788`; Vite proxies `/api` to it.

### Test accounts
- **Test user**: `test@jini.local` / `JiniTest123!`
- **Guest**: click **Try live demo** for one-click access with sample data

---

## Features

- **Upload** PDF, DOCX, XLSX, CSV, TXT, Markdown, and JSON files
- **Extract** text, categories, tags, dates, amounts, and summaries automatically
- **Search** with ranked retrieval and document citations
- **Ask** questions with local extractive RAG (no API key required)
- **Synthesize** answers via Groq (optional, configure in Settings or `.env`)
- **Track** reminders from expiry, due, warranty, and renewal dates
- **Surface** high-value payments, subscriptions, tax coverage, and category mix
- **Works offline** — documents and data stay on your machine

---

## Production Deployment

### Docker (recommended)

```bash
docker build -t jini .
docker run -d \
  -p 8788:8788 \
  -v jini-data:/app/data \
  -e GROQ_API_KEY=gsk_your_key_here \
  jini
```

Or with `docker-compose.yml`:

```yaml
services:
  jini:
    build: .
    ports:
      - "8788:8788"
    volumes:
      - jini-data:/app/data
    environment:
      - GROQ_API_KEY=gsk_your_key_here
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8788/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  jini-data:
```

### EC2 (without Docker)

Requires Node.js 22+.

```bash
git clone https://github.com/0xMudit/Jini.git
cd Jini
npm install
cp .env.example .env
nano .env              # add GROQ_API_KEY, adjust PORT if needed
npm run build
npm start
```

For a persistent process:

```bash
npm install -g pm2
pm2 start npm --name jini -- start
pm2 save
```

Open port `8788` in the EC2 security group, then visit `http://<EC2_PUBLIC_IP>:8788`.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8788` | HTTP server port |
| `NODE_ENV` | `production` | Set `development` for pretty logging |
| `LOG_LEVEL` | `info` | Pino log level (debug, info, warn, error) |
| `GROQ_API_KEY` | — | Groq API key for LLM synthesis |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model name |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS origins |

---

## Testing

```bash
npm test              # run once
npm run test:watch    # watch mode
```

30 unit tests covering text extraction, chunking, categorization, date/amount parsing, RAG scoring, and extractive answers.

---

## CI/CD

Push to `main` triggers GitHub Actions:
1. Lint → Test → Build
2. Docker image built and pushed to `ghcr.io/0xMudit/Jini:latest`

---

## Project Structure

```
server/
  index.ts          Express app, routes, middleware
  auth.ts           SQLite users, scrypt hashing, cookie sessions
  aiConfig.ts       Runtime Groq configuration
  extractors.ts     PDF, DOCX, XLSX, CSV, text extraction
  ingest.ts         Document processing pipeline
  insights.ts       Dashboard aggregates
  llm.ts            Groq answer synthesis
  rag.ts            Retrieval, scoring, extractive answers
  security.ts       CSP headers, rate limiting
  storage.ts        SQLite document/reminder storage
  textUtils.ts      Tokenization, chunking, date/amount parsing
  textUtils.test.ts Unit tests for text utilities
  rag.test.ts       Unit tests for RAG pipeline
src/
  Jini.tsx          Main app component
  types.ts          Shared TypeScript types
  lib/api.ts        API client, error handling, formatters
  components/       ErrorBoundary, EmptyState, Metric, etc.
  views/            AuthScreen, HomeView, AssistantView, etc.
data/
  uploads/          Uploaded files (gitignored)
  jini.sqlite       SQLite database (gitignored)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, Lucide icons |
| Backend | Express 5, TypeScript, tsx |
| Database | SQLite (Node `node:sqlite`, WAL mode) |
| AI | Groq API (OpenAI-compatible), local extractive RAG |
| Logging | Pino with pino-pretty (dev) |
| Testing | Vitest |
| CI | GitHub Actions |
| Container | Docker (multi-stage, Alpine) |
