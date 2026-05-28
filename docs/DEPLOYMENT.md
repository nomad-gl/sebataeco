# SEBA AI Studio — Deployment Guide

This guide covers deploying SEBA AI Studio to production environments. The application is a single Node.js process serving both the API and the client-side SPA.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 20.x | 22.x LTS |
| RAM | 512 MB | 1 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 500 MB | 1 GB |
| Database | MySQL 8.0 / TiDB | TiDB Serverless |
| Object Storage | S3-compatible | AWS S3 / Cloudflare R2 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              SEBA AI Studio (Node.js)            │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Express  │  │   tRPC   │  │  Vite (dev)  │  │
│  │  Server   │──│  Router  │  │  / Static    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│        │              │                          │
│  ┌─────┴──────┐ ┌────┴─────┐                   │
│  │   OAuth    │ │   LLM    │                    │
│  │  Handler   │ │  Client  │                    │
│  └────────────┘ └──────────┘                    │
└─────────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │  MySQL  │   │  Forge  │   │   S3    │
    │  / TiDB │   │   LLM   │   │ Storage │
    └─────────┘   └─────────┘   └─────────┘
```

---

## Build & Run

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy the environment reference and fill in required values:

```bash
cp ENV_REFERENCE.md .env
# Edit .env with your actual values
```

See [ENV_REFERENCE.md](../ENV_REFERENCE.md) for the complete list of environment variables.

### 3. Database Setup

Run the Drizzle migrations to create the database schema:

```bash
pnpm drizzle-kit generate
pnpm db:push
```

Or apply migrations manually via SQL. The schema is defined in `drizzle/schema.ts`.

### 4. Build for Production

```bash
pnpm build
```

This produces:
- `dist/client/` — Static SPA assets (HTML, JS, CSS)
- `dist/server.js` — Bundled server (esbuild output)

### 5. Start Production Server

```bash
NODE_ENV=production node dist/server.js
```

The server binds to `PORT` (default: 3000) and serves both the API and static client files.

---

## Deployment Options

### Option A: Manus WebDev (Recommended)

The application is pre-configured for Manus WebDev hosting with:
- Automatic SSL/TLS termination
- Custom domain support (`.manus.space` or your own domain)
- Built-in S3 storage and database
- Zero-downtime deployments

Simply click **Publish** in the Manus Management UI.

### Option B: Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Build and run:

```bash
docker build -t seba-ai-studio .
docker run -p 3000:3000 --env-file .env seba-ai-studio
```

### Option C: Cloud Run / Railway / Render

The application is compatible with any Node.js PaaS that supports:
- Single-process HTTP servers
- Environment variable injection
- Outbound HTTPS (for LLM API, OAuth, S3)

Set the `PORT` environment variable to match the platform's expected port.

---

## Database Configuration

### TiDB Serverless (Recommended)

TiDB Serverless provides MySQL-compatible, auto-scaling database with:
- Automatic failover and backups
- Branching for development/staging
- Free tier for evaluation

Connection string format:
```
mysql://<user>:<password>@<host>:4000/<database>?ssl={"rejectUnauthorized":true}
```

### Self-hosted MySQL

Ensure MySQL 8.0+ with:
- `utf8mb4` character set
- `utf8mb4_unicode_ci` collation
- SSL enabled for production connections

---

## External Service Dependencies

| Service | Required | Purpose |
|---------|----------|---------|
| Manus OAuth | Yes | User authentication |
| Manus Forge API | Yes | LLM inference (Gemini 2.5 Flash) |
| S3 Storage | Yes | File/media storage |
| BSC AINA TTS | Optional | Catalan text-to-speech |
| SMTP Server | Optional | Email notifications |
| Self-hosted Salamandra | Optional | On-premise LLM (data sovereignty) |
| Self-hosted ASR | Optional | On-premise speech-to-text |

---

## Security Hardening

The production server automatically applies:

- **HSTS** with 1-year max-age, includeSubDomains, preload
- **CSP** with nonce-based script-src (no unsafe-inline in production)
- **X-Frame-Options: SAMEORIGIN** (clickjacking prevention)
- **X-Content-Type-Options: nosniff** (MIME sniffing prevention)
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** disabling geolocation, payment, USB, FLoC
- **Cross-Origin-Opener-Policy: same-origin**
- **Cross-Origin-Resource-Policy: same-site**
- **Rate limiting** on AI, auth, and MFA endpoints
- **Session sliding renewal** with 8-hour maximum lifetime

---

## Health Monitoring

The application includes a built-in self-healing health monitor that runs every 5 minutes, checking:
- Database connectivity
- LLM API availability
- S3 storage access
- Memory usage thresholds

Health endpoint: `GET /api/ping` returns `{ "status": "ok", "ts": <unix_ms> }`.

---

## Scaling Considerations

The application is designed as a single-process server. For horizontal scaling:

1. **Stateless sessions** — JWT-based cookies require no shared session store
2. **Database connection pooling** — Drizzle ORM manages connection pools internally
3. **S3 for storage** — No local filesystem dependencies for user data
4. **Background jobs** — Scheduled via Manus Heartbeat (external cron); no in-process workers needed in production

For high-traffic deployments (>1000 concurrent users), consider:
- Load balancer with sticky sessions disabled (stateless JWT)
- Read replicas for database queries
- CDN for static assets (`dist/client/`)
- Separate worker process for background jobs

---

## Backup & Recovery

| Component | Backup Strategy |
|-----------|----------------|
| Database | Automated daily snapshots (TiDB) or `mysqldump` |
| S3 Storage | Cross-region replication or versioning |
| Environment | Store secrets in a vault (HashiCorp, AWS SSM) |
| Code | Git repository with tagged releases |

---

## Monitoring & Observability

Recommended monitoring stack:

- **Uptime**: Ping `/api/ping` every 60 seconds
- **Errors**: Capture `console.error` output via log aggregation
- **Performance**: Track tRPC procedure latency via middleware
- **Analytics**: Built-in Umami-compatible analytics (configure `VITE_ANALYTICS_ENDPOINT`)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on database | Check `DATABASE_URL` and SSL settings |
| OAuth callback fails | Verify `OAUTH_SERVER_URL` and `VITE_APP_ID` |
| LLM returns 404 | Confirm `BUILT_IN_FORGE_API_URL` and API key |
| TTS not working | BSC AINA may be temporarily unavailable; falls back to browser speech |
| High memory usage | Reduce `server.timeout` or add memory limits |
| Port conflict | Set `PORT` env var to an available port |
