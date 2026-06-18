# Deployment Guide

## Prerequisites

- Node.js 22 or newer (uses built-in 
ode:sqlite)
- npm 10+

---

## Production Build

`ash
npm install
npm run build
npm start
`

This builds the frontend to dist/ and starts the Express server on the configured port.

---

## Environment Variables

Copy .env.example to .env and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 8788 | API server port |
| GROQ_API_KEY | No | — | Groq API key for LLM answers |
| GROQ_MODEL | No | llama-3.3-70b-versatile | Groq model |
| ALLOWED_ORIGINS | No | — | Comma-separated CORS origins |
| COOKIE_SECURE | No | alse | Set 	rue when behind HTTPS |
| TRUST_PROXY | No | — | Set 	rue behind reverse proxy |
| TEST_USER_PASSWORD | No | JiniTest123! | Test account password override |
| HR_TEST_PASSWORD | No | JiniHR123! | HR test account password override |
| GUEST_TEST_PASSWORD | No | JiniGuest123! | Guest test account password override |

> **Never commit .env to git.** The .gitignore already excludes it.

---

## EC2 Deployment

### 1. Launch EC2 Instance

- Amazon Linux 2023 or Ubuntu 24.04
- Open port 8788 (or your custom PORT) in the security group
- Assign an Elastic IP or use the public DNS

### 2. Install Node.js 22+

`ash
# Amazon Linux 2023
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
`

### 3. Deploy

`ash
git clone <your-repo-url> jini
cd jini
npm install --omit=dev
cp .env.example .env
nano .env           # Set GROQ_API_KEY, PORT, COOKIE_SECURE=false
npm run build
npm start
`

### 4. Persistent Process (PM2)

`ash
npm install -g pm2
pm2 start npm --name jini -- start
pm2 save
pm2 startup       # Re-enable on reboot
`

### 5. Behind Nginx with HTTPS

`
ginx
server {
    listen 443 ssl;
    server_name jini.example.com;

    ssl_certificate /etc/letsencrypt/live/jini.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jini.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \System.Management.Automation.Internal.Host.InternalHost;
        proxy_set_header X-Forwarded-For \;
        proxy_set_header X-Forwarded-Proto \;
    }
}
`

Set .env with:
`
COOKIE_SECURE=true
TRUST_PROXY=true
`

---

## Docker Deployment

Create a Dockerfile at the project root:

`dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8788
ENV NODE_ENV=production
CMD ["npm", "start"]
`

Build and run:

`ash
docker build -t jini .
docker run -d -p 8788:8788 --env-file .env -v jini-data:/app/data jini
`

Mount a volume for data/ to persist the SQLite database across restarts.

---

## File Uploads

Uploads are stored in data/uploads/. The SQLite database is at data/jini.sqlite. Both are excluded from git.

**Backup strategy:** Periodically back up the entire data/ directory while the server is stopped (or use WAL mode snapshots).

---

## Monitoring

Jini logs to stdout and stderr. For production, capture logs:

`ash
# PM2
pm2 logs jini

# Systemd journal
journalctl -u jini

# Docker
docker logs -f jini
`

Add log rotation:

`ash
# PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
`

---

## Security Checklist for Production

- [ ] Set COOKIE_SECURE=true when behind HTTPS
- [ ] Set TRUST_PROXY=true when behind Nginx/reverse proxy
- [ ] Set ALLOWED_ORIGINS only if API and frontend are on different origins
- [ ] Change default test account passwords via env overrides
- [ ] Restrict EC2 security group to your IP or use a VPN
- [ ] Keep Node.js and npm updated
- [ ] Use a non-root user to run the application
- [ ] Enable OS-level firewall (iptables/ufw)
