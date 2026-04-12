import { useState } from "react";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, ChevronUp, Search, BookOpen, ArrowLeft,
  Languages, Loader2, FileDown, CheckSquare, Square, X, Printer,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import LogoUploader from "@/components/LogoUploader";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const COMP_COLORS: Record<CompetencyCode, string> = {
  CCL: "bg-blue-500/30 text-blue-200 border-blue-400/40",
  CP: "bg-purple-500/30 text-purple-200 border-purple-400/40",
  STEM: "bg-green-500/30 text-green-200 border-green-400/40",
  CD: "bg-cyan-500/30 text-cyan-200 border-cyan-400/40",
  CPSAA: "bg-orange-500/30 text-orange-200 border-orange-400/40",
  CC: "bg-red-500/30 text-red-200 border-red-400/40",
  CE: "bg-yellow-500/30 text-yellow-200 border-yellow-400/40",
  CCEC: "bg-pink-500/30 text-pink-200 border-pink-400/40",
};

function downloadBase64Pdf(base64: string, filename: string) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SampleQuestions() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [filterComp, setFilterComp] = useState<CompetencyCode | "">("");
  const [filterYG, setFilterYG] = useState<YearGroup | "">("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [translating, setTranslating] = useState(false);

  // Worksheet export state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [worksheetTitle, setWorksheetTitle] = useState("");
  const [worksheetSubtitle, setWorksheetSubtitle] = useState("");

  const YG_LABELS: Record<YearGroup, string> = {
    junior: `${t("admin_junior")} (Yr 3–4)`,
    primary: `${t("admin_primary")} (Yr 5–6)`,
    secondary: `${t("admin_secondary")} (Yr 7–10)`,
  };

  const locale = lang === "en" ? "en" : lang === "es" ? "es" : "ca";

  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();
  const { data: questions, isLoading, refetch } = trpc.lomloe.getQuestions.useQuery({
    competency: filterComp || undefined,
    yearGroup: filterYG || undefined,
    locale,
  });

  const translateMutation = trpc.lomloe.translateQuestions.useMutation({
    onSuccess: async (result) => {
      if (result.remaining > 0) {
        toast.success(`${result.translated} ${t("admin_translate_done_count")}`, { description: `${result.remaining} ${t("admin_translate_remaining")} — ${t("sample_translate_click_more")}.` });
      } else {
        toast.success(t("sample_translate_all_done"));
      }
      await refetch();
      setTranslating(false);
    },
    onError: (err) => {
      toast.error(t("sample_translate_failed"), { description: err.message });
      setTranslating(false);
    },
  });

  const exportMutation = trpc.lomloe.exportWorksheet.useMutation({
    onSuccess: (result) => {
      const safeTitle = worksheetTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      downloadBase64Pdf(result.withoutAnswers, `${safeTitle}_student.pdf`);
      downloadBase64Pdf(result.withAnswers, `${safeTitle}_answers.pdf`);
      toast.success(t("sample_worksheet_downloaded"), {
        description: t("sample_worksheet_downloaded_desc"),
      });
      setShowExportModal(false);
    },
    onError: (err) => {
      toast.error(t("sample_export_failed"), { description: err.message });
    },
  });

  const handleTranslate = () => {
    if (lang === "en") return;
    setTranslating(true);
    translateMutation.mutate({ locale: lang as "es" | "ca", batchSize: 30 });
  };

  const handleExport = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const logoDataUrl = localStorage.getItem("seba_school_logo") ?? undefined;
    exportMutation.mutate({
      questionIds: ids,
      locale,
      title: worksheetTitle || t("sample_worksheet_default_title"),
      subtitle: worksheetSubtitle || undefined,
      logoDataUrl,
    });
  };

  const filtered = (questions ?? []).filter((q) => {
    if (!search.trim()) return true;
    return (
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.options.some((o) => o.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((q) => q.id)));
  const clearSelection = () => setSelected(new Set());

  return (
    <div className="min-h-screen samples-bg">
      <NavBar />
      <div className="container py-6 sm:py-10 max-w-4xl relative z-10">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2 mb-2">
            <ArrowLeft className="size-4" />{t("btn_back")}
          </Button>
          <div className="inline-flex items-center gap-2 bg-white/15 text-white border border-white/25 rounded-full px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
            <BookOpen className="w-4 h-4" /> {t("questions_title")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white drop-shadow-lg">{t("questions_title")}</h1>
          <p className="text-white/75 max-w-2xl">{t("questions_subtitle")}</p>

          {/* Language indicator + admin translate button */}
          {lang !== "en" && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-white/70">
                <Languages className="w-3.5 h-3.5" />
                {lang === "es" ? t("sample_es_note") : t("sample_ca_note")}
              </div>
              {user?.role === "admin" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTranslate}
                  disabled={translating}
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-xs h-7"
                >
                  {translating ? (
                    <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t("admin_translating")}</>
                  ) : (
                    <><Languages className="w-3 h-3 mr-1.5" />{t("sample_translate_next_30")}</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px] space-y-1">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">{t("questions_filter_competency")}</label>
            <select
              value={filterComp}
              onChange={(e) => setFilterComp(e.target.value as CompetencyCode | "")}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <option value="" className="bg-slate-800">{t("questions_all")}</option>
              {(competencies ?? []).map((c) => (
                <option key={c.code} value={c.code} className="bg-slate-800">{c.code} – {c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">{t("questions_filter_year")}</label>
            <select
              value={filterYG}
              onChange={(e) => setFilterYG(e.target.value as YearGroup | "")}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <option value="" className="bg-slate-800">{t("questions_all")}</option>
              <option value="junior" className="bg-slate-800">{YG_LABELS.junior}</option>
              <option value="primary" className="bg-slate-800">{YG_LABELS.primary}</option>
              <option value="secondary" className="bg-slate-800">{YG_LABELS.secondary}</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">{t("nav_questions")}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("chat_placeholder")}
                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50"
              />
            </div>
          </div>
          {(filterComp || filterYG || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterComp(""); setFilterYG(""); setSearch(""); }}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              {t("cancel")}
            </Button>
          )}
        </div>

        {/* Toolbar: count + worksheet export */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm text-white/60">
            {filtered.length} {t("questions_title").toLowerCase()}
            {selectMode && selected.size > 0 && (
              <span className="ml-2 text-white/80 font-medium">· {selected.size} {t("sample_selected")}</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <Button size="sm" variant="ghost" onClick={selectAll} className="text-white/70 hover:text-white hover:bg-white/10 text-xs h-7 gap-1">
                  <CheckSquare className="w-3.5 h-3.5" />{t("sample_select_all")} ({filtered.length})
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} className="text-white/70 hover:text-white hover:bg-white/10 text-xs h-7 gap-1">
                  <Square className="w-3.5 h-3.5" />{t("sample_clear")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => { if (selected.size > 0) setShowExportModal(true); }}
                  disabled={selected.size === 0}
                  className="bg-white text-slate-900 hover:bg-white/90 text-xs h-7 gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />{t("sample_print_worksheet")} ({selected.size})
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSelectMode(false); clearSelection(); }} className="text-white/50 hover:text-white hover:bg-white/10 h-7 w-7 p-0">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectMode(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-xs h-7 gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />{t("sample_print_worksheet")}
              </Button>
            )}
          </div>
        </div>

        {/* Question list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/10 rounded-xl border border-white/20 p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/50">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{t("my_materials_empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => {
              const isOpen = expanded.has(q.id);
              const isSelected = selected.has(q.id);
              return (
                <div
                  key={q.id}
                  className={`bg-white/10 backdrop-blur-md rounded-xl border overflow-hidden transition-all hover:bg-white/15 ${
                    isSelected ? "border-white/60 ring-1 ring-white/40" : "border-white/20"
                  }`}
                >
                  <button
                    className="w-full text-left p-4 flex items-start gap-3"
                    onClick={() => selectMode ? toggleSelect(q.id) : toggle(q.id)}
                  >
                    {selectMode && (
                      <div className="shrink-0 mt-0.5 text-white/70">
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-white" />
                          : <Square className="w-4 h-4" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`text-xs border ${COMP_COLORS[q.competency as CompetencyCode] ?? "bg-white/10 text-white/70 border-white/20"}`}>
                          {q.competency}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-white/60 border-white/25">
                          {YG_LABELS[q.yearGroup as YearGroup] ?? q.yearGroup}
                        </Badge>
                      </div>
                      <p className="text-sm sm:text-base font-medium text-white leading-snug">{q.question}</p>
                    </div>
                    {!selectMode && (
                      <div className="shrink-0 mt-1 text-white/50">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    )}
                  </button>

                  {isOpen && !selectMode && (
                    <div className="border-t border-white/15 p-4 space-y-3 bg-black/20 backdrop-blur-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-2.5 text-sm flex items-start gap-2 ${
                              i === q.correctIndex
                                ? "bg-green-500/20 border-green-400/50 text-green-200 font-medium"
                                : "bg-white/5 border-white/15 text-white/80"
                            }`}
                          >
                            <span className={`font-bold shrink-0 ${i === q.correctIndex ? "text-green-400" : "text-white/40"}`}>
                              {String.fromCharCode(65 + i)}.
                            </span>
                            {opt}
                            {i === q.correctIndex && <span className="ml-auto text-green-400 shrink-0">✓</span>}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="bg-blue-500/15 border border-blue-400/30 rounded-lg p-3 text-sm text-blue-200">
                          <span className="font-semibold">{t("questions_explanation")}: </span>{q.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export Worksheet Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              {t("sample_print_worksheet")} ({selected.size} {t("questions_title").toLowerCase()})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Logo upload */}
            <LogoUploader />
            <Separator />
            <div className="space-y-1.5">
              <Label htmlFor="ws-title">{t("sample_worksheet_title_label")}</Label>
              <Input
                id="ws-title"
                value={worksheetTitle}
                onChange={(e) => setWorksheetTitle(e.target.value)}
                placeholder={t("sample_worksheet_default_title")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-subtitle">{t("sample_worksheet_subtitle_label")}</Label>
              <Input
                id="ws-subtitle"
                value={worksheetSubtitle}
                onChange={(e) => setWorksheetSubtitle(e.target.value)}
                placeholder={t("sample_worksheet_subtitle_placeholder")}
              />
            </div>
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">{t("sample_two_pdfs")}</p>
              <p>• <strong>{t("sample_student_copy")}</strong> — {t("sample_student_copy_desc")}</p>
              <p>• <strong>{t("sample_answer_key")}</strong> — {t("sample_answer_key_desc")}</p>
              <p className="text-xs mt-1">{t("sample_language_label")}: {t(`lang_${lang}`)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>{t("cancel")}</Button>
            <Button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="gap-2"
            >
              {exportMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t("sample_generating_pdfs")}</>
              ) : (
                <><FileDown className="w-4 h-4" />{t("sample_download_pdfs")}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
