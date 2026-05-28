# SEBA AI Studio — Architecture

This document describes the system architecture, component relationships, and data flow of SEBA AI Studio.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   React 19  │  │  TanStack   │  │  Tailwind 4 │  │  WebRTC  │ │
│  │   + Router  │  │   Query     │  │  + shadcn   │  │  Client  │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └──────────┘ │
│         │                 │                                         │
│         └────────┬────────┘                                         │
│                  │ tRPC Client (Superjson)                          │
└──────────────────┼─────────────────────────────────────────────────┘
                   │ HTTPS
┌──────────────────┼─────────────────────────────────────────────────┐
│                  │         SERVER (Node.js)                          │
│  ┌───────────────▼───────────────┐                                  │
│  │        Express 4 Server        │                                  │
│  │  ┌─────────┐  ┌────────────┐  │                                  │
│  │  │  OAuth  │  │   Rate     │  │                                  │
│  │  │ Handler │  │  Limiter   │  │                                  │
│  │  └─────────┘  └────────────┘  │                                  │
│  │  ┌─────────────────────────┐  │                                  │
│  │  │     tRPC v11 Router     │  │                                  │
│  │  │  ┌───────┐ ┌─────────┐ │  │                                  │
│  │  │  │Public │ │Protected│ │  │                                  │
│  │  │  │Procs  │ │ Procs   │ │  │                                  │
│  │  │  └───────┘ └─────────┘ │  │                                  │
│  │  └─────────────────────────┘  │                                  │
│  └───────────────────────────────┘                                  │
│         │           │           │                                    │
│  ┌──────┴───┐ ┌────┴────┐ ┌───┴─────┐                             │
│  │  Drizzle │ │   LLM   │ │   S3    │                             │
│  │   ORM    │ │  Client  │ │ Client  │                             │
│  └──────┬───┘ └────┬────┘ └───┬─────┘                             │
└─────────┼──────────┼──────────┼────────────────────────────────────┘
          │          │          │
    ┌─────▼─────┐ ┌──▼───────┐ ┌▼──────────┐
    │   MySQL   │ │  Manus   │ │    S3     │
    │  / TiDB   │ │  Forge   │ │  Storage  │
    │           │ │  (LLM)   │ │           │
    └───────────┘ └──────────┘ └───────────┘
```

---

## Component Layers

### Presentation Layer (Client)

The client is a React 19 Single Page Application built with Vite and Tailwind CSS 4. It communicates exclusively through tRPC hooks — no raw HTTP calls.

| Technology | Purpose |
|-----------|---------|
| React 19 | UI framework with concurrent features |
| Wouter | Lightweight client-side routing |
| TanStack Query | Server state management via tRPC |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui (Radix) | Accessible component primitives |
| Lucide React | Icon library |
| Chart.js | Data visualization |
| Web Speech API | Browser-native TTS fallback |
| WebRTC | Peer-to-peer video calls |

### Application Layer (Server)

A single Express 4 process handling all HTTP traffic. tRPC v11 provides end-to-end type safety from database to UI.

| Technology | Purpose |
|-----------|---------|
| Express 4 | HTTP server framework |
| tRPC 11 | Type-safe RPC layer |
| Superjson | Serialization (preserves Date, Map, Set) |
| Zod | Runtime input validation |
| Jose | JWT signing/verification |
| node-cron | Scheduled background tasks |
| PDFKit | Server-side PDF generation |
| Nodemailer | Email delivery |

### Data Layer

| Technology | Purpose |
|-----------|---------|
| Drizzle ORM | Type-safe database queries |
| MySQL / TiDB | Relational data storage |
| S3 | Binary file storage (images, audio, documents) |

### External Services

| Service | Integration | Purpose |
|---------|-------------|---------|
| Manus OAuth | Server-side callback | User authentication |
| Manus Forge API | REST (OpenAI-compatible) | LLM inference (Gemini 2.5 Flash) |
| BSC AINA Matxa | Gradio API | Catalan text-to-speech |
| Manus Heartbeat | HTTP webhook | Scheduled job execution |

---

## Data Model

### Core Entities

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Tenant  │────<│     User     │>────│  ClassGroup │
└──────────┘     └──────────────┘     └─────────────┘
                       │                      │
              ┌────────┼────────┐             │
              │        │        │             │
        ┌─────▼──┐ ┌───▼────┐ ┌▼────────┐   │
        │Practice│ │Material│ │Challenge │   │
        │Session │ │        │ │  Room    │   │
        └────────┘ └────────┘ └──────────┘   │
              │                               │
        ┌─────▼──────┐              ┌────────▼───┐
        │  Question  │              │   Student  │
        │   Answer   │              │  Progress  │
        └────────────┘              └────────────┘
```

### Role Hierarchy

```
Platform Admin (tenantId = NULL)
  └── Territorial Director (multi-school oversight)
        └── Director (school-level admin)
              └── Head of Study (academic coordination)
                    └── Teacher (classroom instruction)
                          └── User (student/parent)
```

### Multi-tenancy Model

All data is isolated by `tenantId`. Each query automatically filters by the authenticated user's tenant. Platform administrators (`tenantId = NULL`) bypass tenant filters for cross-organization visibility.

---

## Security Architecture

### Authentication Flow

```
Browser                    Server                    Manus OAuth
   │                         │                          │
   │──── GET /login ────────>│                          │
   │<─── Redirect ──────────│──── OAuth Authorize ────>│
   │                         │                          │
   │<──────────────── Redirect with code ──────────────│
   │──── GET /callback ─────>│                          │
   │                         │──── Exchange code ──────>│
   │                         │<─── User profile ───────│
   │                         │                          │
   │                         │── Create/update user ──>DB
   │                         │── Sign JWT session ─────>│
   │<─── Set-Cookie ────────│                          │
   │                         │                          │
```

### Security Layers

1. **Transport**: HTTPS-only with HSTS preload
2. **Authentication**: JWT sessions with sliding renewal (8h max)
3. **Authorization**: Role-based access control (RBAC) per procedure
4. **Input Validation**: Zod schemas on every tRPC input
5. **Rate Limiting**: Per-IP limits on AI, auth, and MFA endpoints
6. **Headers**: CSP (nonce-based), X-Frame-Options, CORP, COOP
7. **Data Isolation**: Tenant-scoped queries at the ORM level
8. **Audit Trail**: Security events logged with IP, user agent, severity
9. **MFA**: Optional TOTP-based two-factor authentication
10. **Session Invalidation**: Global sign-out via `sessionVersion` counter

---

## Background Processing

### Scheduled Jobs (via Manus Heartbeat)

| Job | Frequency | Endpoint |
|-----|-----------|----------|
| Translation Audit | Weekly | `POST /api/scheduled/translation-audit` |
| Data Retention Purge | Weekly | Internal cron |
| Audit Log Cleanup | Weekly | Internal cron |
| AI Bias Scan | Weekly | Internal cron |
| Attendance Alerts | Daily | Internal cron |

### Startup Tasks

On server boot, the following background tasks execute:
1. **Translation hydration** — Pre-translates knowledge bank questions into Catalan (batched, non-blocking)
2. **Health monitor** — Starts the 5-minute self-healing check loop

---

## AI Integration Architecture

```
┌──────────────────────────────────────────────────┐
│                  AI Pipeline                      │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  System  │───>│  Manus   │───>│ Response │  │
│  │  Prompt  │    │  Forge   │    │  Parser  │  │
│  │ Builder  │    │  (LLM)   │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘  │
│       │                                │        │
│  ┌────┴─────┐                   ┌──────┴─────┐ │
│  │ Adaptive │                   │  Bias      │ │
│  │ Profile  │                   │  Scanner   │ │
│  └──────────┘                   └────────────┘ │
└──────────────────────────────────────────────────┘
```

The AI system uses:
- **Adaptive profiles** — Personalized context based on teacher interaction history
- **LOMLOE alignment** — System prompts enforce curriculum competency mapping
- **Structured output** — JSON schema enforcement for materials generation
- **Bias scanning** — Weekly automated review of AI-generated content
- **Fallback chain** — Self-hosted Salamandra → Manus Forge → graceful error

---

## File Storage Architecture

```
Client ──upload──> Server ──storagePut──> S3
                     │
                     └── DB (metadata: url, key, mime, owner)
                     
Client <──signed URL──< Server <──storageGet──< S3
```

All user-uploaded files are stored in S3 with:
- Random suffixes to prevent URL enumeration
- Metadata tracked in the database (owner, MIME type, size)
- Public read access via signed CloudFront URLs

---

## Internationalization Architecture

The application supports three languages (CA, ES, EN) with:
- **4,000+ translation keys** managed in `I18nContext.tsx`
- **Catalan dialect variants** (Central, Balearic, Nord-Occidental, Valencian) with phonetic overrides
- **Automated translation audit** — Weekly scan detects missing keys and auto-translates safe contexts
- **Dynamic question translation** — Knowledge bank questions translated to Catalan via AI on startup

Language detection priority:
1. User preference (stored in localStorage)
2. Browser `Accept-Language` header
3. Default: Catalan (CA)

---

## Performance Characteristics

| Metric | Typical Value |
|--------|--------------|
| Cold start | ~2 seconds |
| tRPC query latency | 50-200ms |
| LLM response (chat) | 2-8 seconds |
| LLM response (materials) | 5-30 seconds |
| TTS synthesis (BSC) | 3-5 seconds |
| Static asset size (gzipped) | ~800 KB |
| Database tables | 50+ |
| API procedures | 200+ |
