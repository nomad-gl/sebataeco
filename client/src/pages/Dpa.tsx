/**
 * Dpa.tsx — Public-facing Data Processing Agreement page.
 *
 * Accessible at /dpa without authentication.
 * Renders the full DPA content inline so users can read it in the browser.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
  FileText,
  Clock,
  Globe,
  Users,
  Lock,
  Scale,
  AlertTriangle,
  Mail,
} from "lucide-react";
import Footer from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-xl font-bold text-foreground border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

// ─── Table component ──────────────────────────────────────────────────────────
function DpaTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 text-left font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-muted-foreground align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dpa() {
  const { t } = useI18n();
  useDocumentTitle("Acord de Protecció de Dades · SEBA AI");


  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("dpa_page_title")}</span>
          </div>
          <Badge variant="outline" className="text-xs font-mono">v1.0</Badge>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3 pb-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-2">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Data Processing Agreement</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            AINA | TA — Educational Platform
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Effective: 8 April 2026</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Review: 8 April 2027</span>
            <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Governed by Spanish / Catalan law</span>
          </div>
        </div>

        <Separator />

        {/* Parties */}
        <Section id="parties" title="Parties">
          <p className="text-muted-foreground leading-relaxed">
            This Data Processing Agreement ("Agreement") is entered into between:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-500" /> Data Controller
              </p>
              <p className="text-sm text-muted-foreground">
                The educational institution or individual teacher ("Controller") accessing AINA | TA through the platform or any associated domain.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-green-500" /> Data Processor
              </p>
              <p className="text-sm text-muted-foreground">
                The operator of AINA | TA ("Processor"), acting on behalf of the Controller to process personal data as described in this Agreement.
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This Agreement forms part of the Terms of Service and is incorporated by reference. It governs all processing of personal data carried out by the Processor on behalf of the Controller in connection with the AINA | TA platform.
          </p>
        </Section>

        {/* 1. Definitions */}
        <Section id="definitions" title="1. Definitions">
          <DpaTable
            headers={["Term", "Definition"]}
            rows={[
              ["GDPR", "Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016"],
              ["EU AI Act", "Regulation (EU) 2024/1689 of the European Parliament and of the Council of 13 June 2024"],
              ["LOMLOE", "Ley Orgánica 3/2020 de 29 de diciembre, by which the Spanish Organic Law on Education is modified"],
              ["Personal Data", "Any information relating to an identified or identifiable natural person as defined in Article 4(1) GDPR"],
              ["Processing", "Any operation performed on personal data, as defined in Article 4(2) GDPR"],
              ["Special Category Data", "Personal data revealing racial or ethnic origin, political opinions, religious beliefs, health data, or biometric data, as defined in Article 9 GDPR"],
              ["EEA", "European Economic Area, comprising the EU Member States plus Iceland, Liechtenstein, and Norway"],
              ["Catalan Public Cloud", "Núvol Públic de Catalunya, the sovereign cloud infrastructure operated under the authority of the Generalitat de Catalunya"],
              ["Sub-processor", "Any third party engaged by the Processor to carry out processing activities on behalf of the Controller"],
              ["Aina", "The AI assistant integrated into AINA | TA, powered by large language models and the BSC Salamandra framework"],
            ]}
          />
        </Section>

        {/* 2. Subject Matter */}
        <Section id="subject-matter" title="2. Subject Matter and Duration">
          <p className="text-muted-foreground leading-relaxed">
            The Processor provides an AI-powered educational platform ("AINA | TA") that enables teachers to conduct AI-assisted chat sessions, generate teaching materials and lesson plans, administer practice assessments aligned with LOMLOE competency frameworks, receive AI-generated student progress assessments, and manage class groups.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            This Agreement remains in force for as long as the Processor processes personal data on behalf of the Controller. Upon termination, the Processor shall delete or return all personal data within 30 days, unless applicable law requires longer retention.
          </p>
        </Section>

        {/* 3. Nature and Purpose */}
        <Section id="purpose" title="3. Nature and Purpose of Processing">
          <p className="text-muted-foreground leading-relaxed">
            All processing is carried out exclusively for the following purposes: providing core educational platform functionality; generating AI-assisted educational content and recommendations; maintaining audit trails of AI decisions to satisfy EU AI Act and GDPR obligations; detecting and logging AI bias incidents; enabling teacher oversight and override of AI decisions; providing data export and deletion capabilities; and complying with applicable legal obligations.
          </p>
        </Section>

        {/* 4. Categories of Data */}
        <Section id="data-categories" title="4. Categories of Data Subjects and Personal Data">
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/30 dark:bg-amber-900/10 p-4 flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Important:</strong> AINA | TA does not directly collect personal data from students. Student data is entered by teachers using pseudonymous identifiers. The platform does not collect student names, dates of birth, or other directly identifying information.
            </p>
          </div>
          <DpaTable
            headers={["Category", "Examples", "Legal Basis"]}
            rows={[
              ["Account data", "Name, email address, OAuth identifier", "Art. 6(1)(b) GDPR — performance of contract"],
              ["Usage data", "Login timestamps, page views, feature interactions", "Art. 6(1)(f) GDPR — legitimate interests"],
              ["Educational content", "Lesson plans, teaching materials, school calendars", "Art. 6(1)(b) GDPR — performance of contract"],
              ["Practice session data", "Question responses, scores, timestamps (pseudonymous IDs only)", "Art. 6(1)(b) GDPR — performance of contract"],
              ["AI interaction data", "Chat messages sent to Aina, AI-generated responses", "Art. 6(1)(b) GDPR — performance of contract"],
              ["AI assessment records", "Competency scores, AI summaries, teacher overrides", "Art. 6(1)(b) GDPR — performance of contract"],
              ["Bias incident logs", "Truncated input/output text (max 200 chars), severity, resolution status", "Art. 6(1)(c) GDPR — legal obligation (EU AI Act Art. 12)"],
              ["Audit trail records", "Event type, timestamp, user ID, action summary", "Art. 6(1)(c) GDPR — legal obligation (EU AI Act Art. 12)"],
            ]}
          />
        </Section>

        {/* 5. Processor Obligations */}
        <Section id="processor-obligations" title="5. Obligations of the Processor">
          <div className="space-y-4">
            {[
              { title: "5.1 Instruction Compliance", body: "Process personal data only on documented instructions from the Controller, unless required by applicable law. The Processor shall immediately inform the Controller if an instruction infringes GDPR." },
              { title: "5.2 Confidentiality", body: "Ensure that persons authorised to process personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality." },
              { title: "5.3 Security Measures", body: "Implement and maintain appropriate technical and organisational measures including: TLS 1.2+ encryption in transit, AES-256 encryption at rest, role-based access control, OAuth 2.0 authentication, PII minimisation (bias logs truncated to 200 characters), pseudonymisation of student data, and comprehensive audit logging." },
              { title: "5.4 Sub-processor Management", body: "Not engage a new sub-processor without prior written authorisation from the Controller. The same data protection obligations shall be imposed on all sub-processors by contract." },
              { title: "5.5 Data Subject Rights", body: "Assist the Controller in fulfilling GDPR rights (Articles 15–22). The platform provides: data export (Privacy Dashboard), right to erasure (Delete All My Data), data portability (JSON format), and the right to object to automated decision-making (teachers can override any AI decision)." },
              { title: "5.6 Data Breach Notification", body: "Notify the Controller within 72 hours of becoming aware of a personal data breach, providing sufficient information to allow the Controller to meet its own notification obligations under Article 33 GDPR." },
              { title: "5.7 Deletion and Return", body: "At the choice of the Controller, delete or return all personal data upon termination of the service, and delete existing copies unless applicable law requires storage." },
              { title: "5.8 Audit Cooperation", body: "Make available all information necessary to demonstrate compliance with Article 28 GDPR, and allow for audits and inspections conducted by the Controller or an auditor mandated by the Controller." },
            ].map((item) => (
              <div key={item.title} className="space-y-1">
                <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. Retention */}
        <Section id="retention" title="6. Data Retention Schedule">
          <DpaTable
            headers={["Data Category", "Retention Period", "Deletion Mechanism"]}
            rows={[
              ["Practice session records", "Rolling cap of 200 most recent sessions per user", "Automated nightly purge (cron job)"],
              ["AI chat messages", "90 days from last activity", "Automated nightly purge"],
              ["Aina behavioural profile", "Reset after 90 days of inactivity", "Automated nightly purge"],
              ["Bias incident logs (resolved)", "30 days after resolution", "Automated nightly purge"],
              ["Read notifications", "30 days after reading", "Automated nightly purge"],
              ["Audit log records", "24 months from creation", "Automated nightly purge (03:30 UTC)"],
              ["AI assessment records", "Retained until user deletion request", "User-initiated via Privacy Dashboard"],
              ["Learning path records", "Retained until user deletion request", "User-initiated via Privacy Dashboard"],
              ["Grade override audit trail", "Minimum 5 years (legal obligation)", "Manual deletion by administrator only"],
              ["Account data", "Retained until account deletion", "User-initiated via Privacy Dashboard"],
            ]}
          />
        </Section>

        {/* 7. International Transfers */}
        <Section id="transfers" title="7. International Data Transfers">
          <div className="rounded-lg border border-green-200/60 bg-green-50/30 dark:bg-green-900/10 p-4 flex gap-3">
            <Globe className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              All personal data processed by AINA | TA is stored and processed exclusively within the <strong className="text-foreground">European Economic Area (EEA)</strong>. Primary infrastructure runs on the SEBA Platform (EEA data centres). Where technically feasible, data is hosted on the <strong className="text-foreground">Núvol Públic de Catalunya</strong> (Catalan Public Cloud), in accordance with Catalan data sovereignty principles.
            </p>
          </div>
          {/* Infrastructure breakdown */}
          <div className="rounded-md border border-border/50 divide-y divide-border/40 text-sm">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="font-semibold text-foreground shrink-0 w-32">Primary</span>
              <span className="text-muted-foreground">SEBA Platform — EEA data centres (production database &amp; authentication)</span>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="font-semibold text-foreground shrink-0 w-32">Target</span>
              <span className="text-muted-foreground"><strong className="text-foreground">Nuvulus Public Cloud</strong> — 3 interconnected data centres entirely within Catalonia, operated by Sercom under Spanish/EU jurisdiction. Aligned with the <a href="https://web.gencat.cat/en/ciutadania/actualitat/noticies/2025/11/1000-milions-en-lEstrategia-IA" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Generalitat de Catalunya AI 2030 Strategy</a> for sovereign digital infrastructure.</span>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="font-semibold text-foreground shrink-0 w-32">AI Inference</span>
              <span className="text-muted-foreground">BSC Salamandra 2 &amp; Àguila via Hugging Face Inference API — EEA data centres. Only non-personal data (question text, curriculum content) is transmitted. No student identifiers or personal data are included in API requests.</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Processor commits to prioritising EEA-sovereign hosting providers and to migrating to the Catalan Public Cloud infrastructure as it becomes available for production educational workloads.
          </p>
        </Section>

        {/* 8. Sub-processors */}
        <Section id="sub-processors" title="8. Sub-processors">
          <DpaTable
            headers={["Sub-processor", "Role", "Location", "Transfer Safeguard"]}
            rows={[
              ["SEBA Platform", "Infrastructure hosting, OAuth authentication, database services", "EEA", "EEA-based processing"],
              ["Hugging Face", "Neural machine translation for question bank localisation", "EEA (EU data centres)", "EEA-based; no personal data transmitted"],
              ["BSC (Barcelona Supercomputing Center)", "Salamandra LLM framework; model weights", "Spain (EEA)", "EEA-based processing"],
              ["ip-api.com", "IP geolocation for Catalan dialect detection", "EEA", "Only IP address transmitted; not linked to user accounts"],
            ]}
          />
          <p className="text-sm text-muted-foreground">
            The Processor shall notify the Controller of any intended changes concerning the addition or replacement of sub-processors, giving the Controller the opportunity to object to such changes.
          </p>
        </Section>

        {/* 9. EU AI Act */}
        <Section id="eu-ai-act" title="9. EU AI Act Compliance">
          <p className="text-sm text-muted-foreground leading-relaxed">
            AINA | TA is classified as a <strong className="text-foreground">high-risk AI system</strong> under Annex III of the EU AI Act (educational and vocational training AI systems). The following measures are implemented:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { art: "Art. 9 — Risk Management", desc: "A risk management system is maintained throughout the AI system lifecycle. Known risks and mitigations are documented in the EU AI Act Technical File." },
              { art: "Art. 10 — Data Governance", desc: "Only curriculum-aligned question banks and teacher-provided content are used for AI operations. No student demographic data is used in AI model inputs." },
              { art: "Art. 11 — Technical Documentation", desc: "Full technical documentation covers system architecture, AI model descriptions, training data provenance, and performance metrics." },
              { art: "Art. 13 — Transparency", desc: "Plain-language descriptions of all AI decision-making processes are available from the Audit Dashboard under the Algorithm Description tab." },
              { art: "Art. 14 — Human Oversight", desc: "All AI-generated grades, assessments, and learning path recommendations can be reviewed and overridden by teachers. No AI decision is final." },
              { art: "Art. 12 — Logging", desc: "Automatic logging of AI decisions, human overrides, and bias incidents. Logs are accessible to administrators and retained for a minimum of 5 years for grade override records." },
            ].map((item) => (
              <div key={item.art} className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground">{item.art}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 10. Controller Obligations */}
        <Section id="controller-obligations" title="10. Obligations of the Controller">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside leading-relaxed">
            <li>Ensure a lawful basis for processing personal data before instructing the Processor.</li>
            <li>Ensure that data subjects have been provided with the information required by Articles 13 and 14 GDPR.</li>
            <li>Ensure that student data uses pseudonymous identifiers and does not include unnecessary personal information.</li>
            <li>Not instruct the Processor to process special category data unless a specific legal basis under Article 9 GDPR applies.</li>
            <li>Promptly notify the Processor of any data subject requests received directly by the Controller.</li>
            <li>Ensure that any person accessing the platform is bound by appropriate confidentiality obligations.</li>
          </ul>
        </Section>

        {/* 11. Liability */}
        <Section id="liability" title="11. Liability and Indemnification">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Each party shall be liable for damages caused by processing that infringes GDPR in accordance with Article 82 GDPR. Where both parties are responsible for damage, each party shall be held liable for the entire damage to ensure effective compensation of the data subject. A party shall be exempt from liability if it proves it is not in any way responsible for the event giving rise to the damage.
          </p>
        </Section>

        {/* 12. Governing Law */}
        <Section id="governing-law" title="12. Governing Law and Jurisdiction">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This Agreement is governed by the laws of Spain and, where applicable, the laws of the Autonomous Community of Catalonia. Any disputes shall be subject to the exclusive jurisdiction of the courts of Barcelona, Spain, without prejudice to the right of data subjects to bring claims before their national supervisory authority.
          </p>
          <p className="text-sm text-muted-foreground">
            Applicable supervisory authorities: <strong className="text-foreground">APDCAT</strong> (Catalonia) and <strong className="text-foreground">AEPD</strong> (Spain).
          </p>
        </Section>

        {/* 13. Amendments */}
        <Section id="amendments" title="13. Amendments">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This Agreement may be amended by the Processor with 30 days' written notice to the Controller. Continued use of the platform after the notice period constitutes acceptance of the amended Agreement.
          </p>
        </Section>

        {/* 14. Contact */}
        <Section id="contact" title="14. Contact Information">
          <div className="rounded-lg border p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Data Protection Contact</p>
                <p className="text-sm text-muted-foreground">AINA | TA — Data Protection</p>
                <p className="text-sm text-muted-foreground">privacy@seba-ai.edu (placeholder — to be updated by the Controller)</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5"><Scale className="h-4 w-4 text-primary" /> Supervisory Authorities</p>
              <div className="flex flex-col gap-2">
                {[
                  { name: "Agència Catalana de Protecció de Dades (APDCAT)", url: "https://apdcat.gencat.cat" },
                  { name: "Agencia Española de Protección de Datos (AEPD)", url: "https://www.aepd.es" },
                  { name: "European Data Protection Board (EDPB)", url: "https://edpb.europa.eu" },
                ].map((a) => (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {a.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Appendix A */}
        <Section id="appendix-a" title="Appendix A: Technical and Organisational Security Measures">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">A.1 Pseudonymisation and Encryption:</strong> All database contents are encrypted at rest (AES-256). Data in transit is protected by TLS 1.2+. Student data is processed using teacher-assigned pseudonymous identifiers that cannot be linked to real identities without information held separately by the Controller.</p>
            <p><strong className="text-foreground">A.2 Confidentiality, Integrity, Availability, and Resilience:</strong> The platform is hosted on managed infrastructure with automated backups, health monitoring, and failover capabilities. Access to production systems is restricted to authorised personnel only.</p>
            <p><strong className="text-foreground">A.3 Restore Availability and Access:</strong> Regular automated backups ensure that personal data can be restored in the event of a physical or technical incident.</p>
            <p><strong className="text-foreground">A.4 Regular Testing and Evaluation:</strong> Security measures are reviewed at least annually. Automated TypeScript type-checking and unit testing (Vitest) are run on every code change. Bias detection is tested with adversarial prompts as part of the development process.</p>
            <p><strong className="text-foreground">A.5 User Authentication and Access Control:</strong> OAuth 2.0 authentication prevents unauthorised access. Role-based access control (RBAC) restricts admin-only functions. Session tokens expire and are invalidated on logout. All sensitive procedures require authentication.</p>
          </div>
        </Section>

        {/* Appendix B */}
        <Section id="appendix-b" title="Appendix B: Data Flow Diagram (Narrative)">
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside leading-relaxed">
            <li><strong className="text-foreground">Teacher logs in</strong> via OAuth 2.0 (SEBA Platform identity provider). No password is stored by the Processor.</li>
            <li><strong className="text-foreground">Teacher creates content</strong> (lesson plans, calendars, materials). Content is stored in the EEA-hosted database.</li>
            <li><strong className="text-foreground">Teacher initiates AI interaction</strong> (chat with Aina, material generation, assessment). The request is sent to the server, which calls the LLM inference endpoint. No personal data is included in the LLM prompt beyond what the teacher explicitly provides.</li>
            <li><strong className="text-foreground">AI response is generated</strong> and passed through the bias detection module before being returned to the teacher.</li>
            <li><strong className="text-foreground">Practice session data</strong> is recorded with pseudonymous student IDs. No student names or identifying information are stored.</li>
            <li><strong className="text-foreground">AI assessments and learning paths</strong> are generated from aggregated practice scores and stored with the teacher's user ID and a pseudonymous student ID.</li>
            <li><strong className="text-foreground">Audit events</strong> are logged automatically for all AI decisions, overrides, and bias incidents.</li>
            <li><strong className="text-foreground">Nightly retention purge</strong> automatically deletes data that has exceeded its retention period.</li>
            <li><strong className="text-foreground">Data export/deletion</strong> is available to the teacher at any time from the Privacy Dashboard.</li>
          </ol>
        </Section>

        <Separator />

        <p className="text-xs text-muted-foreground text-center pb-4">
          This document was prepared in accordance with Article 28(3) GDPR and reflects the data processing practices of AINA | TA as of 8 April 2026. It should be reviewed annually or whenever significant changes are made to the platform's data processing activities.
        </p>
      </main>

      <Footer />
    </div>
  );
}
