import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, BookMarked, Copy, Check, Trash2, BookOpen, Target,
  ClipboardList, Zap, ExternalLink, RefreshCw, Globe, Lock, Printer, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";

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
  competencies: string;
  resultJson: string;
  isShared?: boolean | null;
  sharedBy?: string | null;
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
  isShared: boolean;
  sharedBy: string | null;
  createdAt: number;
};

function toSaved(raw: RawSituacio): SavedSituacio {
  let comps: string[] = [];
  try { comps = JSON.parse(raw.competencies); } catch { comps = []; }
  return {
    ...raw,
    competencies: comps,
    isShared: raw.isShared === true,
    sharedBy: raw.sharedBy ?? null,
    createdAt: new Date(raw.createdAt).getTime(),
  };
}

export default function MySituacions() {
  const { t } = useI18n();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"mine" | "shared">("mine");

  const isZerHos = user?.role === "director" && !!(user as { zerActsAsHos?: boolean }).zerActsAsHos;
  const isHos = user?.role === "admin" || user?.role === "head_of_study" || isZerHos;

  const { data: rawMine = [], isLoading: loadingMine } = trpc.lomloe.getMySituacions.useQuery();
  const { data: rawShared = [], isLoading: loadingShared } = trpc.lomloe.getSharedSituacions.useQuery(
    undefined,
    { enabled: activeTab === "shared" }
  );

  const mine: SavedSituacio[] = (rawMine as RawSituacio[]).map(toSaved);
  const shared: SavedSituacio[] = (rawShared as RawSituacio[]).map(toSaved);

  const [viewItem, setViewItem] = useState<SavedSituacio | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Fetch school branding for PDF header
  const { data: branding } = trpc.director.getSchoolBranding.useQuery(undefined, { retry: false });

  const exportPdfMutation = trpc.lomloe.exportSituacioPdf.useMutation();

  const deleteMutation = trpc.lomloe.deleteSituacio.useMutation({
    onSuccess: () => {
      utils.lomloe.getMySituacions.invalidate();
      toast.success(t("my_situacions_deleted"));
    },
  });

  const toggleShareMutation = trpc.lomloe.toggleShareSituacio.useMutation({
    onSuccess: () => {
      utils.lomloe.getMySituacions.invalidate();
      utils.lomloe.getSharedSituacions.invalidate();
      toast.success(t("my_situacions_share_toggled") ?? "Sharing updated.");
    },
    onError: () => toast.error(t("my_situacions_save_error")),
  });

  function getParsed(item: SavedSituacio): SituacioResult | null {
    try { return JSON.parse(item.resultJson); } catch { return null; }
  }

  async function handleDownloadPdf(item: SavedSituacio) {
    setPdfLoading(true);
    try {
      const result = await exportPdfMutation.mutateAsync({
        id: item.id,
        schoolName: branding?.schoolName ?? undefined,
        logoUrl: branding?.logoUrl ?? undefined,
        date: new Date().toLocaleDateString(),
        lang: "ca",
      });
      const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[MySituacions] PDF export failed:", err);
      toast.error("Could not generate PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  function handlePrint(item: SavedSituacio) {
    const parsed = getParsed(item);
    if (!parsed) return;
    const logo = branding?.logoUrl ?? localStorage.getItem("seba_school_logo");
    const logoHtml = logo
      ? `<img src="${logo}" alt="School Logo" style="height:56px;object-fit:contain;" />`
      : ``;
    // Mini-header repeated at the top of each page-break section
    const miniHeader = `<div class="mini-header"><div style="display:flex;align-items:center;gap:10px;border-bottom:1px solid #c7d2fe;padding-bottom:6px;margin-bottom:10px">${logoHtml}<div><strong style="font-size:0.8rem;color:#312e81">${parsed.title}</strong><span style="font-size:0.7rem;color:#6b7280;margin-left:8px">${item.subject} &middot; ${item.yearGroup}</span></div></div></div>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${parsed.title}</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.6}
  .header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:20px}
  .header-text h1{font-size:1.4rem;color:#312e81;margin:0}
  .header-text p{font-size:0.85rem;color:#6b7280;margin:2px 0 0}
  h2{font-size:1.05rem;color:#4f46e5;margin-top:1.5rem;border-left:3px solid #4f46e5;padding-left:8px}
  .badge{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:9999px;padding:2px 10px;font-size:0.75rem;font-weight:700;margin-right:6px}
  .ref{color:#6b7280;font-style:italic;font-size:0.85rem;margin-top:1.5rem;border-top:1px solid #e5e7eb;padding-top:8px}
  ol,ul{padding-left:1.5rem}
  li{margin-bottom:4px}
  .activity{margin-bottom:12px}
  .activity-phase{font-weight:700;text-transform:uppercase;font-size:0.8rem;letter-spacing:0.05em;color:#6d28d9}
  .powered{text-align:right;font-size:0.7rem;color:#9ca3af;margin-top:20px}
  .page-break{page-break-before:always;break-before:page;margin-top:0;padding-top:1.5rem}
  .mini-header{display:none}
  @media print{
    body{margin:20px}
    .page-break{page-break-before:always;break-before:page}
    .mini-header{display:block}
  }
</style></head><body>
<div class="header">${logoHtml}<div class="header-text"><h1>${parsed.title}</h1><p>${item.subject} &middot; ${item.yearGroup}</p></div></div>
<h2>${t("situacio_context_label")}</h2><p>${parsed.context}</p>
<h2>${t("situacio_task_label")}</h2><p>${parsed.task}</p>
<h2>${t("situacio_competencies_label")}</h2>${parsed.competencies.map(c=>`<p><span class="badge">${c.code}</span>${c.description}</p>`).join('')}
<div class="page-break">${miniHeader}<h2>${t("situacio_activities_label")}</h2>${parsed.activities.map((a,i)=>`<div class="activity"><span class="activity-phase">${i+1}. ${a.phase}</span><p style="margin:4px 0 0">${a.description}</p></div>`).join('')}</div>
<div class="page-break">${miniHeader}<h2>${t("situacio_criteria_label")}</h2><ol>${parsed.criteria.map(c=>`<li>${c}</li>`).join('')}</ol></div>
<p class="ref">${parsed.lomloeRef}</p>
<div class="powered">Powered by SEBA &middot; ${new Date().toLocaleDateString()}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
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

  function handleRegenerate(item: SavedSituacio) {
    const params = new URLSearchParams({
      topic: item.topic,
      subject: item.subject,
      yearGroup: item.yearGroup,
      competencies: item.competencies.join(","),
    });
    navigate(`/situacio?${params.toString()}`);
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

  function SituacioCard({ item, showShareToggle = false }: { item: SavedSituacio; showShareToggle?: boolean }) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-colors group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-white text-sm leading-snug line-clamp-2 flex-1">{item.title}</CardTitle>
            {item.isShared && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs shrink-0 gap-1">
                <Globe className="w-3 h-3" /> Shared
              </Badge>
            )}
          </div>
          <p className="text-white/50 text-xs mt-1">{item.subject} · {item.yearGroup}</p>
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
          <p className="text-white/40 text-xs">{new Date(item.createdAt).toLocaleDateString()}</p>
          <div className="flex gap-2 pt-1 flex-wrap">
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
              onClick={() => handleRegenerate(item)}
              title={t("sa_regenerate")}
              className="bg-white/10 border-white/20 text-emerald-300 hover:bg-emerald-500/20 px-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(item)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-2"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
            {showShareToggle && isHos && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleShareMutation.mutate({ id: item.id, shared: !item.isShared })}
                disabled={toggleShareMutation.isPending}
                title={item.isShared ? "Unshare from school library" : "Share with school library"}
                className={cn(
                  "bg-white/10 border-white/20 px-2",
                  item.isShared
                    ? "text-emerald-300 hover:bg-emerald-500/20"
                    : "text-white/50 hover:bg-white/20"
                )}
              >
                {item.isShared ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </Button>
            )}
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
    );
  }

  function EmptyState({ href }: { href?: string }) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20 flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <BookMarked className="w-10 h-10 text-white/30 mx-auto" />
          <p className="text-white/50 text-sm max-w-xs">{t("my_situacions_empty")}</p>
          {href && (
            <Link href={href}>
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 mt-2">
                <ExternalLink className="w-3.5 h-3.5" />
                SA Generator
              </Button>
            </Link>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="chat-bg min-h-screen flex flex-col">
      <NavBar />
      <div className="container py-6 max-w-5xl mx-auto w-full flex-1 space-y-5">
        {/* Header */}
        <BackButton label={t("btn_back")} variant="dark" className="mb-1" />
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "mine" | "shared")}>
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="mine" className="data-[state=active]:bg-white data-[state=active]:text-primary text-white/70 gap-1.5">
              <BookMarked className="w-3.5 h-3.5" />
              {t("my_situacions_tab_mine") ?? "My Library"}
              {mine.length > 0 && (
                <span className="ml-1 bg-white/20 text-white text-xs rounded-full px-1.5 py-0.5">{mine.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="shared" className="data-[state=active]:bg-white data-[state=active]:text-primary text-white/70 gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {t("my_situacions_tab_shared") ?? "School Library"}
              {shared.length > 0 && (
                <span className="ml-1 bg-white/20 text-white text-xs rounded-full px-1.5 py-0.5">{shared.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* My Library */}
          <TabsContent value="mine" className="mt-4">
            {loadingMine && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/60" />
              </div>
            )}
            {!loadingMine && mine.length === 0 && <EmptyState href="/situacio" />}
            {!loadingMine && mine.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mine.map((item) => (
                  <SituacioCard key={item.id} item={item} showShareToggle />
                ))}
              </div>
            )}
          </TabsContent>

          {/* School Library */}
          <TabsContent value="shared" className="mt-4">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-300" />
              <p className="text-sm text-white/60">
                {isHos
                  ? (t("my_situacions_shared_desc_hos") ?? "SAs marked as shared by any Head of Study or Director are visible to all teachers here.")
                  : (t("my_situacions_shared_desc") ?? "School-wide SAs shared by the Head of Study or Director.")}
              </p>
            </div>
            {loadingShared && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/60" />
              </div>
            )}
            {!loadingShared && shared.length === 0 && <EmptyState />}
            {!loadingShared && shared.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shared.map((item) => (
                  <SituacioCard key={item.id} item={item} showShareToggle={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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
                {viewItem && (
                  <Button size="sm" variant="outline" onClick={() => handlePrint(viewItem)} className="gap-1.5">
                    <Printer className="w-3.5 h-3.5" />
                    {t("my_situacions_print") ?? "Print"}
                  </Button>
                )}
                {viewItem && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPdf(viewItem)}
                    disabled={pdfLoading}
                    className="gap-1.5"
                  >
                    {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    {t("my_situacions_download_pdf") ?? "Download PDF"}
                  </Button>
                )}
                {viewItem && (
                  <Button size="sm" variant="outline" onClick={() => handleRegenerate(viewItem)} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t("sa_regenerate")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
