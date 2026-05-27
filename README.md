# SEBA AI Studio

**AI-powered teaching assistant for Catalan schools, fully aligned with Spain's LOMLOE curriculum.**

SEBA AI Studio (branded as *Aina*) is a comprehensive educational platform that helps teachers plan lessons, generate materials, run live classroom activities, and track student progress — all contextualised around the eight key competencies defined by Spain's LOMLOE education law. The platform supports Catalan, Spanish, and English with dialect-aware text-to-speech.

🌐 **Live Demo:** [sebataeco.com](https://sebataeco.com)

---

## Screenshots

### Homepage

![SEBA AI Studio — Homepage](/manus-storage/screenshot-homepage_612b1f81.webp)

### 8 LOMLOE Competencies Grid

![8 LOMLOE Competencies](/manus-storage/screenshot-competencies_d6379d63.webp)

### AI Chat Interface (Aina)

![AI Chat — LOMLOE Teaching Assistant](/manus-storage/chat-interface_f1779d19.webp)

### Login Page

![Login — Sovereign AI for Catalan Education](/manus-storage/screenshot-practice_ac8a90dd.webp)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

---

## Features

### AI Chat Assistant

A conversational AI tutor grounded in the LOMLOE knowledge bank. Teachers and students can ask curriculum-related questions, receive competency-aligned explanations, and get pedagogical guidance. The assistant adapts its language and complexity based on the selected year group (Infantil, Primary, Secondary) and responds in Catalan, Spanish, or English.

### Teaching Materials Generator

AI-powered creation of classroom-ready resources from a single topic prompt. Supported material types include quizzes (10-question MCQ with explanations), slide decks (8–10 slides with speaker notes), crosswords, fill-in-the-blank worksheets, word searches, and flashcard sets. All materials can be exported as PDF, Word (.docx), or PNG, and printed with or without answer keys.

### Practice Mode

Students complete 10-question multiple-choice sessions filtered by competency and year group. Each question includes immediate feedback with explanations. Sessions are saved to the database for progress tracking. Teachers can also create custom question sets.

### Live Class Challenge

A real-time quiz game where teachers host sessions and students join from their devices using a room code or QR scan. Features include a live leaderboard, countdown timers, teacher-controlled question pacing, and automatic score logging to student progress records.

### Student & Group Progress Tracking

Per-student competency scores, assignment completion tracking, score history timelines, and AI-generated progress reports. Group-level views include competency heatmaps, ranked leaderboards, and exportable PDF reports with LOMLOE grades.

### Class Groups Management

Teachers manage class rosters with numbered student lists, send group messages, assign daily/weekly tasks with due-date reminders, and view challenge history per group with competency coverage badges.

### Presentation Builder

AI-generated slide decks with cover slides, content slides, competency tags, and image suggestions. Slides are editable in-place and can be exported. Teachers can derive quizzes or worksheets directly from generated presentations.

### Multi-Tenant School Management

Role-based access control with distinct interfaces for Teachers, Heads of Study, Directors, and Territorial Directors. Directors manage teacher accounts, view school-wide analytics, generate compliance reports, and configure school settings. Multi-factor authentication (TOTP) is supported.

### Multilingual & Dialect-Aware

Full trilingual interface (Catalan, Spanish, English) with over 9,000 translated strings. Catalan dialect detection maps the school's geographic location (comarca) to the appropriate dialect variant (Central, Balearic, North-Western, Valencian).

### Voice Input & Text-to-Speech

Speech-to-text via Whisper API for voice-based chat input. Text-to-speech using BSC AINA Matxa voices for Catalan (with male/female options) and browser Web Speech API for English.

### Progressive Web App

Installable on mobile and desktop with offline-capable service worker, app manifest, and responsive design optimised for classroom use on tablets and phones.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7 |
| UI Components | Radix UI, shadcn/ui, Lucide Icons, Framer Motion |
| Routing | Wouter |
| State & Data | TanStack React Query, tRPC 11, Superjson |
| Backend | Express 4, tRPC 11, Node.js |
| Database | MySQL (TiDB compatible), Drizzle ORM |
| Authentication | OAuth 2.0, JWT sessions, TOTP MFA |
| AI/LLM | OpenAI-compatible API (via Manus Forge) |
| Speech | BSC AINA Matxa TTS (Catalan), Whisper API (transcription) |
| Storage | AWS S3 (file uploads, generated assets) |
| Charts | Recharts |
| Document Export | jsPDF, html2canvas, docx, PDFKit, xlsx |
| Testing | Vitest |
| Package Manager | pnpm 9 |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (React)                     │
│  Pages → tRPC hooks → TanStack Query → UI render    │
└────────────────────────┬────────────────────────────┘
                         │ /api/trpc (HTTP)
┌────────────────────────▼────────────────────────────┐
│                  Server (Express)                     │
│  tRPC Router → Procedures → DB helpers / LLM / S3   │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
  ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
  │  MySQL  │   │ LLM API │   │   S3    │
  │ (TiDB)  │   │ (Forge) │   │ Storage │
  └─────────┘   └─────────┘   └─────────┘
```

The application follows a monorepo structure with a shared TypeScript codebase. The client communicates exclusively through tRPC procedures — there are no REST endpoints to maintain. Authentication is handled via OAuth with JWT session cookies, and all protected routes use `protectedProcedure` middleware that injects the authenticated user into the request context.

---

## Getting Started

### Prerequisites

- **Node.js** 22+
- **pnpm** 9+
- **MySQL** 8.0+ (or TiDB)

### Installation

```bash
# Clone the repository
git clone https://github.com/nomad-gl/sebataeco.git
cd sebataeco

# Install dependencies
pnpm install

# Set up environment variables (see Environment Variables section)
cp .env.example .env

# Generate and apply database migrations
pnpm drizzle-kit generate
# Apply the generated SQL to your database

# Start the development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production (client + server) |
| `pnpm start` | Run production build |
| `pnpm check` | TypeScript type checking |
| `pnpm test` | Run all Vitest tests |
| `pnpm test:i18n` | Run i18n parity and placeholder tests |
| `pnpm db:push` | Generate and apply database migrations |
| `pnpm audit:translations` | Audit translation coverage |
| `pnpm format` | Format code with Prettier |

---

## Project Structure

```
sebataeco/
├── client/                  # Frontend application
│   ├── src/
│   │   ├── pages/           # Page-level components
│   │   ├── components/      # Reusable UI (shadcn/ui + custom)
│   │   ├── contexts/        # React contexts (i18n, auth, theme)
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # tRPC client binding
│   │   ├── App.tsx          # Route definitions & layout
│   │   └── index.css        # Global design tokens
│   └── index.html           # HTML entry point
├── server/                  # Backend application
│   ├── _core/               # Framework plumbing (OAuth, LLM, TTS)
│   ├── routers/             # tRPC procedure routers by feature
│   ├── knowledge/           # LOMLOE knowledge bank (96 questions)
│   ├── db.ts                # Database query helpers
│   ├── routers.ts           # Root tRPC router
│   └── storage.ts           # S3 file storage helpers
├── drizzle/                 # Database schema & migrations
├── shared/                  # Shared types & constants
└── package.json
```

---

## Environment Variables

The following environment variables are required for the application to function:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Secret for signing session cookies |
| `VITE_APP_ID` | OAuth application ID |
| `OAUTH_SERVER_URL` | OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | OAuth login portal URL (frontend) |
| `BUILT_IN_FORGE_API_URL` | LLM/AI services API endpoint |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for AI services (server-side) |
| `HF_API_KEY` | HuggingFace API key (for BSC TTS) |

For a complete reference of all environment variables (including SMTP, self-hosted LLM/TTS/ASR, and analytics), see [`ENV_REFERENCE.md`](./ENV_REFERENCE.md).

---

## Database

The application uses Drizzle ORM with MySQL. The schema is defined in `drizzle/schema.ts` and includes the following core tables:

- **users** — Authentication, roles, tenant isolation, MFA, preferences
- **practice_sessions** — Completed quiz session scores
- **teaching_materials** — AI-generated classroom resources
- **class_challenges** — Live quiz game sessions
- **challenge_participants** — Student scores per challenge
- **class_groups** — Teacher-managed class rosters
- **group_students** — Numbered student entries per group
- **student_progress** — Per-student competency scores over time
- **assignments** — Teacher-created tasks with due dates
- **assignment_completions** — Per-student completion records

### Roles

| Role | Access Level |
|------|-------------|
| `teacher` | Create materials, run challenges, manage own groups |
| `head_of_study` | View all groups and progress within their school |
| `director` | Full school management, teacher accounts, analytics |
| `territorial_director` | Multi-school oversight |
| `admin` | Platform-wide super-admin access |

---

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test -- --run server/dialectMapping.test.ts
pnpm test -- --run server/voiceRouting.test.ts

# Run i18n parity tests (checks all 3 languages have matching keys)
pnpm test:i18n
```

---

## Deployment

The application is deployed on Manus Cloud (Cloud Run) with automatic TLS and custom domain support. For self-hosting:

1. Build the application: `pnpm build`
2. The production server runs from `dist/index.js`
3. Ensure all environment variables are configured
4. The server binds to the port specified by the `PORT` environment variable

---

## LOMLOE Competencies

The platform covers all eight key competencies defined by Spain's LOMLOE education law:

| Code | Competency |
|------|-----------|
| CCL | Competència en Comunicació Lingüística |
| CP | Competència Plurilingüe |
| STEM | Competència Matemàtica i en Ciència, Tecnologia i Enginyeria |
| CD | Competència Digital |
| CPSAA | Competència Personal, Social i d'Aprendre a Aprendre |
| CC | Competència Ciutadana |
| CE | Competència Emprenedora |
| CCEC | Competència en Consciència i Expressió Culturals |

---

## License

MIT

---

*Powered by SEBA*
