# SEBA AI Studio — API Reference

This document describes the tRPC-based API surface exposed by SEBA AI Studio. All procedures are served under `/api/trpc` and follow the tRPC v11 wire protocol (JSON over HTTP with Superjson serialization).

---

## Authentication

All requests are authenticated via a session cookie (`seba_session`) issued during OAuth or local login. Procedures marked **protected** require a valid session; **public** procedures may be called without authentication.

Session cookies use `HttpOnly`, `Secure`, `SameSite=Lax` attributes and are automatically renewed (sliding window) on every authenticated API call if the session has less than 4 hours remaining.

---

## Router Overview

| Router | Namespace | Description |
|--------|-----------|-------------|
| Auth | `auth.*` | Session management, SSO, password, dialect preferences |
| Aina (AI Chat) | `aina.*` | AI teaching assistant conversations, file uploads, streaming |
| LOMLOE | `lomloe.*` | Competency questions, knowledge bank, adaptive profiles |
| Materials | `materials.*` | AI-generated teaching resources (quizzes, crosswords, slides, etc.) |
| Challenge | `challenge.*` | Real-time classroom quiz challenges with room codes |
| Progress | `progress.*` | Student progress tracking, assignments, AI reports |
| Groups | `groups.*` | Class group management and student rosters |
| Voice | `voice.*` | Text-to-speech synthesis (BSC AINA + fallback) |
| Forum | `forum.*` | Teacher discussion forum with channels and reactions |
| Planner | `planner.*` | Weekly lesson planner with AI suggestions |
| Presentations | `presentations.*` | AI-generated slide presentations |
| Analytics | `analytics.*` | Usage analytics and engagement metrics |
| Notifications | `notifications.*` | In-app notification delivery and management |
| Privacy | `privacy.*` | GDPR data export, deletion, retention purge |
| Audit | `audit.*` | Security event logging and audit trail |
| DPA | `dpa.*` | Data Processing Agreement management |
| DPIA | `dpia.*` | Data Protection Impact Assessment |
| Security Dashboard | `securityDashboard.*` | Admin security monitoring and KPIs |
| MFA | `mfa.*` | Multi-factor authentication (TOTP) |
| Tenants | `tenants.*` | Multi-tenant organization management |
| Director | `director.*` | School director administration tools |
| HoS | `hos.*` | Head of Study management procedures |
| Territorial Director | `territorialDirector.*` | Multi-school oversight (ZER) |
| Schools | `schools.*` | School entity CRUD within a tenant |
| Teacher Profile | `teacherProfile.*` | Teacher profile and preferences |
| Teacher Attendance | `teacherAttendance.*` | Teacher attendance tracking and alerts |
| Teacher Cover Lessons | `teacherCoverLessons.*` | Substitute teacher assignment |
| Teacher Directory | `teacherDirectory.*` | Staff directory and contact info |
| Attendance | `attendance.*` | Student attendance records |
| Register | `register.*` | Student register management |
| Cover | `cover.*` | Cover lesson scheduling |
| Teams | `teams.*` | Team/department grouping |
| DM Call | `dmCall.*` | Direct messaging and voice calls |
| WebRTC | `webrtc.*` | WebRTC signaling for video calls |
| Meeting Invitation | `meetingInvitation.*` | Meeting scheduling and invitations |
| Call Chat | `callChat.*` | In-call text chat |
| Call Background | `callBackground.*` | Virtual background preferences |
| ILP | `ilp.*` | Individual Learning Plans |
| Lesson Plan | `lessonPlan.*` | AI-generated lesson plans |
| Infantil | `infantil.*` | Early childhood education tools |
| Academic Calendar | `academicCalendar.*` | School calendar and events |
| Custom Sets | `customSets.*` | Custom question sets by teachers |
| Auto-Correct | `autoCorrect.*` | AI-powered writing correction |
| Bulk Teacher Import | `bulkTeacherImport.*` | CSV/batch teacher onboarding |
| Catalan Transcription | `catalanTranscription.*` | Speech-to-text for Catalan |
| Director Alerts | `directorAlerts.*` | Priority alerts for directors |
| Subject Assignment | `subjectAssignment.*` | Teacher-subject mapping |
| Auto-Match Teachers | `autoMatchTeachers.*` | AI-assisted teacher-class matching |
| Nav Order | `navOrder.*` | Customizable navigation ordering |
| Wake Words | `wakeWords.*` | Voice activation keywords |
| Audio Responses | `audioResponses.*` | Audio-based student responses |
| GeoDialect | `geoDialect.*` | Geographic dialect detection |
| Accountability | `accountability.*` | Teacher accountability tracking |
| What's New | `whatsNew.*` | Release notes and changelog |
| Self-Heal | `selfHeal.*` | Automated system health monitoring |
| Updates | `updates.*` | Application update management |
| Local Auth | `localAuth.*` | Email/password authentication |

---

## Core Procedures

### Auth

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `auth.me` | Query | Public | Returns the current authenticated user or `null` |
| `auth.logout` | Mutation | Public | Clears the session cookie |
| `auth.setTtsVoice` | Mutation | Protected | Set preferred TTS voice (`nova`, `shimmer`, `alloy`, `fable`) |
| `auth.setTtsDialect` | Mutation | Protected | Set preferred Catalan dialect (`central`, `balear`, `nord-occidental`, `valencia`) |
| `auth.getTtsDialect` | Query | Protected | Get current TTS dialect preference |
| `auth.autoDetectDialect` | Query | Protected | Auto-detect dialect from school location |
| `auth.changePassword` | Mutation | Protected | Change local password (requires current password) |
| `auth.generateCrossOriginToken` | Mutation | Protected | Generate short-lived SSO token for cross-domain login |
| `auth.redeemCrossOriginToken` | Mutation | Public | Exchange SSO token for a session cookie |
| `auth.setCutcgMemberNumber` | Mutation | Protected | Set CUTCG professional membership number |

### Aina (AI Chat)

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `aina.chat` | Mutation | Protected | Send a message to the AI teaching assistant |
| `aina.getHistory` | Query | Protected | Retrieve conversation history |
| `aina.clearHistory` | Mutation | Protected | Clear all conversation history |
| `aina.uploadFile` | Mutation | Protected | Upload a file for AI analysis (max 16MB) |
| `aina.rateMessage` | Mutation | Protected | Rate an AI response (thumbs up/down) |

### LOMLOE (Curriculum)

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `lomloe.getCompetencies` | Query | Public | List all 8 LOMLOE key competencies |
| `lomloe.getQuestions` | Query | Protected | Get practice questions by competency/year |
| `lomloe.getRandomQuestion` | Query | Protected | Get a random question for quick practice |
| `lomloe.submitAnswer` | Mutation | Protected | Submit and grade a practice answer |

### Materials

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `materials.generate` | Mutation | Protected | Generate teaching materials via AI |
| `materials.list` | Query | Protected | List saved materials for the current user |
| `materials.get` | Query | Protected | Get a specific material by ID |
| `materials.delete` | Mutation | Protected | Delete a saved material |
| `materials.duplicate` | Mutation | Protected | Duplicate an existing material |

### Challenge (Live Classroom)

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `challenge.create` | Mutation | Protected | Create a new challenge room |
| `challenge.join` | Mutation | Public | Join a challenge room by code |
| `challenge.start` | Mutation | Protected | Start the challenge (teacher only) |
| `challenge.next` | Mutation | Protected | Advance to next question |
| `challenge.finish` | Mutation | Protected | End the challenge |
| `challenge.getRoom` | Query | Public | Get room state by code |
| `challenge.submitAnswer` | Mutation | Public | Submit a student answer |

### Voice (TTS)

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `voice.tts` | Mutation | Protected | Synthesize speech from text |

### Privacy (GDPR)

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `privacy.getMyDataSummary` | Query | Protected | Summary of all stored personal data |
| `privacy.exportMyData` | Mutation | Protected | Export all personal data (GDPR portability) |
| `privacy.deleteMyData` | Mutation | Protected | Delete all personal data (right to erasure) |
| `privacy.runRetentionPurge` | Mutation | Admin | Manually trigger data retention cleanup |
| `privacy.generateParentReport` | Mutation | Protected | Generate a parent-readable PDF report |

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/api/trpc/aina.*` | 30 requests | 60 seconds |
| `/api/oauth/*` | 20 requests | 60 seconds |
| `/api/trpc/auth.*` | 20 requests | 60 seconds |
| `/api/trpc/mfa.*` | 10 requests | 60 seconds |

Rate limits are applied per IP address. Exceeding the limit returns HTTP 429 with a descriptive error message.

---

## Error Handling

All errors follow the tRPC error format:

```json
{
  "error": {
    "message": "Human-readable error description",
    "code": "TRPC_ERROR_CODE",
    "data": {
      "code": "BAD_REQUEST",
      "httpStatus": 400,
      "path": "router.procedure"
    }
  }
}
```

Common error codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `BAD_REQUEST` (400), `NOT_FOUND` (404), `INTERNAL_SERVER_ERROR` (500).

---

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Data Retention Purge | Weekly | Removes data older than 90 days, caps sessions at 200/user |
| Audit Log Purge | Weekly | Removes audit entries older than retention period |
| AI Bias Scan | Weekly | Scans AI-generated content for bias patterns |
| Translation Audit | Weekly | Validates i18n completeness and auto-fixes safe translations |
| Attendance Alarm | Daily | Sends alerts for missing teacher attendance records |
| Health Monitor | Every 5 min | Self-healing checks on critical system components |

---

## WebSocket / Real-time

Real-time features (challenge rooms, video calls, group messaging) use WebRTC signaling through tRPC mutations with polling. Video calls use the WebRTC peer-to-peer protocol with STUN/TURN servers.

---

## File Upload

Files are uploaded as base64-encoded payloads via `aina.uploadFile` (max 16MB). The server stores files in S3-compatible object storage and returns a signed URL. Supported formats: images (JPEG, PNG, WebP), documents (PDF), audio (MP3, WAV, WebM, OGG, M4A).

---

## Multi-tenancy

All data queries are automatically scoped to the authenticated user's `tenantId`. Users with `tenantId = NULL` are platform administrators with cross-tenant visibility. Tenant isolation is enforced at the database query level in every procedure.
