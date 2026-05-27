# Environment Variables Reference

This document lists all environment variables required and optionally used by SEBA AI Studio.

## Required Variables

These must be configured for the application to function.

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_APP_ID` | Manus OAuth application ID | `abc123` |
| `VITE_APP_TITLE` | Application display title | `SEBA \| Aina` |
| `VITE_APP_LOGO` | Path to application logo | `/logo.png` |
| `JWT_SECRET` | Session cookie signing secret (min 32 chars) | `a-long-random-string-at-least-32-characters` |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend) | `https://id.manus.im` |
| `OWNER_OPEN_ID` | Owner's Manus Open ID | `user_xxxx` |
| `OWNER_NAME` | Owner's display name | `Your Name` |
| `DATABASE_URL` | MySQL/TiDB connection string | `mysql://user:pass@host:port/db` |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL (LLM, storage) | `https://forge.manus.ai` |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for Forge API (server-side) | `sk-xxxx` |
| `VITE_FRONTEND_FORGE_API_URL` | Forge API URL for frontend | `https://forge.manus.ai` |
| `VITE_FRONTEND_FORGE_API_KEY` | Bearer token for frontend Forge access | `sk-xxxx` |

## Optional Variables

These enable additional features when configured.

### External APIs

| Variable | Description | Example |
|----------|-------------|---------|
| `HF_API_KEY` | HuggingFace API key (BSC AINA TTS) | `hf_xxxxxxxxxxxx` |
| `SEBASNAP_API_KEY` | SebaSnap knowledge bank API key | `sk-xxxx` |

### SMTP Email (Teacher Invitations)

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port (587 for TLS, 465 for SSL) | `587` |
| `SMTP_USER` | SMTP username | `noreply@school.edu` |
| `SMTP_PASS` | SMTP password | `app-password` |
| `SMTP_FROM` | From address for outgoing emails | `SEBA AI <noreply@school.edu>` |
| `SMTP_SECURE` | Use SSL (set `true` for port 465) | `false` |

### Self-hosted Salamandra LLM

| Variable | Description | Example |
|----------|-------------|---------|
| `LOCAL_LLM_URL` | URL to self-hosted Salamandra instance | `http://localhost:8080/v1` |
| `LOCAL_LLM_MODEL` | Model name for local LLM | `BSC-LT/salamandra-7b-instruct` |
| `LOCAL_LLM_API_KEY` | API key for local LLM (if required) | `local-key` |

### Self-hosted ASR (Speech-to-Text)

| Variable | Description | Example |
|----------|-------------|---------|
| `LOCAL_ASR_URL` | URL to self-hosted Faster-Whisper instance | `http://localhost:9000` |

### Self-hosted TTS (Text-to-Speech)

| Variable | Description | Example |
|----------|-------------|---------|
| `LOCAL_TTS_URL` | URL to self-hosted Matxa TTS (BSC AINA) | `http://localhost:8001` |
| `LOCAL_TTS_DIALECT` | Default Catalan dialect for TTS | `ca-nw` |

Supported dialect values: `ca-nw` (nord-occidental), `ca-central`, `ca-balearic`, `ca-valencian`

### Analytics

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint URL | `https://analytics.example.com` |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID | `site_xxxx` |

## Notes

- All `VITE_*` prefixed variables are exposed to the frontend client bundle.
- Server-only variables (without `VITE_` prefix) are never sent to the browser.
- The application uses Manus OAuth for authentication — no separate user/password database is needed.
- SMTP configuration is optional; if not set, teacher invitation emails are skipped (invites can still be shared via link).
- Self-hosted LLM/ASR/TTS endpoints are optional; when not configured, the app uses Manus Forge APIs and BSC HuggingFace Spaces.
