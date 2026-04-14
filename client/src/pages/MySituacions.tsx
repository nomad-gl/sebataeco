import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, BookMarked, Copy, Check, Trash2, BookOpen, Target, ClipboardList, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";

const COMPETENCY_META: Record<string, string> = {
  CCL:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  CP:    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  STEM:  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CD:    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  CPSAA: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  CC:    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  CE:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  CCEC:  "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
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

type RawSituacio = {
  id: number;
  title: string;
  topic: string;
  subject: string;
  yearGroup: string;
  competencies: string; // stored as JSON string in DB
  resultJson: string;
  createdAt: Date;
};

type SavedSituacio = {
  id: number;
  title: string;
  topic: string;
  subject: string;
  yearGroup: string;
  competencies: string[];
  resultJson: string;
  createdAt: number;
};

function toSaved(raw: RawSituacio): SavedSituacio {
  let comps: string[] = [];
  try { comps = JSON.parse(raw.competencies); } catch { comps = []; }
  return { ...raw, competencies: comps, createdAt: new Date(raw.createdAt).getTime() };
}

export default function MySituacions() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const { data: rawSituacions = [], isLoading } = trpc.lomloe.getMySituacions.useQuery();
  const situacions: SavedSituacio[] = (rawSituacions as RawSituacio[]).map(toSaved);
  const [viewItem, setViewItem] = useState<SavedSituacio | null>(null);
  const [copied, setCopied] = useState(false);

  const deleteMutation = trpc.lomloe.deleteSituacio.useMutation({
    onSuccess: () => {
      utils.lomloe.getMySituacions.invalidate();
      toast.success(t("my_situacions_deleted"));
    },
  });

  function getParsed(item: SavedSituacio): SituacioResult | null {
    try { return JSON.parse(item.resultJson); } catch { return null; }
  }

  function buildMarkdown(result: SituacioResult): string {
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

  function handleCopy(item: SavedSituacio) {
    const parsed = getParsed(item);
    if (!parsed) return;
    navigator.clipboard.writeText(buildMarkdown(parsed)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("my_situacions_copied"));
    });
  }

  const viewParsed = viewItem ? getParsed(viewItem) : null;

  return (
    <div className="chat-bg min-h-screen flex flex-col">
      <NavBar />
      <div className="container py-6 max-w-5xl mx-auto w-full flex-1 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15">
              <BookMarked className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t("my_situacions_title")}</h1>
              <p className="text-sm text-white/70">{t("my_situacions_desc")}</p>
            </div>
          </div>
          <Link href="/situacio">
            <Button className="gap-2 bg-white text-primary hover:bg-white/90">
              <ExternalLink className="w-4 h-4" />
              SA Generator
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          </div>
        )}

        {!isLoading && situacions.length === 0 && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <BookMarked className="w-10 h-10 text-white/30 mx-auto" />
              <p className="text-white/50 text-sm max-w-xs">{t("my_situacions_empty")}</p>
              <Link href="/situacio">
                <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 mt-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  SA Generator
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {!isLoading && situacions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {situacions.map((item) => (
              <Card key={item.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-colors group">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm leading-snug line-clamp-2">{item.title}</CardTitle>
                  <p className="text-white/50 text-xs mt-1">
                    {item.subject} · {item.yearGroup}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-white/60 text-xs line-clamp-1 italic">{item.topic}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.competencies.map((c) => (
                      <span key={c} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold", COMPETENCY_META[c] ?? "bg-gray-100 text-gray-800")}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="text-white/40 text-xs">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewItem(item)}
                      className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs"
                    >
                      {t("my_situacions_open")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(item)}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-2"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate({ id: item.id })}
                      disabled={deleteMutation.isPending}
                      className="bg-white/10 border-white/20 text-red-300 hover:bg-red-500/20 px-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(o) => { if (!o) setViewItem(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="leading-snug">{viewItem?.title}</DialogTitle>
          </DialogHeader>
          {viewParsed && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  {t("situacio_context_label")}
                </p>
                <p className="text-sm leading-relaxed">{viewParsed.context}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  {t("situacio_task_label")}
                </p>
                <p className="text-sm leading-relaxed">{viewParsed.task}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  {t("situacio_competencies_label")}
                </p>
                <div className="space-y-1.5">
                  {viewParsed.competencies.map((c) => (
                    <div key={c.code} className="flex items-start gap-2">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 mt-0.5", COMPETENCY_META[c.code] ?? "bg-gray-100 text-gray-800")}>
                        {c.code}
                      </span>
                      <p className="text-sm leading-relaxed">{c.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <BookMarked className="w-3.5 h-3.5" />
                  {t("situacio_activities_label")}
                </p>
                <div className="space-y-2">
                  {viewParsed.activities.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.phase}</p>
                        <p className="text-sm leading-relaxed">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" />
                  {t("situacio_criteria_label")}
                </p>
                <ol className="space-y-1 list-decimal list-inside">
                  {viewParsed.criteria.map((c, i) => (
                    <li key={i} className="text-sm leading-relaxed">{c}</li>
                  ))}
                </ol>
              </div>
              <p className="text-xs text-muted-foreground italic">{viewParsed.lomloeRef}</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => viewItem && handleCopy(viewItem)} className="gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {t("my_situacions_copy")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
