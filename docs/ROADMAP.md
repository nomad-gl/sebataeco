# SEBA AI Studio — Product Roadmap

**Last Updated:** May 2026  
**Status:** Active Development

---

## Vision

SEBA AI Studio aims to become the definitive AI-powered teaching platform for Catalan schools, providing educators with sovereign, curriculum-aligned tools that respect linguistic diversity, data privacy, and pedagogical best practices.

---

## Release History

### v1.0 — Foundation (Delivered)

The core platform with essential teaching tools:

- **AI Teaching Assistant (Aina)** — LOMLOE-aligned conversational AI with multilingual support (CA/ES/EN), file upload analysis, voice input/output, and adaptive context
- **LOMLOE Knowledge Bank** — 200+ curated practice questions across all 8 key competencies, with Catalan translations and adaptive difficulty
- **Materials Generator** — AI-powered creation of quizzes, crosswords, flashcards, word searches, fill-in-the-blank, matching exercises, and slide presentations
- **Live Challenges** — Real-time classroom quiz competitions with room codes, leaderboards, and instant feedback
- **Progress Tracking** — Per-student competency progress with AI-generated reports and parent-readable summaries
- **Multi-tenant Architecture** — School-level data isolation with role hierarchy (Director → Head of Study → Teacher → Student)
- **Catalan Dialect Support** — 4 dialect variants (Central, Balearic, Nord-Occidental, Valencian) with geographic auto-detection
- **BSC AINA TTS** — Native Catalan text-to-speech powered by Barcelona Supercomputing Center
- **GDPR Compliance** — Built-in data export, deletion, retention purge, DPA, and DPIA tools
- **Security Suite** — MFA, audit logging, rate limiting, session management, self-healing health monitor
- **Teacher Collaboration** — Discussion forum, video calls (WebRTC), meeting scheduling, staff directory
- **School Management** — Attendance tracking, cover lessons, timetabling, academic calendar

---

## Current Sprint

### v1.1 — Reliability & Polish (In Progress)

| Feature | Status | Target |
|---------|--------|--------|
| Self-hosted TTS (Docker) | 🔄 In Progress | June 2026 |
| Voice preview error handling | ✅ Complete | — |
| Auto-detect dialect from school location | ✅ Complete | — |
| Translation audit automation | ✅ Complete | — |
| Self-healing health monitor | ✅ Complete | — |
| Teacher attendance alerts | ✅ Complete | — |

---

## Upcoming Releases

### v1.2 — Student Experience (Q3 2026)

Expanding the platform from teacher-centric to student-facing:

| Feature | Description | Priority |
|---------|-------------|----------|
| Student Portal | Dedicated student login with age-appropriate UI | High |
| Homework Assignments | Teachers assign practice sets with deadlines | High |
| Gamification | XP, badges, streaks, and class leaderboards | Medium |
| Parent Dashboard | Read-only progress view for parents/guardians | Medium |
| Peer Collaboration | Student study groups with shared question sets | Low |

### v1.3 — Advanced AI (Q4 2026)

Deepening AI capabilities for personalized learning:

| Feature | Description | Priority |
|---------|-------------|----------|
| Adaptive Learning Paths | AI-generated personalized study plans per student | High |
| Writing Coach | Real-time AI feedback on student essays (CA/ES/EN) | High |
| Image-based Questions | AI analysis of diagrams, maps, and artwork | Medium |
| Voice Conversations | Full spoken dialogue with Aina (not just TTS playback) | Medium |
| Salamandra Integration | On-premise LLM for complete data sovereignty | High |

### v1.4 — Institutional Scale (Q1 2027)

Enterprise features for district-wide deployment:

| Feature | Description | Priority |
|---------|-------------|----------|
| ZER Management | Territorial Director tools for multi-school oversight | High |
| Analytics Dashboard | District-level competency analytics and benchmarking | High |
| LTI Integration | Connect with existing LMS (Moodle, Google Classroom) | High |
| API for Third Parties | Public REST API for external tool integration | Medium |
| White-labeling | Custom branding per school/district | Low |

### v1.5 — Accessibility & Inclusion (Q2 2027)

Ensuring the platform serves all learners:

| Feature | Description | Priority |
|---------|-------------|----------|
| Screen Reader Optimization | Full ARIA compliance and keyboard navigation | High |
| Dyslexia Mode | OpenDyslexic font, increased spacing, color overlays | High |
| Sign Language Support | BSL/LSC video explanations for key concepts | Medium |
| Simplified UI Mode | Reduced cognitive load interface for younger students | Medium |
| Offline Mode | PWA with offline question practice (cached sets) | Medium |

---

## Technical Debt & Infrastructure

| Item | Description | Timeline |
|------|-------------|----------|
| TypeScript strict mode | Resolve 131 existing type errors | Q3 2026 |
| Test coverage | Increase from ~40% to 80% | Q3 2026 |
| Performance optimization | Lazy-load heavy routes, optimize bundle size | Q3 2026 |
| Database indexing | Add missing indexes for slow queries | Q3 2026 |
| Monitoring stack | Integrate Sentry/Datadog for production observability | Q4 2026 |
| CI/CD pipeline | GitHub Actions for automated testing and deployment | Q3 2026 |

---

## Research & Exploration

These items are being investigated but not yet committed:

- **Multimodal AI** — Image/video generation for teaching materials
- **AR/VR Integration** — Immersive learning experiences for science/geography
- **Blockchain Credentials** — Verifiable competency certificates
- **Edge AI** — On-device inference for offline and privacy-sensitive scenarios
- **Cross-school Challenges** — Inter-school competitions with anonymized leaderboards
- **Teacher AI Co-pilot** — Real-time classroom assistance during lessons (requires tablet/smartboard integration)

---

## How We Prioritize

Features are prioritized using the following framework:

1. **Pedagogical Impact** — Does it measurably improve learning outcomes?
2. **Teacher Time Saved** — Does it reduce administrative burden?
3. **Data Sovereignty** — Does it keep data under institutional control?
4. **Linguistic Equity** — Does it serve Catalan-speaking communities equitably?
5. **Technical Feasibility** — Can it be delivered reliably within the timeline?

---

## Feedback & Feature Requests

We actively incorporate feedback from:
- Pilot school teachers (direct interviews)
- Platform usage analytics (anonymized)
- Community forum discussions
- Institutional partner requirements

To suggest a feature or report an issue: hello@sebasnap.com
