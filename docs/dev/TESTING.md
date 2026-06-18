# Testing Guide

## Current State

Jini does not currently have automated test suites. Testing is done manually by running the application and verifying behavior.

---

## Manual Testing Workflow

### Prerequisites

`ash
npm install
npm run dev
`

### 1. Smoke Test

`ash
# Verify API is running
curl http://localhost:8788/api/health

# Expected:
# {"ok":true,"service":"Jini","groq":false}
`

### 2. Authentication Flow

`ash
# Sign up
curl -X POST http://localhost:8788/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Login
curl -X POST http://localhost:8788/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@jini.local","password":"JiniTest123!"}' \
  -c cookies.txt

# Get current user
curl http://localhost:8788/api/auth/me -b cookies.txt

# Logout
curl -X POST http://localhost:8788/api/auth/logout -b cookies.txt
`

### 3. Document Upload and Query

`ash
# Upload a document
curl -X POST http://localhost:8788/api/documents \
  -b cookies.txt \
  -F "documents=@test-document.pdf"

# List documents
curl http://localhost:8788/api/documents -b cookies.txt

# Ask a question
curl -X POST http://localhost:8788/api/query \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"question":"What are my upcoming deadlines?"}'

# Search
curl "http://localhost:8788/api/search?q=insurance&category=All" -b cookies.txt
`

### 4. Reminders and Insights

`ash
# List reminders
curl http://localhost:8788/api/reminders -b cookies.txt

# Mark reminder as done
curl -X PATCH http://localhost:8788/api/reminders/<id> \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}'

# Get insights
curl http://localhost:8788/api/insights -b cookies.txt
`

---

## Testing Categories

### Authentication
- Signup with valid data
- Signup with duplicate email (expect 409)
- Login with wrong password (expect 401)
- Guest login
- Access protected routes without cookie (expect 401)
- Session expiry (wait 7 days or manipulate DB)

### Document Upload
- Upload each supported format (PDF, DOCX, XLSX, CSV, TXT, MD, JSON)
- Upload unsupported format (expect 400)
- Upload file exceeding 25 MB (expect 400)
- Upload more than 12 files (expect 400)
- Upload and verify document is listed

### Document Processing
- Verify category inference matches document content
- Verify dates are extracted correctly (various formats)
- Verify amounts are extracted correctly (INR format)
- Verify reminders are created for expiry/due dates

### Query/RAG
- Ask question matching content (expect cited answer)
- Ask unrelated question (expect no-evidence response)
- Ask conversational (hi, thanks)
- Ask for payments above threshold
- Ask for upcoming dates
- Ask with Groq key configured (expect llm mode)
- Ask without Groq key (expect extractive mode)

### Security
- No SQL injection via document content or query
- No XSS via document titles or extracted text
- Session cookie is HttpOnly
- Rate limiting blocks excessive requests

---

## Future Test Infrastructure

When adding automated tests, consider:

### Unit Tests (Vitest)
- server/textUtils.ts — tokenize, extractDates, extractAmounts, inferCategory, splitIntoChunks
- server/rag.ts — searchDocuments, createExtractiveAnswer
- server/ingest.ts — createDocumentFromText
- server/insights.ts — buildInsights

### Integration Tests (Supertest + Vitest)
- Auth endpoints (signup, login, guest, me, logout)
- Document CRUD (upload, list, get, delete)
- Query and search endpoints
- Reminder lifecycle
- AI settings endpoints
- Demo seed endpoint

### E2E Tests (Playwright)
- Login flow
- Guest access with demo data
- Upload document and verify it appears
- Ask question and verify answer renders
- Navigate all tabs (Home, Ask, Library, Timeline, Settings)
