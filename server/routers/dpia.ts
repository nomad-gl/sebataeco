/**
 * DPIA (Data Protection Impact Assessment) router — MED-03 security fix
 *
 * Provides read access to the DPIA documentation for admin users.
 * The DPIA covers all personal data processing activities in SEBA AI Studio.
 *
 * Procedures:
 *   dpia.get — Returns the full DPIA record (admin only)
 */
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";

// ─── Static DPIA record ────────────────────────────────────────────────────────
// In a production system this would be stored in the database and editable.
// For the initial MED-03 fix, a structured static record is sufficient.

const DPIA_RECORD = {
  version: "1.0",
  lastReviewed: "2026-04-30",
  nextReviewDue: "2027-04-30",
  dataController: {
    name: "SEBA AI Studio",
    contact: "privacy@sebataeco.com",
    dpo: "Data Protection Officer — privacy@sebataeco.com",
  },
  legalBasis: "Article 6(1)(b) GDPR — performance of a contract (educational services); Article 6(1)(c) — legal obligation (LOMLOE compliance); Article 9(2)(g) — substantial public interest (education).",
  dataSubjects: [
    { category: "Teachers", description: "Name, email, role, schedule, attendance, professional notes, holiday records" },
    { category: "Students", description: "Name, year group, competency progress, assessment results, individual learning plan context" },
    { category: "Directors / HoS", description: "Name, email, role, school management data, staff oversight records" },
    { category: "Parents / Guardians", description: "Email (for plan sharing only); no persistent profile stored" },
  ],
  processingActivities: [
    {
      id: "PA-01",
      name: "User Authentication",
      purpose: "Verify identity and control access to the platform",
      dataCategories: ["Email address", "Hashed password", "OAuth tokens", "Session identifiers"],
      retention: "Session tokens: 8 hours. Account data: until account deletion.",
      thirdParties: ["Manus OAuth (identity provider)"],
      risks: "Credential theft",
      mitigations: "bcrypt password hashing, HTTPS-only, 8-hour session expiry, MFA available for privileged roles",
    },
    {
      id: "PA-02",
      name: "AI-Assisted Content Generation",
      purpose: "Generate educational materials, quizzes, lesson plans, and ILPs using LLM",
      dataCategories: ["Student context (anonymised where possible)", "Learning goals", "Competency codes"],
      retention: "Generated content: retained until teacher deletes the plan.",
      thirdParties: ["Manus Built-in LLM API (processed server-side; no data retained by provider per DPA)"],
      risks: "Inadvertent inclusion of personal data in LLM prompts",
      mitigations: "Teachers are advised not to include full student names or sensitive medical data in prompts. Sensitive fields encrypted at rest (AES-256-GCM).",
    },
    {
      id: "PA-03",
      name: "Individual Learning Plans (ILP)",
      purpose: "Support differentiated instruction for students with specific learning needs",
      dataCategories: ["Student name (optional)", "Year group", "Student context / differentiation notes", "AI-generated plan content"],
      retention: "Until teacher deletes the plan or account is closed.",
      thirdParties: ["Manus LLM API for generation"],
      risks: "Exposure of sensitive educational data",
      mitigations: "Field-level AES-256-GCM encryption for studentContext, learningGoals, planContent. Access restricted to the creating teacher.",
    },
    {
      id: "PA-04",
      name: "Teacher Attendance and Holiday Records",
      purpose: "Track teacher attendance, holiday entitlement, and cover requirements",
      dataCategories: ["Teacher name", "Dates", "Hours", "Notes"],
      retention: "Academic year + 1 year for audit purposes.",
      thirdParties: ["None"],
      risks: "Exposure of HR-sensitive data",
      mitigations: "Notes field encrypted at rest (AES-256-GCM). Access restricted to director/HoS.",
    },
    {
      id: "PA-05",
      name: "Forum and Messaging",
      purpose: "Enable professional communication between teachers and staff",
      dataCategories: ["User name", "Message content", "Timestamps"],
      retention: "Messages retained for 12 months, then automatically purged.",
      thirdParties: ["None"],
      risks: "Exposure of private communications",
      mitigations: "Access restricted to authenticated users. Direct messages visible only to sender and recipient.",
    },
    {
      id: "PA-06",
      name: "Audit Logging",
      purpose: "Maintain accountability and detect security incidents",
      dataCategories: ["User ID", "Action type", "Timestamp", "IP address (hashed)"],
      retention: "90 days rolling window.",
      thirdParties: ["None"],
      risks: "Audit log tampering",
      mitigations: "Append-only log table. Admin-only read access.",
    },
  ],
  riskAssessment: [
    {
      risk: "Unauthorised access to student personal data",
      likelihood: "Low",
      impact: "High",
      residualRisk: "Low",
      controls: "Role-based access control, session expiry, MFA for privileged roles, field-level encryption",
    },
    {
      risk: "Data breach via compromised credentials",
      likelihood: "Medium",
      impact: "High",
      residualRisk: "Low",
      controls: "bcrypt hashing, 8-hour sessions, MFA, account lockout after failed attempts",
    },
    {
      risk: "LLM provider data retention",
      likelihood: "Low",
      impact: "Medium",
      residualRisk: "Low",
      controls: "DPA with Manus LLM provider; no training on customer data; prompts processed transiently",
    },
    {
      risk: "Insider threat — privileged user misuse",
      likelihood: "Low",
      impact: "High",
      residualRisk: "Low",
      controls: "Audit logging, role separation, director/HoS cannot access other schools' data (tenant isolation)",
    },
  ],
  subjectRights: "Data subjects may exercise their rights (access, rectification, erasure, portability, objection) by contacting privacy@sebataeco.com. Requests are processed within 30 days per GDPR Article 12.",
  transfersOutsideEEA: "None. All data is processed within the EEA. The Manus LLM API is hosted within the EU.",
  dpiaConclusion: "The processing activities described above are necessary and proportionate to the educational purposes of SEBA AI Studio. The identified risks are mitigated to an acceptable level through the technical and organisational measures described. No prior consultation with the supervisory authority is required under Article 36 GDPR.",
};

export const dpiaRouter = router({
  /**
   * Returns the full DPIA record.
   * Access restricted to admin users only.
   */
  get: protectedProcedure.query(({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "DPIA access is restricted to administrators.",
      });
    }
    return DPIA_RECORD;
  }),
});
