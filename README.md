<p align="center">
  <img src="https://sebataeco.com/favicon.ico" alt="SEBA AI Studio" width="64" height="64" />
</p>

<h1 align="center">SEBA AI Studio</h1>

<p align="center">
  <strong>Sovereign Educational AI Platform for Catalonia</strong><br/>
  AI-powered teaching assistant aligned with Spain's LOMLOE curriculum
</p>

<p align="center">
  <a href="https://sebataeco.com">Live Demo</a> · 
  <a href="./docs/API.md">API Docs</a> · 
  <a href="./docs/ARCHITECTURE.md">Architecture</a> · 
  <a href="./docs/DEPLOYMENT.md">Deployment</a> · 
  <a href="./docs/CURRICULUM.md">Curriculum</a> · 
  <a href="./docs/SECURITY.md">Security & Privacy</a> · 
  <a href="./docs/ROADMAP.md">Roadmap</a> · 
  <a href="./docs/SEBA_AI_Studio.postman_collection.json">Postman Collection</a>
</p>

<p align="center">
  <a href="https://github.com/nomad-gl/sebataeco/actions/workflows/ci.yml"><img src="https://github.com/nomad-gl/sebataeco/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://coveralls.io/github/nomad-gl/sebataeco"><img src="https://coveralls.io/repos/github/nomad-gl/sebataeco/badge.svg" alt="Coverage" /></a>
  <img src="https://img.shields.io/badge/license-Source--Available-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-22%2B-green" alt="Node.js 22+" />
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React 19" />
  <img src="https://img.shields.io/badge/typescript-5.9-3178c6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/LOMLOE-8%20competencies-orange" alt="LOMLOE" />
  <img src="https://img.shields.io/badge/languages-CA%20%7C%20ES%20%7C%20EN-red" alt="Languages" />
  <img src="https://img.shields.io/badge/GDPR-compliant-brightgreen" alt="GDPR" />
</p>

---

## Overview

SEBA AI Studio (branded as *Aina*) is a comprehensive educational platform that helps teachers plan lessons, generate materials, run live classroom activities, and track student progress — all contextualised around the eight key competencies defined by Spain's LOMLOE education law. The platform supports Catalan, Spanish, and English with dialect-aware text-to-speech powered by the Barcelona Supercomputing Center.

---

## Screenshots

| Homepage | AI Chat (Aina) |
|----------|---------------|
| ![Homepage](/manus-storage/screenshot-homepage_612b1f81.webp) | ![AI Chat](/manus-storage/chat-interface_f1779d19.webp) |

| LOMLOE Competencies | Login |
|--------------------|-------|
| ![Competencies](/manus-storage/screenshot-competencies_d6379d63.webp) | ![Login](/manus-storage/screenshot-practice_ac8a90dd.webp) |

---

## Key Features

| Category | Features |
|----------|----------|
| **AI Assistant** | LOMLOE-aligned chat, file analysis, voice input/output, adaptive context, multilingual responses |
| **Materials** | Quizzes, crosswords, flashcards, word searches, fill-in-the-blank, matching, slide decks — all exportable as PDF/DOCX/PNG |
| **Live Challenges** | Real-time classroom quizzes with room codes, QR join, leaderboards, countdown timers |
| **Progress** | Per-student competency tracking, AI-generated reports, parent summaries, group heatmaps |
| **Voice** | BSC AINA Matxa TTS (Catalan), Whisper transcription, dialect-aware pronunciation |
| **Management** | Multi-tenant, role hierarchy (Director → HoS → Teacher → Student), MFA, audit trail |
| **Compliance** | GDPR data export/deletion, DPA generation, DPIA, 90-day retention, bias scanning |
| **Collaboration** | Teacher forum, WebRTC video calls, meeting scheduling, staff directory |
| **i18n** | 9,000+ translated strings, 4 Catalan dialects, geographic auto-detection |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7, Radix UI, shadcn/ui |
| Backend | Express 4, tRPC 11, Node.js 22, Zod, Superjson |
| Database | MySQL / TiDB, Drizzle ORM |
| Auth | OAuth 2.0, JWT sessions, TOTP MFA, bcrypt |
| AI/LLM | OpenAI-compatible API (Gemini 2.5 Flash via Manus Forge) |
| Speech | BSC AINA Matxa TTS, Whisper API |
| Storage | AWS S3 (file uploads, generated assets) |
| Testing | Vitest |

---

## Quick Start

```bash
# Clone
git clone https://github.com/nomad-gl/sebataeco.git
cd sebataeco

# Install
pnpm install

# Configure (see ENV_REFERENCE.md for all variables)
cp .env.example .env

# Database
pnpm drizzle-kit generate
# Apply generated SQL to your MySQL/TiDB instance

# Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
sebataeco/
├── client/                  # React 19 SPA
│   └── src/
│       ├── pages/           # Route-level components
│       ├── components/      # Reusable UI (shadcn/ui + custom)
│       ├── contexts/        # i18n, auth, theme providers
│       └── App.tsx          # Route definitions
├── server/                  # Express + tRPC backend
│   ├── _core/              # OAuth, LLM, TTS, session plumbing
│   ├── routers/            # Feature routers (40+ modules)
│   ├── knowledge/          # LOMLOE question bank
│   ├── db.ts              # Database helpers
│   └── routers.ts         # Root router composition
├── drizzle/                # Schema & migrations (50+ tables)
├── shared/                 # Cross-boundary types & constants
├── docs/                   # Documentation suite
│   ├── API.md             # Full API reference
│   ├── ARCHITECTURE.md    # System architecture
│   ├── DEPLOYMENT.md      # Deployment guide
│   ├── CURRICULUM.md      # LOMLOE mapping
│   ├── SECURITY.md        # Security & privacy policy
│   └── ROADMAP.md         # Product roadmap
├── ENV_REFERENCE.md        # Environment variable reference
└── LICENSE                 # Source-Available License
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete tRPC procedure catalog with input/output schemas, rate limits, and error codes |
| [Architecture](./docs/ARCHITECTURE.md) | System diagrams, component layers, data model, security architecture, AI pipeline |
| [Deployment Guide](./docs/DEPLOYMENT.md) | Production setup, Docker, Cloud Run, scaling, monitoring, troubleshooting |
| [Curriculum Mapping](./docs/CURRICULUM.md) | LOMLOE competency integration, year groups, assessment alignment, Catalan specifics |
| [Security & Privacy](./docs/SECURITY.md) | GDPR compliance, data classification, security controls, retention policy, DPIA |
| [Product Roadmap](./docs/ROADMAP.md) | Release history, upcoming features, technical debt, prioritization framework |
| [Environment Variables](./ENV_REFERENCE.md) | Complete reference for all 25+ configuration variables |
| [Postman Collection](./docs/SEBA_AI_Studio.postman_collection.json) | Import into Postman to test all API endpoints interactively |

---

## LOMLOE Competencies

All educational content is mapped to the 8 key competencies:

| Code | Competency | Domain |
|------|-----------|--------|
| CCL | Comunicació Lingüística | Language & Communication |
| CP | Plurilingüe | Multilingual Awareness |
| STEM | Matemàtica, Ciència, Tecnologia i Enginyeria | Science & Mathematics |
| CD | Digital | Digital Literacy |
| CPSAA | Personal, Social i d'Aprendre a Aprendre | Self-regulation & Social |
| CC | Ciutadana | Civic Participation |
| CE | Emprenedora | Initiative & Entrepreneurship |
| CCEC | Consciència i Expressió Culturals | Cultural Expression |

---

## Database Schema

50+ tables covering users, tenants, educational content, progress tracking, collaboration, and compliance. Core entities:

```
Tenant → School → User (with role hierarchy)
                    ├── Practice Sessions → Question Answers
                    ├── Teaching Materials (AI-generated)
                    ├── Class Groups → Students → Progress
                    ├── Challenges → Participants → Scores
                    ├── Assignments → Completions
                    └── Audit Logs → Security Events
```

See [Architecture](./docs/ARCHITECTURE.md) for the full data model.

---

## Testing

```bash
pnpm test                    # Run all tests
pnpm test -- --run *.test.ts # Run specific suite
pnpm test:i18n               # Validate i18n parity (CA/ES/EN)
```

---

## Deployment

The recommended deployment is via Manus Cloud (managed hosting with custom domains). For self-hosting options including Docker and Cloud Run, see the [Deployment Guide](./docs/DEPLOYMENT.md).

---

## Security & Compliance

- GDPR-compliant with built-in data export, deletion, and retention tools
- HSTS, CSP (nonce-based), rate limiting, session sliding renewal
- Multi-factor authentication (TOTP)
- Tenant-isolated data with role-based access control
- Weekly automated AI bias scanning
- Full audit trail with security event logging

See [Security & Privacy Policy](./docs/SECURITY.md) for complete details.

---

## License

This project is released under a **Source-Available License** — you may view the code and use it free of charge for a 90-day evaluation period. Commercial use beyond the evaluation period requires a separate license agreement.

See [`LICENSE`](./LICENSE) for full terms. For licensing enquiries: [hello@sebasnap.com](mailto:hello@sebasnap.com)

---

<p align="center">
  <strong>SEBA</strong> — Sovereign Educational AI Platform for Catalonia<br/>
  <sub>Built with care for Catalan schools, teachers, and students.</sub>
</p>
