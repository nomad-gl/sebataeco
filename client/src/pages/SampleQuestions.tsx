import { useState } from "react";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Search, BookOpen, ArrowLeft, Languages, Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

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

export default function SampleQuestions() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [filterComp, setFilterComp] = useState<CompetencyCode | "">("");
  const [filterYG, setFilterYG] = useState<YearGroup | "">("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [translating, setTranslating] = useState(false);

  const YG_LABELS: Record<YearGroup, string> = {
    junior: `${t("admin_junior")} (Yr 3–4)`,
    primary: `${t("admin_primary")} (Yr 5–6)`,
    secondary: `${t("admin_secondary")} (Yr 7–10)`,
  };

  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();
  const { data: questions, isLoading, refetch } = trpc.lomloe.getQuestions.useQuery({
    competency: filterComp || undefined,
    yearGroup: filterYG || undefined,
    locale: lang === "en" ? "en" : lang === "es" ? "es" : "ca",
  });

  const translateMutation = trpc.lomloe.translateQuestions.useMutation({
    onSuccess: async (result) => {
      if (result.remaining > 0) {
        toast.success(`${result.translated} questions translated`, { description: `${result.remaining} remaining — click again to translate more.` });
      } else {
        toast.success("All questions are now translated!");
      }
      await refetch();
      setTranslating(false);
    },
    onError: (err) => {
      toast.error("Translation failed", { description: err.message });
      setTranslating(false);
    },
  });

  const handleTranslate = () => {
    if (lang === "en") return;
    setTranslating(true);
    translateMutation.mutate({ locale: lang as "es" | "ca", batchSize: 30 });
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
                {lang === "es" ? "Preguntas en Español · Las sin traducción aparecen en inglés" : "Preguntes en Català · Les sense traducció apareixen en anglès"}
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
                    <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Translating…</>
                  ) : (
                    <><Languages className="w-3 h-3 mr-1.5" />Translate next 30</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 mb-6 flex flex-wrap gap-3 items-end">
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

        {/* Count */}
        <p className="text-sm text-white/60 mb-4">
          {filtered.length} {t("questions_title").toLowerCase()}
        </p>

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
              return (
                <div
                  key={q.id}
                  className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden transition-all hover:bg-white/15"
                >
                  <button
                    className="w-full text-left p-4 flex items-start gap-3"
                    onClick={() => toggle(q.id)}
                  >
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
                    <div className="shrink-0 mt-1 text-white/50">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isOpen && (
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
    </div>
  );
}
