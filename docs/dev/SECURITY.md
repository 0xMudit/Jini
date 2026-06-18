# Security Model

## Overview

Jini is designed as a local-first application. Security boundaries exist between the browser, the API server, and the filesystem.

---

## Authentication

### Password Storage
- Passwords are hashed with **scrypt** using a 16-byte random salt and 64-byte derived key.
- The salt and hash are stored as salt:hash in the users table.
- Verification uses 	imingSafeEqual to prevent timing attacks.

### Session Tokens
- Session tokens are 32 cryptographically random bytes (andomBytes(32)), Base64URL-encoded.
- Tokens are SHA-256 hashed before storage in the sessions table. Plaintext tokens are never persisted.
- Sessions expire after 7 days. Expired sessions are cleaned up on server start.

### Cookie Security
- Session cookie is **HttpOnly** (inaccessible to JavaScript).
- **SameSite=Lax** protects against CSRF.
- **Secure** flag is enabled when COOKIE_SECURE=true (behind HTTPS).
- The cookie name is jini_session.

---

## API Security

### Rate Limiting
- In-memory rate limiting per IP address.
- Auth endpoints: 60 requests per 15-minute window.
- General API: 240 requests per 1-minute window.
- Rate-limited requests receive 429 status with Retry-After header.

### CORS
- Whitelist-based CORS via ALLOWED_ORIGINS env variable.
- Local origins (localhost, 127.0.0.1, [::1]) are always allowed.
- Credentials (cookies) are only sent to allowed origins.

### Input Validation
- All request bodies are validated with **Zod** schemas.
- String length limits prevent abuse (e.g., passwords max 128 chars).
- File uploads are restricted by type and size (25 MB max, 12 files max).

### Security Headers

| Header | Value |
|--------|-------|
| X-Content-Type-Options | 
osniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() |
| Cross-Origin-Opener-Policy | same-origin |
| Content-Security-Policy | default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' |
| X-Request-Id | Unique ID per request for tracing |
| X-Powered-By | Disabled |

### Error Handling
- Server errors return a generic "Unexpected server error" message.
- Validation errors expose only the first Zod issue message.
- All errors include a equestId for log correlation.

---

## Data Isolation

- Every vault query is scoped to ownerId derived from the authenticated session.
- GET /api/documents/:id verifies ownership before returning data.
- Users cannot access other users' documents, reminders, or settings.

---

## API Key Security

### Groq API Key
- Key set via Settings UI lives **only in server memory** (sessionApiKey variable).
- It is **never sent to the browser**.
- It is **cleared when the server restarts**.
- Key set in .env file persists across restarts but stays on the filesystem.
- When querying, only the retrieved snippets (not full documents) are sent to Groq.

### No Keys in Transit to Browser
The /api/settings/ai endpoint returns { configured: true/false } but never the key itself.

---

## File System Security

- Uploaded files are stored in data/uploads/ with random filenames (via multer).
- File extensions are validated against an allowlist.
- File size is limited to 25 MB.
- Document text extraction does not execute any code from uploaded files.
- Deleted files are removed from the filesystem.

---

## SQLite Security

- WAL mode is enabled for concurrent read performance.
- Foreign key constraints are enforced.
- Queries use parameterized prepared statements (no SQL injection risk).
- The database file is stored in data/ which is gitignored.

---

## CSP Bypass Considerations

The CSP allows img-src 'self' data: blob: and style-src 'self'. If user-uploaded content is ever rendered as HTML (not currently the case), this could be a vector. Currently, extracted text is displayed as plain text in React.

---

## Threat Model

| Threat | Mitigation |
|--------|------------|
| XSS via document content | Content rendered as text, CSP restricts script execution |
| CSRF | SameSite=Lax cookies |
| Session hijacking | HttpOnly cookie, SHA-256 hashed tokens in DB |
| Brute force login | Rate limiting (60/15min per IP) |
| SQL injection | Parameterized queries |
| Unauthorized document access | Owner-scoped queries |
| API key leak | Keys never returned to browser, session keys in memory only |
| File upload RCE | Extension allowlist, no code execution |
| Timing attack on passwords | 	imingSafeEqual for scrypt verification |
