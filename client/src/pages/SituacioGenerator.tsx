import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Check, BookOpen, Target, ClipboardList, Zap, BookMarked, Save, Download, Pencil, X, Upload, School, User, Users, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SebaSymbol } from "@/components/SebaSymbol";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";

const COMPETENCY_META: Record<CompetencyCode, { label: string; color: string }> = {
  CCL:   { label: "CCL",   color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  CP:    { label: "CP",    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  STEM:  { label: "STEM",  color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  CD:    { label: "CD",    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  CPSAA: { label: "CPSAA", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  CC:    { label: "CC",    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  CE:    { label: "CE",    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  CCEC:  { label: "CCEC",  color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
};

type SituacioResult = {
  title: string;
  context: string;
  task: string;
  competencies: { code: string; description: string }[];
  criteria: string[];
  activities: { phase: string; description: string }[];
  lomloeRef: string;
};

/** Inline editable text field — shows text normally, switches to textarea on click */
function EditableField({
  value,
  onChange,
  multiline = true,
  className,
  clickToEditLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
  clickToEditLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    if (multiline) {
      return (
        <Textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          className={cn("bg-white/15 border-white/30 text-white resize-none min-h-[80px] text-sm", className)}
          rows={4}
        />
      );
    }
    return (
      <Input
        ref={ref as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className={cn("bg-white/15 border-white/30 text-white text-sm", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-md px-2 py-1 -mx-2 -my-1 hover:bg-white/10 transition-colors",
        className
      )}
      onClick={() => setEditing(true)}
      title={clickToEditLabel ?? "Click to edit"}
    >
      <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
      <Pencil className="absolute top-1.5 right-1.5 w-3 h-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default function SituacioGenerator() {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();

  // Fetch school logo for print header
  const { data: branding } = trpc.director.getSchoolBranding.useQuery(undefined, {
    retry: false,
  });

  // Pre-fill from URL params (e.g. when navigating from My Situacions Regenerate button)
  const searchParams = new URLSearchParams(window.location.search);
  const initTopic = searchParams.get("topic") ?? "";
  const initSubject = searchParams.get("subject") ?? "";
  const initYearGroup = (searchParams.get("yearGroup") ?? "secondary") as "lower_primary" | "junior" | "primary" | "secondary";
  const initComps = searchParams.get("competencies")
    ? (searchParams.get("competencies")!.split(",").filter(Boolean) as CompetencyCode[])
    : [];

  const [topic, setTopic] = useState(initTopic);
  const [yearGroup, setYearGroup] = useState<"lower_primary" | "junior" | "primary" | "secondary">(initYearGroup);
  const [subject, setSubject] = useState(initSubject);
  const [selectedComps, setSelectedComps] = useState<CompetencyCode[]>(initComps);
  const [result, setResult] = useState<SituacioResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Metadata dialog state
  type MetaAction = "pdf" | "save";
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaAction, setMetaAction] = useState<MetaAction>("pdf");
  const [metaSchoolName, setMetaSchoolName] = useState("");
  const [metaTeacherName, setMetaTeacherName] = useState("");
  const [metaClassGroup, setMetaClassGroup] = useState("");
  const [metaDate, setMetaDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [metaBadgeUrl, setMetaBadgeUrl] = useState<string | null>(null);
  const [metaUseBranding, setMetaUseBranding] = useState(true);
  const badgeInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill metadata from branding when dialog opens
  function openMetaDialog(action: MetaAction) {
    if (!result) return;
    setMetaAction(action);
    setMetaSchoolName((prev) => prev || branding?.schoolName || "");
    setMetaBadgeUrl(branding?.logoUrl ?? null);
    setMetaUseBranding(true);
    setMetaOpen(true);
  }

  function handleBadgeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setMetaBadgeUrl(ev.target?.result as string);
      setMetaUseBranding(false);
    };
    reader.readAsDataURL(file);
  }

  // Clear URL params after reading so a manual refresh doesn't re-apply them
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const generateMutation = trpc.lomloe.generateSituacio.useMutation({
    onSuccess: (data) => {
      setResult(data as SituacioResult);
      setSaved(false);
    },
    onError: () => toast.error(t("situacio_error")),
  });

  const saveMutation = trpc.lomloe.saveSituacio.useMutation({
    onSuccess: () => {
      setSaved(true);
      utils.lomloe.getMySituacions.invalidate();
      toast.success(t("my_situacions_saved"));
    },
    onError: () => toast.error(t("my_situacions_save_error")),
  });

  function toggleComp(code: CompetencyCode) {
    setSelectedComps((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function handleGenerate() {
    if (!topic.trim()) { toast.error(t("situacio_topic")); return; }
    if (!subject.trim()) { toast.error(t("situacio_subject")); return; }
    if (selectedComps.length === 0) { toast.error(t("situacio_competencies")); return; }
    generateMutation.mutate({
      topic: topic.trim(),
      yearGroup,
      subject: subject.trim(),
      competencies: selectedComps,
      language: lang as "ca" | "es" | "en",
    });
  }

  function buildMarkdown(): string {
    if (!result) return "";
    return [
      `# ${result.title}`,
      `\n## ${t("situacio_context_label")}\n${result.context}`,
      `\n## ${t("situacio_task_label")}\n${result.task}`,
      `\n## ${t("situacio_competencies_label")}`,
      ...result.competencies.map((c) => `- **[${c.code}]** ${c.description}`),
      `\n## ${t("situacio_criteria_label")}`,
      ...result.criteria.map((c, i) => `${i + 1}. ${c}`),
      `\n## ${t("situacio_activities_label")}`,
      ...result.activities.map((a) => `**${a.phase}:** ${a.description}`),
      `\n*${result.lomloeRef}*`,
    ].join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildMarkdown()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("situacio_copied"));
    });
  }

  function buildPdfHtml(meta: { schoolName: string; teacherName: string; classGroup: string; date: string; badgeUrl: string | null }) {
    if (!result) return "";
    const logoHtml = meta.badgeUrl
      ? `<img src="${meta.badgeUrl}" alt="School Logo" style="height:60px;object-fit:contain;margin-bottom:8px;" />`
      : "";
    const metaLine = [meta.teacherName, meta.classGroup, meta.date].filter(Boolean).join(" · ");
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${result.title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
  .header-text h1 { font-size: 1.4rem; color: #312e81; margin: 0; }
  .header-text p { font-size: 0.85rem; color: #6b7280; margin: 2px 0 0; }
  h2 { font-size: 1.05rem; color: #4f46e5; margin-top: 1.5rem; border-left: 3px solid #4f46e5; padding-left: 8px; }
  .badge { display: inline-block; background: #e0e7ff; color: #3730a3; border-radius: 9999px; padding: 2px 10px; font-size: 0.75rem; font-weight: 700; margin-right: 6px; }
  .ref { color: #6b7280; font-style: italic; font-size: 0.85rem; margin-top: 1.5rem; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  ol, ul { padding-left: 1.5rem; }
  li { margin-bottom: 4px; }
  .activity { margin-bottom: 12px; }
  .activity-phase { font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; color: #6d28d9; }
  .powered { text-align: right; font-size: 0.7rem; color: #9ca3af; margin-top: 20px; }
  .page-break { page-break-before: always; break-before: page; margin-top: 0; padding-top: 1.5rem; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<div class="header">
  ${logoHtml}
  <div class="header-text">
    <h1>${result.title}</h1>
    ${meta.schoolName ? `<p style="font-weight:600;color:#374151;">${meta.schoolName}</p>` : ""}
    ${metaLine ? `<p>${metaLine}</p>` : ""}
  </div>
</div>
<h2>${t("situacio_context_label")}</h2>
<p>${result.context}</p>
<h2>${t("situacio_task_label")}</h2>
<p>${result.task}</p>
<h2>${t("situacio_competencies_label")}</h2>
<ul>
${result.competencies.map(c => `<li><span class="badge">${c.code}</span> ${c.description}</li>`).join("\n")}
</ul>
<h2 class="page-break">${t("situacio_activities_label")}</h2>
${result.activities.map(a => `<div class="activity"><p class="activity-phase">${a.phase}</p><p>${a.description}</p></div>`).join("\n")}
<h2 class="page-break">${t("situacio_criteria_label")}</h2>
<ol>
${result.criteria.map(c => `<li>${c}</li>`).join("\n")}
</ol>
<p class="ref">${result.lomloeRef}</p>
<p class="powered">Powered by SEBA</p>
</body>
</html>`;
  }

  function handleDownloadPdf() {
    openMetaDialog("pdf");
  }

  function confirmMeta() {
    if (!result) return;
    const meta = {
      schoolName: metaSchoolName,
      teacherName: metaTeacherName,
      classGroup: metaClassGroup,
      date: metaDate,
      badgeUrl: metaUseBranding ? (branding?.logoUrl ?? null) : metaBadgeUrl,
    };
    setMetaOpen(false);
    if (metaAction === "pdf") {
      const html = buildPdfHtml(meta);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.onload = () => {
          win.print();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        };
      }
    } else {
      saveMutation.mutate({
        title: result.title,
        topic,
        subject,
        yearGroup,
        competencies: selectedComps,
        resultJson: JSON.stringify({ ...result, _meta: meta }),
      });
    }
  }

  // Helpers to update individual fields in result
  function updateResult(patch: Partial<SituacioResult>) {
    if (!result) return;
    setResult({ ...result, ...patch });
    setSaved(false);
  }

  function updateActivity(index: number, field: "phase" | "description", value: string) {
    if (!result) return;
    const activities = result.activities.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    updateResult({ activities });
  }

  function updateCriterion(index: number, value: string) {
    if (!result) return;
    const criteria = result.criteria.map((c, i) => (i === index ? value : c));
    updateResult({ criteria });
  }

  function updateCompetencyDesc(index: number, value: string) {
    if (!result) return;
    const competencies = result.competencies.map((c, i) =>
      i === index ? { ...c, description: value } : c
    );
    updateResult({ competencies });
  }

  return (
    <div className="chat-bg min-h-screen flex flex-col">
      <NavBar />
      <div className="container py-6 max-w-5xl mx-auto w-full flex-1 space-y-6">
        {/* Header */}
        <BackButton label={t("btn_back")} variant="dark" />
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-white/15 mt-0.5">
            <SebaSymbol className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t("situacio_title")}</h1>
            <p className="text-sm text-white/70">{t("situacio_desc")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Form */}
          <Card className="lg:col-span-2 bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white/80 text-sm">{t("situacio_topic")} *</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("situacio_topic_placeholder")}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/80 text-sm">{t("situacio_subject")} *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("situacio_subject_placeholder")}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/80 text-sm">{t("situacio_year_group")}</Label>
                <Select value={yearGroup} onValueChange={(v) => setYearGroup(v as typeof yearGroup)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white focus:ring-white/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lower_primary">Primary (Yr 1–2)</SelectItem>
                    <SelectItem value="junior">Junior (Yr 3–4)</SelectItem>
                    <SelectItem value="primary">Primary (Yr 5–6)</SelectItem>
                    <SelectItem value="secondary">Secondary (Yr 7–10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">{t("situacio_competencies")} *</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(COMPETENCY_META) as CompetencyCode[]).map((code) => (
                    <button
                      key={code}
                      onClick={() => toggleComp(code)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                        selectedComps.includes(code)
                          ? "bg-white text-primary border-white"
                          : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20"
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
                {selectedComps.length > 0 && (
                  <p className="text-white/50 text-xs">{selectedComps.length} selected</p>
                )}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full gap-2 bg-white text-primary hover:bg-white/90"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("situacio_generating")}
                  </>
                ) : (
                  <>
                    <SebaSymbol className="w-4 h-4" />
                    {t("situacio_generate")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          <div className="lg:col-span-3 space-y-4">
            {!result && !generateMutation.isPending && (
              <Card className="bg-white/10 backdrop-blur-md border-white/20 flex items-center justify-center py-16">
                <div className="text-center space-y-3">
                  <SebaSymbol className="w-10 h-10 text-white/30 mx-auto" />
                  <p className="text-white/50 text-sm max-w-xs">{t("situacio_empty")}</p>
                </div>
              </Card>
            )}

            {generateMutation.isPending && (
              <Card className="bg-white/10 backdrop-blur-md border-white/20 flex items-center justify-center py-16">
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-white/60 mx-auto animate-spin" />
                  <p className="text-white/60 text-sm">{t("situacio_generating")}</p>
                </div>
              </Card>
            )}

            {result && !generateMutation.isPending && (
              <>
                {/* Title + action buttons */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/50 uppercase tracking-wide mb-1">{t("situacio_result_title")}</p>
                    <EditableField
                      value={result.title}
                      onChange={(v) => updateResult({ title: v })}
                      multiline={false}
                      className="text-xl font-bold"
                      clickToEditLabel={t("situacio_click_to_edit")}
                    />
                    <EditableField
                      value={result.lomloeRef}
                      onChange={(v) => updateResult({ lomloeRef: v })}
                      multiline={false}
                      className="text-xs text-white/40 italic mt-1"
                      clickToEditLabel={t("situacio_click_to_edit")}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? t("situacio_copied") : t("situacio_copy")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMetaDialog("save")}
                      disabled={saveMutation.isPending || saved}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5"
                    >
                      {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {saved ? t("sa_saved") : t("sa_save")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadPdf}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t("sa_download_pdf")}
                    </Button>
                  </div>
                </div>

                {/* Edit hint */}
                <p className="text-white/40 text-xs flex items-center gap-1">
                  <Pencil className="w-3 h-3" />
                  {t("sa_edit_hint")}
                </p>

                {/* Context */}
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-300" />
                      {t("situacio_context_label")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EditableField value={result.context} onChange={(v) => updateResult({ context: v })} clickToEditLabel={t("situacio_click_to_edit")} />
                  </CardContent>
                </Card>

                {/* Task */}
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-300" />
                      {t("situacio_task_label")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EditableField value={result.task} onChange={(v) => updateResult({ task: v })} clickToEditLabel={t("situacio_click_to_edit")} />
                  </CardContent>
                </Card>

                {/* Competencies */}
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-300" />
                      {t("situacio_competencies_label")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.competencies.map((c, i) => (
                      <div key={c.code} className="flex items-start gap-2">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 mt-0.5",
                          COMPETENCY_META[c.code as CompetencyCode]?.color ?? "bg-gray-100 text-gray-800"
                        )}>
                          {c.code}
                        </span>
                        <EditableField
                          value={c.description}
                          onChange={(v) => updateCompetencyDesc(i, v)}
                          multiline={false}
                          className="flex-1"
                          clickToEditLabel={t("situacio_click_to_edit")}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Activities */}
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <BookMarked className="w-4 h-4 text-purple-300" />
                      {t("situacio_activities_label")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.activities.map((a, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-white/15 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <EditableField
                            value={a.phase}
                            onChange={(v) => updateActivity(i, "phase", v)}
                            multiline={false}
                            className="text-xs font-semibold uppercase tracking-wide"
                            clickToEditLabel={t("situacio_click_to_edit")}
                          />
                          <EditableField
                            value={a.description}
                            onChange={(v) => updateActivity(i, "description", v)}
                            clickToEditLabel={t("situacio_click_to_edit")}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Criteria */}
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-orange-300" />
                      {t("situacio_criteria_label")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2 list-none">
                      {result.criteria.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-white/50 text-sm font-mono mt-1 flex-shrink-0">{i + 1}.</span>
                          <EditableField
                            value={c}
                            onChange={(v) => updateCriterion(i, v)}
                            multiline={false}
                            className="flex-1"
                            clickToEditLabel={t("situacio_click_to_edit")}
                          />
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metadata dialog */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="w-5 h-5 text-primary" />
              {t("sa_meta_dialog_title")}
            </DialogTitle>
            <DialogDescription>{t("sa_meta_dialog_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* School badge */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <School className="w-3.5 h-3.5" />
                {t("sa_meta_school_badge")}
              </Label>
              <div className="flex items-center gap-3">
                {(metaUseBranding ? branding?.logoUrl : metaBadgeUrl) ? (
                  <img
                    src={(metaUseBranding ? branding?.logoUrl : metaBadgeUrl) ?? undefined}
                    alt="badge"
                    className="h-12 w-12 object-contain rounded border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                    <School className="w-5 h-5" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  {branding?.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setMetaUseBranding(true)}
                      className={cn(
                        "text-xs px-2 py-1 rounded border transition-colors",
                        metaUseBranding
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      {t("sa_meta_school_badge_use_existing")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => badgeInputRef.current?.click()}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    {t("sa_meta_school_badge_upload")}
                  </button>
                  <input
                    ref={badgeInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBadgeUpload}
                  />
                </div>
              </div>
            </div>

            {/* School name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <School className="w-3.5 h-3.5" />
                {t("sa_meta_school_name")}
              </Label>
              <Input
                value={metaSchoolName}
                onChange={(e) => setMetaSchoolName(e.target.value)}
                placeholder={t("sa_meta_school_name_placeholder")}
              />
            </div>

            {/* Teacher name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {t("sa_meta_teacher_name")}
              </Label>
              <Input
                value={metaTeacherName}
                onChange={(e) => setMetaTeacherName(e.target.value)}
                placeholder={t("sa_meta_teacher_name_placeholder")}
              />
            </div>

            {/* Class / Group */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {t("sa_meta_class_group")}
              </Label>
              <Input
                value={metaClassGroup}
                onChange={(e) => setMetaClassGroup(e.target.value)}
                placeholder={t("sa_meta_class_group_placeholder")}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {t("sa_meta_date")}
              </Label>
              <Input
                type="date"
                value={metaDate}
                onChange={(e) => setMetaDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMetaOpen(false)}>
              {t("sa_meta_cancel")}
            </Button>
            <Button onClick={confirmMeta} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : metaAction === "pdf" ? (
                <Download className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {metaAction === "pdf" ? t("sa_meta_confirm_pdf") : t("sa_meta_confirm_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
