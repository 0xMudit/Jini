# Jini

**Private Document Intelligence**

Jini is a local-first RAG workspace for personal documents. It turns policies, statements, agreements, invoices, tax records, and other life-admin files into searchable answers, reminders, and structured insights.

## Product Experience

- Guided first-visit tour and safe guest workspace.
- Clear Home, Ask Jini, Library, Timeline, and Settings workflows.
- Dark Supabase-inspired interface built for fast scanning.
- In-app Groq setup with a session-only key option.
- SQLite-backed sign-in, sign-up, and isolated user workspaces.
- Persistent `.env` setup for local development.
- Responsive desktop and mobile navigation.

## Core Capabilities

- Upload PDF, DOCX, XLSX, CSV, TXT, Markdown, and JSON files.
- Extract text and infer categories, tags, dates, amounts, and summaries.
- Retrieve relevant passages and answer with document citations.
- Use local extractive RAG without an API key.
- Optionally synthesize answers with Groq.
- Create reminders from expiry, due, warranty, and renewal dates.
- Surface high-value payments, subscriptions, tax coverage, and category mix.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The API runs at `http://localhost:8788`; Vite proxies `/api` requests to it.

Product documentation is available at `http://localhost:5173/docs`.

## Seeded Test Accounts

- Test user: `test@jini.local` / `JiniTest123!`
- Guest: use the **Try live demo** button for one-click access.

## Groq Setup

Use **Settings > AI connection** in the app for a server-session key. The key remains in server memory and is cleared when the API server stops.

For persistent local configuration:

```bash
copy .env.example .env
```

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Without a key, document extraction, search, citations, reminders, and extractive answers continue to work locally.

## Deploy on EC2

Use Node.js 22 or newer. The server uses Node's built-in SQLite module.

```bash
git clone <your-repo-url> jini
cd jini
npm install
cp .env.example .env
nano .env
npm run build
npm start
```

For a public EC2 demo over plain HTTP, keep:

```env
PORT=8788
COOKIE_SECURE=false
```

Add your Groq key directly on the server in `.env`; do not commit `.env` to GitHub.

Open port `8788` in the EC2 security group, then visit:

```text
http://<EC2_PUBLIC_IP>:8788
```

For a persistent process:

```bash
npm install -g pm2
pm2 start npm --name jini -- start
pm2 save
```

If you put Jini behind HTTPS/Nginx, set `COOKIE_SECURE=true` and use your domain in `ALLOWED_ORIGINS` only if the API and web app are served from different origins.

## Architecture

```text
server/
  aiConfig.ts     Runtime and environment AI configuration
  extractors.ts   PDF, DOCX, spreadsheet, and text extraction
  ingest.ts       Category, date, amount, chunk, and reminder extraction
  insights.ts     Dashboard aggregates
  auth.ts         SQLite users, password hashing, and cookie sessions
  llm.ts          Optional Groq answer synthesis
  rag.ts          Retrieval and extractive answers
  storage.ts      Local JSON and upload storage
src/
  Jini.tsx        Product workflows and interaction state
  Jini.css        Supabase-inspired dark interface
data/
  uploads/        Local uploaded files
  vault-store.json
```

`data/` and `.env` are ignored by git because they may contain private content.

## Resume Summary

Built Jini, a local-first private-document intelligence platform using React, TypeScript, Express, and retrieval-augmented generation. Implemented multi-format ingestion, text extraction, chunking, ranked retrieval, grounded citations, optional LLM synthesis, entity extraction, reminders, financial insights, secure runtime API-key configuration, and a responsive guided onboarding experience.
