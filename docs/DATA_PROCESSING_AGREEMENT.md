# Data Processing Agreement (DPA)

**AINA | TA — Educational Platform**
**Version:** 1.0
**Effective Date:** 8 April 2026
**Review Date:** 8 April 2027

---

## Parties

This Data Processing Agreement ("Agreement") is entered into between:

**Data Controller:** The educational institution or individual teacher ("Controller") accessing AINA | TA through the platform at `sebaaihub-zdur4nnh.seba.space` or any associated domain.

**Data Processor:** The operator of AINA | TA ("Processor"), acting on behalf of the Controller to process personal data as described in this Agreement.

This Agreement forms part of the Terms of Service and is incorporated by reference. It governs all processing of personal data carried out by the Processor on behalf of the Controller in connection with the AINA | TA platform.

---

## 1. Definitions

For the purposes of this Agreement, the following definitions apply:

| Term | Definition |
|---|---|
| **GDPR** | Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 |
| **EU AI Act** | Regulation (EU) 2024/1689 of the European Parliament and of the Council of 13 June 2024 |
| **LOMLOE** | Ley Orgánica 3/2020 de 29 de diciembre, by which the Spanish Organic Law on Education is modified |
| **Personal Data** | Any information relating to an identified or identifiable natural person ("data subject") as defined in Article 4(1) GDPR |
| **Processing** | Any operation performed on personal data, as defined in Article 4(2) GDPR |
| **Special Category Data** | Personal data revealing racial or ethnic origin, political opinions, religious or philosophical beliefs, trade union membership, genetic data, biometric data, health data, or data concerning a natural person's sex life or sexual orientation, as defined in Article 9 GDPR |
| **EEA** | European Economic Area, comprising the EU Member States plus Iceland, Liechtenstein, and Norway |
| **Catalan Public Cloud** | Núvol Públic de Catalunya, the sovereign cloud infrastructure operated under the authority of the Generalitat de Catalunya |
| **Sub-processor** | Any third party engaged by the Processor to carry out processing activities on behalf of the Controller |
| **Aina** | The AI assistant integrated into AINA | TA, powered by large language models and the BSC Salamandra framework |

---

## 2. Subject Matter and Duration

### 2.1 Subject Matter

The Processor provides an AI-powered educational platform ("AINA | TA") that enables teachers to:

- Conduct AI-assisted chat sessions with the Aina assistant for curriculum guidance;
- Generate teaching materials, lesson plans, and school calendars;
- Administer practice mode assessments aligned with LOMLOE competency frameworks;
- Receive AI-generated student progress assessments and learning path recommendations;
- Manage class groups and track student progress.

### 2.2 Duration

This Agreement remains in force for as long as the Processor processes personal data on behalf of the Controller. Upon termination of the service relationship, the Processor shall, at the Controller's election, delete or return all personal data within 30 days, unless applicable law requires longer retention.

---

## 3. Nature and Purpose of Processing

### 3.1 Nature of Processing

The Processor carries out the following types of processing operations:

- **Collection:** Gathering user-provided data (account registration, chat messages, practice session results, lesson plan content) and automatically generated data (session logs, AI outputs, bias detection records).
- **Storage:** Persisting data in a relational database hosted within the EEA.
- **Use:** Passing relevant data to AI inference endpoints to generate educational content, assessments, and recommendations.
- **Disclosure:** Presenting processed data to authorised users (teachers, administrators) through the platform interface.
- **Deletion:** Automated purging of data in accordance with the retention schedule in Section 6.

### 3.2 Purposes of Processing

All processing is carried out exclusively for the following purposes:

1. Providing the core educational platform functionality to the Controller and its authorised users.
2. Generating AI-assisted educational content, assessments, and personalised learning recommendations.
3. Maintaining audit trails of AI decisions to satisfy EU AI Act (Article 12–13) and GDPR (Article 22) obligations.
4. Detecting and logging AI bias incidents to ensure fairness and non-discrimination in educational outputs.
5. Enabling teachers to exercise human oversight and override AI-generated grades and assessments.
6. Providing data export and deletion capabilities to data subjects exercising GDPR rights.
7. Complying with applicable legal obligations, including GDPR, the EU AI Act, and Spanish/Catalan education law.

---

## 4. Categories of Data Subjects and Personal Data

### 4.1 Data Subjects

| Category | Description |
|---|---|
| **Teachers / Educators** | Registered users of the platform who create and manage educational content |
| **Students** | Learners whose practice session data and progress information is processed (identified by pseudonymous student IDs assigned by the teacher) |
| **School Administrators** | Users with elevated access for administrative and compliance functions |

> **Important:** AINA | TA does not directly collect personal data from students. Student data is entered by teachers using pseudonymous identifiers. The platform does not collect student names, dates of birth, national identification numbers, or other directly identifying information.

### 4.2 Categories of Personal Data

| Category | Examples | Legal Basis |
|---|---|---|
| **Account data** | Name, email address, OAuth identifier | Article 6(1)(b) GDPR — performance of contract |
| **Usage data** | Login timestamps, page views, feature interactions | Article 6(1)(f) GDPR — legitimate interests (platform security and improvement) |
| **Educational content** | Lesson plans, teaching materials, school calendars | Article 6(1)(b) GDPR — performance of contract |
| **Practice session data** | Question responses, scores, timestamps (pseudonymous student IDs only) | Article 6(1)(b) GDPR — performance of contract |
| **AI interaction data** | Chat messages sent to Aina, AI-generated responses | Article 6(1)(b) GDPR — performance of contract |
| **AI assessment records** | Competency scores, AI narrative summaries, teacher overrides | Article 6(1)(b) GDPR — performance of contract |
| **Bias incident logs** | Truncated input/output text (max 200 characters), severity, resolution status | Article 6(1)(c) GDPR — legal obligation (EU AI Act Article 12) |
| **Audit trail records** | Event type, timestamp, user ID, action summary | Article 6(1)(c) GDPR — legal obligation (EU AI Act Article 12) |

### 4.3 Special Category Data

The Processor does not intentionally collect special category data as defined in Article 9 GDPR. The Controller is responsible for ensuring that no special category data is entered into the platform. If special category data is inadvertently included in user-generated content (e.g., a lesson plan narrative), it is processed solely on the basis of Article 9(2)(g) GDPR (substantial public interest in the educational context) and Article 9(2)(j) GDPR (scientific or historical research purposes), subject to appropriate safeguards.

---

## 5. Obligations of the Processor

The Processor undertakes to:

### 5.1 Instruction Compliance

Process personal data only on documented instructions from the Controller, unless required to do so by applicable Union or Member State law. The Processor shall immediately inform the Controller if, in its opinion, an instruction infringes GDPR or other applicable data protection provisions.

### 5.2 Confidentiality

Ensure that persons authorised to process personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.

### 5.3 Security Measures

Implement and maintain appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including:

- **Encryption in transit:** All data transmitted between clients and the server is encrypted using TLS 1.2 or higher.
- **Encryption at rest:** Database contents are encrypted at rest using AES-256.
- **Access control:** Role-based access control (RBAC) ensures that only authorised users can access specific data. Admin-only procedures are protected by server-side role checks.
- **Authentication:** OAuth 2.0 authentication via the SEBA identity provider; session tokens are signed with a server-side secret (JWT_SECRET).
- **PII minimisation:** Bias incident logs are truncated to 200 characters to minimise exposure of personal data.
- **Pseudonymisation:** Student data is processed using teacher-assigned pseudonymous identifiers; the platform does not link student IDs to real identities.
- **Audit logging:** All significant AI decisions are logged with timestamps, user IDs, and action summaries for accountability purposes.

### 5.4 Sub-processor Management

Not engage a new sub-processor without prior written authorisation from the Controller. Where the Processor engages sub-processors, it shall impose the same data protection obligations as set out in this Agreement on those sub-processors by contract.

### 5.5 Data Subject Rights

Assist the Controller, by appropriate technical and organisational measures, in fulfilling its obligation to respond to requests from data subjects exercising their rights under GDPR (Articles 15–22). The platform provides:

- **Right of access:** Data export functionality available to each user from the Privacy Dashboard (`/privacy`).
- **Right to erasure:** "Delete All My Data" function permanently removes all personal data associated with the account.
- **Right to data portability:** Exported data is provided in machine-readable JSON format.
- **Right to object to automated decision-making:** Teachers can override any AI-generated grade or assessment at any time; no AI decision is final.

### 5.6 Data Breach Notification

Notify the Controller without undue delay, and in any event within 72 hours, after becoming aware of a personal data breach, providing sufficient information to allow the Controller to meet its own notification obligations under Article 33 GDPR.

### 5.7 Data Protection Impact Assessment

Assist the Controller in ensuring compliance with its obligations under Articles 35 and 36 GDPR (Data Protection Impact Assessment and prior consultation), taking into account the nature of processing and the information available to the Processor.

### 5.8 Deletion and Return

At the choice of the Controller, delete or return all personal data upon termination of the service, and delete existing copies unless applicable law requires storage.

### 5.9 Audit Cooperation

Make available to the Controller all information necessary to demonstrate compliance with the obligations laid down in Article 28 GDPR, and allow for and contribute to audits and inspections conducted by the Controller or an auditor mandated by the Controller.

---

## 6. Data Retention Schedule

The Processor applies the following automated retention policy:

| Data Category | Retention Period | Deletion Mechanism |
|---|---|---|
| Practice session records | Rolling cap of 200 most recent sessions per user | Automated nightly purge (cron job) |
| AI chat messages | 90 days from last activity | Automated nightly purge |
| Aina behavioural profile | Reset after 90 days of inactivity | Automated nightly purge |
| Bias incident logs (resolved) | 30 days after resolution | Automated nightly purge |
| Read notifications | 30 days after reading | Automated nightly purge |
| AI assessment records | Retained until user deletion request | User-initiated via Privacy Dashboard |
| Learning path records | Retained until user deletion request | User-initiated via Privacy Dashboard |
| Grade override audit trail | Retained for minimum 5 years (legal obligation) | Manual deletion by administrator only |
| Lesson plans and calendars | Retained until user deletion request | User-initiated via Privacy Dashboard |
| Account data | Retained until account deletion | User-initiated via Privacy Dashboard |

---

## 7. International Data Transfers

### 7.1 EEA Hosting Commitment

All personal data processed by AINA | TA is stored and processed exclusively within the **European Economic Area (EEA)**. The platform's primary infrastructure is hosted on the **SEBA Platform**, whose data centres are located within the EEA. Where technically feasible, data is additionally hosted on or migrated towards the **Núvol Públic de Catalunya** (Catalan Public Cloud), in accordance with Catalan data sovereignty principles.

The Catalan Public Cloud initiative is supported by two complementary frameworks:

1. **Nuvulus Public Cloud** — a Catalan-sovereign cloud platform operated by Sercom, running from three interconnected data centres located entirely within Catalonia (Spain, EEA). Nuvulus is designed for enterprises and public institutions requiring full data sovereignty, with all data remaining within Catalan territory and subject to Spanish/EU jurisdiction, with no dependency on non-EEA legal requirements.

2. **Generalitat de Catalunya AI 2030 Strategy** — the Catalan Government's €1 billion AI strategy (announced November 2025) includes the creation of a sovereign Catalan public cloud infrastructure to guarantee the sovereignty of digital data and services for public-sector applications. AINA | TA, as an educational platform serving Catalan schools, aligns with this strategic objective.

The Processor commits to prioritising EEA-sovereign hosting providers and to migrating to the Catalan Public Cloud infrastructure as it becomes available for production educational workloads.

### 7.2 Sub-processor Transfers

Where sub-processors are located within the EEA, transfers are governed by applicable EEA data protection law. No personal data is transferred to third countries outside the EEA without appropriate safeguards as required by Chapter V GDPR.

### 7.3 AI Inference

AI inference for the Aina assistant and translation services uses models accessed via the Hugging Face Inference API. The Processor has confirmed that:

- Only non-personal data (question text, curriculum content) is sent to Hugging Face for translation purposes.
- Student identifiers, names, and other personal data are never included in API requests to Hugging Face.
- Hugging Face operates data centres within the EEA and is subject to a Data Processing Agreement with the Processor.

---

## 8. Sub-processors

The Controller authorises the Processor to engage the following sub-processors:

| Sub-processor | Role | Location | Transfer Safeguard |
|---|---|---|---|
| **SEBA Platform** | Infrastructure hosting, OAuth authentication, database services | EEA | EEA-based processing |
| **Hugging Face** | Neural machine translation (Helsinki-NLP models) for question bank localisation | EEA (EU data centres) | EEA-based processing; no personal data transmitted |
| **BSC (Barcelona Supercomputing Center)** | Salamandra LLM framework attribution; model weights | Spain (EEA) | EEA-based processing |
| **ip-api.com** | IP geolocation for Catalan dialect detection | EEA | Only IP address transmitted; no personal data linked to user accounts |

The Processor shall notify the Controller of any intended changes concerning the addition or replacement of sub-processors, giving the Controller the opportunity to object to such changes.

---

## 9. EU AI Act Compliance

AINA | TA is classified as a **high-risk AI system** under Annex III of the EU AI Act (educational and vocational training AI systems). The Processor has implemented the following measures in accordance with the EU AI Act:

### 9.1 Risk Management (Article 9)

A risk management system is maintained throughout the lifecycle of the AI system. Known risks include: generation of biased educational content, over-reliance on AI assessments, and potential for AI-generated content to reflect training data biases. Mitigations are documented in `docs/EU_AI_ACT_TECHNICAL_FILE.md`.

### 9.2 Data Governance (Article 10)

Training data and operational data practices are documented. The platform uses only curriculum-aligned question banks and teacher-provided content for AI operations. No student demographic data is used in AI model inputs.

### 9.3 Technical Documentation (Article 11)

Full technical documentation is maintained in `docs/EU_AI_ACT_TECHNICAL_FILE.md`, covering system architecture, AI model descriptions, training data provenance, and performance metrics.

### 9.4 Transparency and Information (Article 13)

Plain-language descriptions of all AI decision-making processes are available to teachers and administrators from the Audit Dashboard (`/audit`) under the "Algorithm Description" tab.

### 9.5 Human Oversight (Article 14)

All AI-generated grades, assessments, and learning path recommendations can be reviewed and overridden by teachers. No AI decision is presented as final. Human-in-the-loop intervention points are formally documented in `docs/HITL_POLICY.md`.

### 9.6 Accuracy, Robustness, and Cybersecurity (Article 15)

AI outputs are subject to a two-stage bias detection process before presentation to users. Bias incidents are logged and reviewed by administrators. Performance metrics are tracked and reviewed quarterly.

### 9.7 Logging (Article 12)

Automatic logging of AI decisions, human overrides, and bias incidents is implemented. Logs are accessible to administrators from the Audit Dashboard and are retained for a minimum of 5 years for grade override records.

---

## 10. Obligations of the Controller

The Controller undertakes to:

1. Ensure that it has a lawful basis for processing personal data before instructing the Processor to process it on its behalf.
2. Ensure that data subjects (teachers, and parents/guardians of students) have been provided with the information required by Articles 13 and 14 GDPR.
3. Ensure that student data entered into the platform uses pseudonymous identifiers and does not include unnecessary personal information.
4. Not instruct the Processor to process special category data unless a specific legal basis under Article 9 GDPR applies.
5. Promptly notify the Processor of any data subject requests received directly by the Controller that require the Processor's assistance.
6. Ensure that any person accessing the platform on behalf of the Controller is bound by appropriate confidentiality obligations.

---

## 11. Liability and Indemnification

Each party shall be liable for damages caused by processing that infringes GDPR in accordance with Article 82 GDPR. Where both parties are responsible for damage caused by processing, each party shall be held liable for the entire damage in order to ensure effective compensation of the data subject. A party shall be exempt from liability if it proves that it is not in any way responsible for the event giving rise to the damage.

---

## 12. Governing Law and Jurisdiction

This Agreement is governed by the laws of Spain and, where applicable, the laws of the Autonomous Community of Catalonia. Any disputes arising from this Agreement shall be subject to the exclusive jurisdiction of the courts of Barcelona, Spain, without prejudice to the right of data subjects to bring claims before their national supervisory authority.

The applicable supervisory authority for data protection matters is the **Agència Catalana de Protecció de Dades (APDCAT)** for processing activities carried out in Catalonia, and the **Agencia Española de Protección de Datos (AEPD)** for processing activities carried out in Spain more broadly.

---

## 13. Amendments

This Agreement may be amended by the Processor with 30 days' written notice to the Controller. Continued use of the platform after the notice period constitutes acceptance of the amended Agreement. If the Controller does not accept the amendments, it may terminate the service relationship before the amendments take effect.

---

## 14. Contact Information

For data protection enquiries, to exercise data subject rights, or to report a data breach, contact:

**Data Protection Contact:**
AINA | TA — Data Protection
Email: privacy@seba-ai.edu (placeholder — to be updated by the Controller)

**Supervisory Authorities:**
- Agència Catalana de Protecció de Dades (APDCAT): [https://apdcat.gencat.cat](https://apdcat.gencat.cat)
- Agencia Española de Protección de Datos (AEPD): [https://www.aepd.es](https://www.aepd.es)
- European Data Protection Board (EDPB): [https://edpb.europa.eu](https://edpb.europa.eu)

---

## Appendix A: Technical and Organisational Security Measures

The following technical and organisational measures are implemented by the Processor:

### A.1 Pseudonymisation and Encryption

All database contents are encrypted at rest. Data in transit is protected by TLS 1.2+. Student data is processed using teacher-assigned pseudonymous identifiers that cannot be linked to real identities without information held separately by the Controller.

### A.2 Ongoing Confidentiality, Integrity, Availability, and Resilience

The platform is hosted on managed infrastructure with automated backups, health monitoring, and failover capabilities. Access to production systems is restricted to authorised personnel only.

### A.3 Restore Availability and Access

Regular automated backups ensure that personal data can be restored in the event of a physical or technical incident. Recovery time objectives are documented in the platform's operational runbook.

### A.4 Regular Testing and Evaluation

Security measures are reviewed at least annually. Automated TypeScript type-checking and unit testing (Vitest) are run on every code change. Bias detection is tested with adversarial prompts as part of the development process.

### A.5 User Authentication and Access Control

- OAuth 2.0 authentication prevents unauthorised access.
- Role-based access control (RBAC) restricts admin-only functions to users with the `admin` role.
- Session tokens expire and are invalidated on logout.
- All sensitive procedures require authentication (`protectedProcedure`).

---

## Appendix B: Data Flow Diagram (Narrative)

1. **Teacher logs in** via OAuth 2.0 (SEBA identity provider). No password is stored by the Processor.
2. **Teacher creates content** (lesson plans, calendars, materials). Content is stored in the EEA-hosted database.
3. **Teacher initiates AI interaction** (chat with Aina, material generation, assessment). The request is sent to the server, which calls the LLM inference endpoint. No personal data is included in the LLM prompt beyond what the teacher explicitly provides.
4. **AI response is generated** and passed through the bias detection module before being returned to the teacher.
5. **Practice session data** is recorded with pseudonymous student IDs. No student names or identifying information are stored.
6. **AI assessments and learning paths** are generated from aggregated practice scores and stored with the teacher's user ID and a pseudonymous student ID.
7. **Audit events** are logged automatically for all AI decisions, overrides, and bias incidents.
8. **Nightly retention purge** automatically deletes data that has exceeded its retention period.
9. **Data export/deletion** is available to the teacher at any time from the Privacy Dashboard.

---

*This document was prepared in accordance with Article 28(3) GDPR and reflects the data processing practices of AINA | TA as of the effective date stated above. It should be reviewed annually or whenever significant changes are made to the platform's data processing activities.*
