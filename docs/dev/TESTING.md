# Testing Guide

## Overview

Jini uses **Vitest** for unit testing. Tests run in Node.js and cover the core server-side logic: text extraction, document processing, and RAG retrieval.

```bash
npm test                # Run once
npm run test:watch      # Watch mode
```

Tests are automatically run in CI (GitHub Actions) on every push to `main`.

---

## Test Suites

### `server/textUtils.test.ts` — 23 tests

| Group | Tests | Description |
|-------|-------|-------------|
| `tokenize` | 4 | Lowercase conversion, stop word removal, short token filtering, empty input |
| `normalizeWhitespace` | 2 | Collapse spaces, trim edges |
| `splitIntoChunks` | 2 | Creates chunks, handles short text |
| `inferCategory` | 3 | Tax, Warranty, General |
| `inferTags` | 2 | Category included, expiry detected |
| `summarizeText` | 2 | Empty fallback, sentence extraction |
| `extractDates` | 3 | d MMM yyyy, yyyy-MM-dd, no dates |
| `extractAmounts` | 4 | INR, ₹ symbol, below-threshold, no amounts |
| `formatCurrency` | 1 | INR formatting |

### `server/rag.test.ts` — 7 tests

| Group | Tests | Description |
|-------|-------|-------------|
| `searchDocuments` | 4 | Matching query, non-matching, category filter, 8-result cap |
| `createExtractiveAnswer` | 3 | Greeting, no evidence, evidence provided |

---

## Running Specific Tests

```bash
# Run a single test file
npx vitest run server/textUtils.test.ts

# Run tests matching a pattern
npx vitest run --reporter=verbose

# Run with coverage
npx vitest run --coverage
```

---

## Writing Tests

Tests use Vitest's globals API (`describe`, `it`, `expect`). Type definitions are in `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts", "src/**/*.test.ts"],
  },
});
```

### Example

```typescript
import { describe, it, expect } from "vitest";
import { tokenize } from "./textUtils";

describe("tokenize", () => {
  it("splits text into lowercase tokens", () => {
    expect(tokenize("Hello World")).toEqual(["hello", "world"]);
  });
});
```

---

## Extending Tests

Priority areas for additional tests:

1. **Integration tests** — Use supertest to test API endpoints (auth, documents, query)
2. **Server startup** — Test that the Express app boots without errors
3. **`server/insights.ts`** — Dashboard aggregate calculations
4. **`server/ingest.ts`** — Full document processing pipeline
5. **E2E tests** — Playwright for browser flows (login, upload, query)

---

## Manual Testing (API)

```bash
# Health check
curl http://localhost:8788/api/health

# Auth flow
curl -X POST http://localhost:8788/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@jini.local","password":"JiniTest123!"}' \
  -c cookies.txt

# Query
curl -X POST http://localhost:8788/api/query \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"question":"What are my upcoming deadlines?"}'
```
