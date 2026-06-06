# SEBA AI Studio — Security & Privacy Policy

**Version:** 1.0  
**Last Updated:** May 2026  
**Data Controller:** SEBA (Sovereign Educational AI Platform for Catalonia)  
**Contact:** admin@sebaina.com

---

## 1. Overview

SEBA AI Studio is designed for use in educational institutions across Catalonia, serving teachers, students, and school administrators. This document outlines our security architecture, data handling practices, and compliance with applicable regulations including the **General Data Protection Regulation (GDPR)**, **Ley Orgánica de Protección de Datos (LOPD-GDD)**, and **sector-specific education data protection requirements**.

---

## 2. Regulatory Compliance

| Regulation | Scope | Status |
|-----------|-------|--------|
| GDPR (EU 2016/679) | Personal data processing | Compliant |
| LOPD-GDD (LO 3/2018) | Spanish data protection | Compliant |
| LOPDGDD Art. 92 | Rights of minors in digital environments | Compliant |
| Catalan Education Law (LEC) | Student data in Catalan schools | Compliant |
| ePrivacy Directive | Cookies and electronic communications | Compliant |
| ISO 27001 | Information security management | Aligned (not certified) |

---

## 3. Data Classification

### 3.1 Personal Data Collected

| Category | Data Elements | Legal Basis | Retention |
|----------|--------------|-------------|-----------|
| Identity | Name, email, OpenID | Contract performance | Account lifetime |
| Authentication | Hashed passwords, MFA seeds | Legitimate interest (security) | Account lifetime |
| Educational | Practice answers, progress scores | Contract performance | 90 days (configurable) |
| Communications | Chat messages with AI | Contract performance | 90 days |
| Technical | IP address, user agent, session tokens | Legitimate interest (security) | 30 days |
| Preferences | Language, dialect, voice, theme | Consent | Account lifetime |

### 3.2 Special Category Data

SEBA AI Studio does **not** intentionally collect:
- Biometric data (voice recordings are processed in real-time, not stored)
- Health data
- Political opinions or religious beliefs
- Racial or ethnic origin data

### 3.3 Children's Data

When students under 14 use the platform:
- Parental/guardian consent is obtained through the school (institutional agreement)
- Minimal data collection principle applies
- AI chat interactions are subject to enhanced content filtering
- No behavioral profiling or targeted advertising

---

## 4. Data Processing Architecture

### 4.1 Data Flow

```
Student/Teacher ──HTTPS──> SEBA Server ──encrypted──> TiDB (EU)
                                │
                                ├──> S3 Storage (EU)
                                │
                                └──> LLM API (processing only, no storage)
```

### 4.2 Data Residency

| Component | Location | Provider |
|-----------|----------|----------|
| Application Server | EU (Frankfurt) | Manus Cloud |
| Database | EU | TiDB Serverless |
| Object Storage | EU | S3-compatible |
| LLM Processing | Transient (no storage) | Manus Forge |
| TTS Processing | EU (Barcelona) | BSC AINA |

### 4.3 Sub-processors

| Sub-processor | Purpose | Data Access | DPA Status |
|--------------|---------|-------------|------------|
| Manus Platform | Hosting, OAuth, LLM | Full application data | In place |
| TiDB Cloud | Database hosting | Encrypted at rest | In place |
| BSC (Barcelona Supercomputing Center) | Catalan TTS | Text input only (transient) | Public service |

---

## 5. Security Controls

### 5.1 Transport Security

- **TLS 1.3** enforced for all connections
- **HSTS** with 1-year max-age, includeSubDomains, preload
- **Certificate transparency** monitoring
- No mixed content allowed (strict CSP)

### 5.2 Authentication & Session Management

- **OAuth 2.0** via Manus Identity Provider (primary)
- **Local authentication** with bcrypt-hashed passwords (fallback)
- **Multi-factor authentication** (TOTP) available for all users
- **Session tokens** — JWT with 8-hour maximum lifetime
- **Sliding renewal** — Sessions extended on activity (max 4h remaining)
- **Session versioning** — Global invalidation on password change
- **Rate limiting** — 20 auth attempts per minute per IP

### 5.3 Authorization

- **Role-Based Access Control (RBAC)** with 6 hierarchical roles
- **Tenant isolation** — All queries scoped by organization
- **Procedure-level guards** — Each API endpoint declares its access level
- **Principle of least privilege** — Users see only their own data

### 5.4 Application Security

- **Content Security Policy** — Nonce-based script-src (no unsafe-inline)
- **X-Frame-Options: SAMEORIGIN** — Clickjacking prevention
- **Input validation** — Zod schemas on every API input
- **SQL injection prevention** — Parameterized queries via Drizzle ORM
- **XSS prevention** — React's built-in escaping + CSP
- **CSRF protection** — SameSite=Lax cookies + origin validation

### 5.5 Data Protection

- **Encryption at rest** — AES-256 (database and storage)
- **Encryption in transit** — TLS 1.3
- **Key management** — Platform-managed rotation
- **Backup encryption** — Same key as primary storage
- **Secure deletion** — Overwrite on data erasure requests

### 5.6 Monitoring & Incident Response

- **Audit logging** — All security events recorded with IP, user agent, severity
- **Self-healing monitor** — Automated health checks every 5 minutes
- **Anomaly detection** — Unusual login patterns trigger alerts
- **Incident response** — 72-hour GDPR breach notification commitment

---

## 6. Data Subject Rights (GDPR Articles 15–22)

SEBA AI Studio provides built-in tools for exercising data rights:

| Right | Implementation | Access |
|-------|---------------|--------|
| Right of Access (Art. 15) | `privacy.getMyDataSummary` — View all stored data | Self-service |
| Right to Rectification (Art. 16) | Profile editing in Settings | Self-service |
| Right to Erasure (Art. 17) | `privacy.deleteMyData` — Complete account deletion | Self-service |
| Right to Portability (Art. 20) | `privacy.exportMyData` — JSON/PDF export | Self-service |
| Right to Restriction (Art. 18) | Contact DPO for processing restriction | Manual request |
| Right to Object (Art. 21) | Opt-out of AI profiling in Settings | Self-service |

### 6.1 Data Export Format

Exported data includes:
- Personal profile information (JSON)
- All practice session history (JSON)
- AI chat conversation logs (JSON)
- Generated materials (JSON + files)
- Progress and assessment data (JSON)

### 6.2 Data Deletion Process

When a user requests deletion:
1. Account is immediately deactivated
2. Personal identifiers are anonymized within 24 hours
3. Associated content is purged within 30 days
4. Backup copies are overwritten within 90 days
5. Confirmation email sent to the user

---

## 7. Data Retention Policy

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| Active user profiles | Account lifetime | Contract performance |
| Practice session data | 90 days | Educational purpose |
| AI chat history | 90 days | Service improvement |
| Audit logs | 1 year | Legal obligation |
| Security events | 1 year | Legitimate interest |
| Deleted account data | 30 days (anonymized) | Technical necessity |
| Backup data | 90 days | Disaster recovery |

Automated retention purge runs weekly, removing:
- Chat messages older than 90 days
- Practice sessions older than 90 days
- Excess sessions beyond 200 per user (oldest first)
- Orphaned file references

---

## 8. AI-Specific Privacy Measures

### 8.1 LLM Data Handling

- **No training on user data** — Conversations are not used to train models
- **Transient processing** — LLM API calls are stateless; no data retained by the provider
- **Content filtering** — AI responses are scanned for inappropriate content
- **Bias monitoring** — Weekly automated scans for discriminatory patterns
- **Transparency** — Users are informed they are interacting with AI

### 8.2 AI Governance

- AI-generated content is clearly labeled
- Teachers can review and override AI suggestions
- No automated decision-making with legal effects (Art. 22 GDPR)
- Human oversight maintained for all educational assessments

---

## 9. Data Processing Agreement (DPA)

SEBA provides a standard DPA for institutional customers that covers:
- Scope and purpose of processing
- Sub-processor list and notification obligations
- Technical and organizational measures (TOMs)
- Data breach notification procedures
- Audit rights
- Data return and deletion on contract termination

Schools can generate and review the DPA directly within the platform (Director Settings → Data Protection → DPA).

---

## 10. Data Protection Impact Assessment (DPIA)

A DPIA has been conducted for SEBA AI Studio covering:
- Processing of children's educational data
- AI-powered profiling (competency tracking)
- Large-scale processing of special category data (educational records)

The DPIA is available for review by Data Protection Authorities upon request. Schools can access a summary via Director Settings → Data Protection → DPIA.

---

## 11. Cookies & Local Storage

| Name | Type | Purpose | Duration |
|------|------|---------|----------|
| `seba_session` | Essential | Authentication session | 8 hours |
| `seba_lang` | Functional | Language preference | 1 year |
| `seba_dialect` | Functional | Dialect preference | 1 year |
| `seba_theme` | Functional | Dark/light theme | 1 year |
| `localStorage:*` | Functional | UI state, preferences | Persistent |

No third-party tracking cookies are used. No advertising cookies. No analytics cookies that identify individuals.

---

## 12. Vulnerability Disclosure

We welcome responsible disclosure of security vulnerabilities:

- **Contact:** admin@sebaina.com (subject: "Security Vulnerability")
- **Response time:** Acknowledgment within 48 hours
- **Resolution target:** Critical vulnerabilities patched within 7 days
- **Recognition:** Responsible reporters credited in release notes (with permission)

---

## 13. Updates to This Policy

This policy is reviewed quarterly and updated as needed. Material changes are communicated to institutional administrators via the platform notification system. The current version is always available at `docs/SECURITY.md` in the source repository.
