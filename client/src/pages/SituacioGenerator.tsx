import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Copy, Check, BookOpen, Target, ClipboardList, Zap, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export default function SituacioGenerator() {
  const { t, lang } = useI18n();

  const [topic, setTopic] = useState("");
  const [yearGroup, setYearGroup] = useState<"junior" | "primary" | "secondary">("secondary");
  const [subject, setSubject] = useState("");
  const [selectedComps, setSelectedComps] = useState<CompetencyCode[]>([]);
  const [result, setResult] = useState<SituacioResult | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = trpc.lomloe.generateSituacio.useMutation({
    onSuccess: (data) => {
      setResult(data as SituacioResult);
    },
    onError: () => {
      toast.error(t("situacio_error"));
    },
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

  function handleCopy() {
    if (!result) return;
    const text = [
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
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("situacio_copied"));
    });
  }

  return (
    <div className="chat-bg min-h-screen flex flex-col">
      <NavBar />
      <div className="container py-6 max-w-5xl mx-auto w-full flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-white/15 mt-0.5">
            <Sparkles className="w-6 h-6 text-white" />
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
                    <Sparkles className="w-4 h-4" />
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
                  <Sparkles className="w-10 h-10 text-white/30 mx-auto" />
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
                {/* Title + copy */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wide mb-1">{t("situacio_result_title")}</p>
                    <h2 className="text-xl font-bold text-white">{result.title}</h2>
                    <p className="text-xs text-white/40 mt-1 italic">{result.lomloeRef}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 flex-shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t("situacio_copied") : t("situacio_copy")}
                  </Button>
                </div>

                {/* Context */}
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-300" />
                      {t("situacio_context_label")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/80 text-sm leading-relaxed">{result.context}</p>
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
                    <p className="text-white/80 text-sm leading-relaxed">{result.task}</p>
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
                    {result.competencies.map((c) => (
                      <div key={c.code} className="flex items-start gap-2">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 mt-0.5",
                          COMPETENCY_META[c.code as CompetencyCode]?.color ?? "bg-gray-100 text-gray-800"
                        )}>
                          {c.code}
                        </span>
                        <p className="text-white/75 text-sm leading-relaxed">{c.description}</p>
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
                        <div>
                          <p className="text-white text-xs font-semibold uppercase tracking-wide">{a.phase}</p>
                          <p className="text-white/75 text-sm leading-relaxed">{a.description}</p>
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
                    <ol className="space-y-1.5 list-decimal list-inside">
                      {result.criteria.map((c, i) => (
                        <li key={i} className="text-white/75 text-sm leading-relaxed">{c}</li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
