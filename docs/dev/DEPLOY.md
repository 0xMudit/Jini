# Deployment Guide

## Prerequisites

- Node.js 22 or newer (uses built-in `node:sqlite`)
- npm 10+

---

## Production Build

```bash
npm install
npm run build
npm start
```

This builds the frontend to `dist/` and starts the Express server on the configured port.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 8788 | API server port |
| NODE_ENV | No | production | Set "development" for pretty logging |
| LOG_LEVEL | No | info | Pino log level (debug, info, warn, error) |
| GROQ_API_KEY | No | — | Groq API key for LLM answers |
| GROQ_MODEL | No | llama-3.3-70b-versatile | Groq model |
| ALLOWED_ORIGINS | No | — | Comma-separated CORS origins |
| COOKIE_SECURE | No | false | Set true when behind HTTPS |
| TRUST_PROXY | No | false | Set true behind reverse proxy |
| TEST_USER_PASSWORD | No | JiniTest123! | Test account password override |
| HR_TEST_PASSWORD | No | JiniHR123! | HR test account password override |
| GUEST_TEST_PASSWORD | No | JiniGuest123! | Guest test account password override |

> **Never commit .env to git.** The `.gitignore` already excludes it.

---

## Docker (Recommended)

The project includes a multi-stage Dockerfile at the project root.

### Build

```bash
docker build -t jini .
```

### Run

```bash
docker run -d \
  --name jini \
  -p 8788:8788 \
  -v jini-data:/app/data \
  -e GROQ_API_KEY=gsk_your_key_here \
  -e COOKIE_SECURE=true \
  jini
```

The Dockerfile:
- **Stage 1 (builder):** Install deps, type-check, build frontend
- **Stage 2 (runner):** Minimal `node:22-alpine` image, non-root `jini` user, healthcheck configured

The `data/` directory is mounted as a volume so SQLite and uploads persist across restarts.

### Docker Compose

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

---

## EC2 Deployment

### 1. Launch EC2 Instance

- Amazon Linux 2023 or Ubuntu 24.04
- Open port 8788 (or your custom PORT) in the security group
- Assign an Elastic IP or use the public DNS

### 2. Install Node.js 22+

```bash
# Amazon Linux 2023
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
```

### 3. Deploy

```bash
git clone https://github.com/0xMudit/Jini.git
cd Jini
npm install --omit=dev
cp .env.example .env
nano .env
npm run build
npm start
```

### 4. Persistent Process (PM2)

```bash
npm install -g pm2
pm2 start npm --name jini -- start
pm2 save
pm2 startup
```

### 5. Behind Nginx with HTTPS

```nginx
server {
    listen 443 ssl;
    server_name jini.example.com;

    ssl_certificate /etc/letsencrypt/live/jini.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jini.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `.env` with:

```
COOKIE_SECURE=true
TRUST_PROXY=true
```

---

## CI/CD

Push to `main` triggers GitHub Actions (see `.github/workflows/ci.yml`):

1. **Lint** — ESLint
2. **Test** — Vitest (30 tests)
3. **Build** — TypeScript + Vite
4. **Docker** — Build and push to `ghcr.io/0xMudit/Jini:latest`

To pull the pre-built image:

```bash
docker pull ghcr.io/0xMudit/Jini:latest
```

---

## File Uploads

Uploads are stored in `data/uploads/`. The SQLite database is at `data/jini.sqlite`. Both are excluded from git.

**Backup strategy:** Periodically back up the entire `data/` directory while the server is stopped (or use WAL mode snapshots).

---

## Monitoring

Jini logs structured JSON to stdout via Pino.

```bash
# Docker
docker logs -f jini

# PM2
pm2 logs jini

# Direct
journalctl -u jini
```

Set `LOG_LEVEL=debug` for verbose output.

---

## Security Checklist for Production

- [ ] Set `COOKIE_SECURE=true` when behind HTTPS
- [ ] Set `TRUST_PROXY=true` when behind Nginx/reverse proxy
- [ ] Set `ALLOWED_ORIGINS` only if API and frontend are on different origins
- [ ] Change default test account passwords via env overrides
- [ ] Restrict EC2 security group to your IP or use a VPN
- [ ] Keep Node.js and npm updated
- [ ] Use a non-root user (Docker already does this)
- [ ] Enable OS-level firewall (iptables/ufw)
- [ ] Rotate your Groq API key if exposed
