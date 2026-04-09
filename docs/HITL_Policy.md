# SEBA — Human-in-the-Loop (HITL) Policy

**Document reference:** SEBA-GOV-HITL-001  
**Version:** 1.0  
**Date:** April 2026  
**Classification:** Public  
**Owner:** AINA | TA / sebasnap.com  

---

## 1. Purpose and Scope

This document formally describes every point in the SEBA AI Teaching Assistant platform where a human actor — teacher, administrator, or student — can intervene in, override, review, or correct an AI-generated output. It is intended to satisfy the Human-in-the-Loop requirements of the **EU AI Act (Regulation (EU) 2024/1689)**, in particular Articles 9, 14, and 26, which mandate meaningful human oversight for AI systems used in education.

SEBA is classified as a **high-risk AI system** under Annex III, Category 4 (Education and Vocational Training) of the EU AI Act, because it generates assessments, learning path recommendations, and educational content that may influence a student's educational trajectory.

---

## 2. Definitions

| Term | Definition |
|---|---|
| **HITL touchpoint** | A specific location in the system where a human can review, approve, modify, or reject an AI output before it takes effect or is stored permanently |
| **AI output** | Any text, score, recommendation, or structured data produced by an AI model (LLM, translation model, bias detector) within SEBA |
| **Override** | A human actor's explicit decision to replace an AI-generated value with a human-determined value, recorded in the audit log |
| **Justification** | A structured AI-generated explanation of the reasoning behind a recommendation, available for human review |
| **Bias flag** | An automatic or manual marker indicating that an AI output may contain gender, background, or other demographic bias |

---

## 3. HITL Touchpoints

### 3.1 Grade and Assessment Override

**Location:** AI Accountability Dashboard → Grade Overrides tab  
**Trigger:** A teacher reviews an AI-generated competency assessment for a student.  
**Human action:** The teacher may override the AI score with a manually determined grade. A written reason is **mandatory** before the override is accepted.  
**Audit trail:** Every override is permanently logged with: teacher user ID, timestamp, original AI score, new teacher score, and the written reason. The log is immutable.  
**Regulatory basis:** EU AI Act Art. 14(4) — the human overseer must be able to decide not to use the AI system output.

### 3.2 Bias Incident Review and Resolution

**Location:** AI Accountability Dashboard → Bias Incidents tab  
**Trigger:** The bias guard middleware automatically flags an AI chat response that may contain gender or background bias.  
**Human action:** A teacher or administrator reviews the flagged input and output, then marks the incident as resolved (or escalates it). Unresolved flags remain visible indefinitely.  
**Audit trail:** All flags are stored with severity level, input/output snippets (truncated to 200 characters to minimise PII), flag reason, and resolution status.  
**Regulatory basis:** EU AI Act Art. 9(5)(d) — bias testing and monitoring; Art. 14(1) — human oversight measures.

### 3.3 Learning Path Justification Review

**Location:** AI Accountability Dashboard → Learning Paths tab  
**Trigger:** A teacher generates a personalised LOMLOE-aligned learning path for a student.  
**Human action:** Before sharing the path with a student or parent, the teacher reviews the full justification report, which includes: recommended steps, rationale for each step, LOMLOE competency references, and the evidence used. The teacher may choose not to share the path or to modify it externally.  
**Audit trail:** All generated paths are stored with the generating teacher's ID, student ID, competency, year group, and timestamp.  
**Regulatory basis:** EU AI Act Art. 13 — transparency and provision of information; Art. 14(4) — human decision authority.

### 3.4 AI-Generated Teaching Material Review

**Location:** Create Material page → My Materials  
**Trigger:** A teacher requests AI generation of a quiz, crossword, flashcard set, or other teaching material.  
**Human action:** All generated materials are saved to "My Materials" in draft state. The teacher must explicitly open, review, and optionally edit the material before distributing it to students. No material is automatically sent to students.  
**Audit trail:** Materials are stored with creator ID, generation timestamp, topic, competency, and year group.  
**Regulatory basis:** EU AI Act Art. 14(2) — the human overseer must understand the AI system's capabilities and limitations.

### 3.5 Lesson Plan Review Before Use

**Location:** Lesson Planner  
**Trigger:** A teacher uses AI Infill to auto-complete sections of a lesson plan.  
**Human action:** AI-infilled content is inserted into editable form fields. The teacher must explicitly save the plan; no plan is auto-saved or auto-distributed. Template loading also requires explicit teacher confirmation.  
**Audit trail:** Lesson plans are stored with creator ID, creation and modification timestamps, and a flag indicating whether AI infill was used.  
**Regulatory basis:** EU AI Act Art. 14(4).

### 3.6 Catalan Dialect Confirmation

**Location:** First-visit dialect picker (CatalanDialectDetector)  
**Trigger:** On first use of the Catalan language mode, the system detects the user's IP region and suggests a dialect variant.  
**Human action:** The user must explicitly confirm or reject the suggested dialect. The IEC Standard Catalan option is always presented as the default. No dialect is applied without user consent.  
**Audit trail:** Dialect choice is stored in the user's browser localStorage only; no server-side profiling of dialect preference is performed.  
**Regulatory basis:** EU AI Act Art. 13(3)(b) — disclosure of AI system characteristics affecting users.

### 3.7 Practice Question Translation Review (Admin)

**Location:** Admin Dashboard → Translate Questions  
**Trigger:** An administrator initiates batch translation of practice questions into Spanish or Catalan using the Aina (BSC Salamandra / Helsinki-NLP) translation models.  
**Human action:** Translation is not automatic — an administrator must manually trigger each batch. After generation, translations are visible in the question library for spot-checking and manual correction before students encounter them in Practice Mode.  
**Audit trail:** Translation timestamps and locale are stored per question in the `question_translations` table.  
**Regulatory basis:** EU AI Act Art. 9(5)(d) — human oversight of AI-generated content used in education.

### 3.8 Data Deletion Confirmation

**Location:** My Privacy Dashboard → Delete All My Data  
**Trigger:** A user requests deletion of all their personal data.  
**Human action:** The user must type the exact phrase "DELETE MY DATA" before the deletion proceeds. This deliberate friction prevents accidental data loss and ensures informed consent.  
**Audit trail:** Deletion events are logged at server level (user ID, timestamp) before the data is removed.  
**Regulatory basis:** GDPR Art. 17 — right to erasure; EU AI Act Art. 9(7) — data governance.

---

## 4. AI Outputs That Are NOT Subject to HITL

The following AI outputs are considered low-risk and are delivered directly to users without a mandatory human review step. They are monitored by the bias guard but do not require explicit approval:

| Output | Rationale |
|---|---|
| Aina chat responses | Conversational; no binding educational decision; bias-guarded |
| Practice question explanations | Informational; student can re-read or ask Aina for clarification |
| Competency radar chart data | Derived from student's own answers; no AI scoring involved |
| Catalan dialect vocabulary overrides | Cosmetic UI text; no educational consequence |

---

## 5. Escalation Procedure

If a teacher or administrator identifies an AI output that is harmful, biased, or factually incorrect and the in-app controls are insufficient to address it:

1. Use the **Bias Incident** resolution flow to flag and document the issue.
2. Contact the SEBA platform owner via the notification system (`trpc.system.notifyOwner`).
3. For systemic issues, contact the BSC Language Technologies team via [projecteaina.cat](https://projecteaina.cat) if the issue relates to Salamandra model outputs.
4. For GDPR/EU AI Act compliance concerns, contact the Data Protection Officer (DPO) identified in the Data Processing Agreement (SEBA-GOV-DPA-001).

---

## 6. Review and Update Schedule

This document is reviewed annually or whenever a significant change is made to the AI components of SEBA (new models, new AI-generated output types, or changes to the accountability infrastructure). The version history is maintained in the project repository.

---

## 7. Related Documents

| Document | Reference |
|---|---|
| EU AI Act Technical Documentation | SEBA-GOV-EUAI-001 |
| Data Processing Agreement (DPA) | SEBA-GOV-DPA-001 |
| Privacy Policy | /privacy (in-app) |
| Bias Guard Implementation | `server/biasGuard.ts` |
| Grade Override Implementation | `server/routers/accountability.ts` |

---

*This document was prepared in accordance with EU AI Act (Regulation (EU) 2024/1689) requirements for high-risk AI systems in education.*
