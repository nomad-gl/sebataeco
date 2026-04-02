import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NavBar from "@/components/NavBar";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, ExternalLink, BookOpen, Presentation,
  Grid3X3, AlignLeft, Search, CreditCard, Lock, Zap, Download,
  FileText, RefreshCw, ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useI18n } from "@/contexts/I18nContext";
import { useState } from "react";

const TYPE_ICONS: Record<string, React.ElementType> = {
  quiz: BookOpen,
  slides: Presentation,
  crossword: Grid3X3,
  missing_words: AlignLeft,
  wordsearch: Search,
  flashcards: CreditCard,
};

const TYPE_COLORS: Record<string, string> = {
  quiz:          "from-blue-500 to-blue-600",
  slides:        "from-purple-500 to-purple-600",
  crossword:     "from-green-500 to-green-600",
  missing_words: "from-amber-500 to-amber-600",
  wordsearch:    "from-rose-500 to-rose-600",
  flashcards:    "from-teal-500 to-teal-600",
};

// Map a sebasnap presentation to a SEBA | Teach slides content object
function mapSebasnapToSlides(pres: {
  id: string;
  title: string;
  subject?: string;
  subjecte?: string;
  slides?: unknown[];
  content?: unknown;
}) {
  const rawSlides = (pres.slides ?? []) as Array<Record<string, unknown>>;
  const mappedSlides = rawSlides.map((s, i) => ({
    slideNumber: i + 1,
    heading: String(s.title ?? s.heading ?? `Slide ${i + 1}`),
    bullets: Array.isArray(s.bullets)
      ? (s.bullets as string[])
      : Array.isArray(s.content)
      ? (s.content as string[])
      : typeof s.content === "string"
      ? [s.content]
      : [],
    speakerNotes: String(s.speakerNotes ?? s.notes ?? ""),
    imagePrompt: String(s.imagePrompt ?? s.imageSuggestion ?? ""),
  }));

  return {
    title: pres.title,
    subject: pres.subject ?? pres.subjecte ?? "",
    competency: "",
    yearGroup: "",
    keyVocabulary: [],
    slides: mappedSlides,
  };
}

interface SebasnapItem {
  id: string;
  title: string;
  subject?: string;
  subjecte?: string;
  type?: string;
  createdAt?: string;
  slides?: unknown[];
  content?: unknown;
}

export default function MyMaterials() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [selectedPres, setSelectedPres] = useState<SebasnapItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");

  const { data: materials, isLoading } = trpc.materials.list.useQuery(undefined, { enabled: !!user });
  const deleteMutation = trpc.materials.delete.useMutation({
    onSuccess: () => {
      toast.success(t("my_materials_delete") + "d.");
      utils.materials.list.invalidate();
    },
  });

  // Sebasnap import
  const {
    data: sebasnapData,
    isLoading: sebasnapLoading,
    refetch: refetchSebasnap,
    error: sebasnapError,
  } = trpc.materials.listFromSebasnap.useQuery(undefined, {
    enabled: importOpen && !!user,
    staleTime: 60_000,
  });

  const importMutation = trpc.materials.importFromSebasnap.useMutation({
    onSuccess: (data) => {
      toast.success(`"${data.title}" ${t("import_sebasnap_success")}`);
      utils.materials.list.invalidate();
      setImportOpen(false);
      setSelectedPres(null);
    },
    onError: (err) => {
      toast.error(t("import_sebasnap_failed") + " " + err.message);
    },
  });

  function openImportDialog() {
    setImportOpen(true);
    setSelectedPres(null);
  }

  function selectPresentation(pres: SebasnapItem) {
    setSelectedPres(pres);
    setEditTitle(pres.title);
    setEditSubject(pres.subject ?? pres.subjecte ?? "");
  }

  function confirmImport() {
    if (!selectedPres) return;
    const mapped = mapSebasnapToSlides({
      ...selectedPres,
      title: editTitle,
      subject: editSubject,
    });
    importMutation.mutate({
      sebasnapId: selectedPres.id,
      title: editTitle,
      subject: editSubject,
      type: "slides",
      content: JSON.stringify(mapped),
    });
  }

  const presentations = sebasnapData?.presentations ?? [];

  if (loading || isLoading) {
    return (
      <div className="materials-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="materials-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">{t("sign_in_required")}</h2>
              <Button asChild className="w-full">
                <a href={getLoginUrl()}>{t("nav_sign_in")}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="materials-bg flex flex-col">
      <NavBar />
      <div className="container py-4 sm:py-8 max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="self-start flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
          <ArrowLeft className="size-4" />{t("btn_back")}
        </Button>
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow">{t("my_materials_title")}</h1>
            <p className="text-sm text-white/70 mt-1">
              {materials?.length ?? 0} {t("my_materials_subtitle")}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {/* Import from SEBA Snap button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-orange-400/60 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              onClick={openImportDialog}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t("import_sebasnap_btn")}</span>
              <span className="sm:hidden">{t("import_sebasnap_import_btn")}</span>
            </Button>
            <Button onClick={() => navigate("/create")} className="gap-2" size="sm">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t("my_materials_create")}</span><span className="sm:hidden">{t("save")}</span>
            </Button>
          </div>
        </div>

        {/* Materials list */}
        {!materials || materials.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-white/60" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{t("my_materials_empty")}</h3>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={openImportDialog} className="gap-2 border-orange-400/60 text-orange-600 hover:bg-orange-50">
                  <Download className="w-4 h-4" /> {t("import_sebasnap_btn")}
                </Button>
                <Button onClick={() => navigate("/create")} className="gap-2">
                  <Plus className="w-4 h-4" /> {t("my_materials_create")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {materials.map((m) => {
              const Icon = TYPE_ICONS[m.type] ?? BookOpen;
              const colorClass = TYPE_COLORS[m.type] ?? "from-gray-400 to-gray-500";
              return (
                <Card key={m.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all">
                  <CardContent className="p-3 sm:p-4 flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs capitalize bg-white/15 text-white/80 border-white/20">
                          {m.type.replace("_", " ")}
                        </Badge>
                        {m.competency && <Badge variant="outline" className="text-xs text-white/70 border-white/25">{m.competency}</Badge>}
                        {m.yearGroup && <Badge variant="outline" className="text-xs capitalize text-white/70 border-white/25">{m.yearGroup}</Badge>}
                        <span className="text-xs text-white/50">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="outline"
                        className="gap-1.5 border-yellow-400/50 text-yellow-300 hover:bg-yellow-500/20 bg-transparent"
                        onClick={() => { window.location.href = `/challenge?materialId=${m.id}&materialTitle=${encodeURIComponent(m.title)}`; }}>
                        <Zap className="w-3.5 h-3.5" /> {t("nav_challenge")}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 border-white/25 text-white/80 hover:bg-white/15 bg-transparent"
                        onClick={() => navigate(`/materials/${m.id}`)}>
                        <ExternalLink className="w-3.5 h-3.5" /> {t("my_materials_open")}
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        onClick={() => { if (confirm(t("my_materials_delete") + "?")) deleteMutation.mutate({ id: m.id }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Import from SEBA Snap Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-orange-500" />
              {t("import_sebasnap_title")}
            </DialogTitle>
            <DialogDescription>
              {t("import_sebasnap_hint")}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Pick a presentation */}
          {!selectedPres && (
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {sebasnapLoading
                    ? t("import_sebasnap_loading")
                    : `${presentations.length} presentation${presentations.length !== 1 ? "s" : ""} found`}
                </p>
                <Button variant="ghost" size="sm" onClick={() => refetchSebasnap()} className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> {t("import_sebasnap_refresh")}
                </Button>
              </div>

              {sebasnapLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              )}

              {sebasnapError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                  {t("import_sebasnap_load_failed")} {sebasnapError.message}
                </div>
              )}

              {!sebasnapLoading && presentations.length === 0 && !sebasnapError && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground" />
                  <p className="font-medium text-foreground">{t("import_sebasnap_none")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("import_sebasnap_hint")}{" "}
                    <a href="https://sebasnap.com/presentation/bank" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      SEBA Snap
                    </a>
                  </p>
                </div>
              )}

              {!sebasnapLoading && presentations.length > 0 && (
                <div className="flex flex-col gap-2">
                  {presentations.map((pres) => (
                    <button
                      key={pres.id}
                      onClick={() => selectPresentation(pres as SebasnapItem)}
                      className="w-full text-left rounded-lg border border-border p-3 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Presentation className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{pres.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {(pres.subject ?? pres.subjecte) && (
                              <Badge variant="secondary" className="text-xs">
                                {pres.subject ?? pres.subjecte}
                              </Badge>
                            )}
                            {pres.type && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {pres.type}
                              </Badge>
                            )}
                            {pres.createdAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(pres.createdAt).toLocaleDateString()}
                              </span>
                            )}
                            {Array.isArray(pres.slides) && (
                              <span className="text-xs text-muted-foreground">
                                {pres.slides.length} {t("import_sebasnap_field_slides")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Edit before saving */}
          {selectedPres && (
            <div className="flex-1 overflow-y-auto flex flex-col gap-4">
              <button
                onClick={() => setSelectedPres(null)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 self-start"
              >
                ← {t("import_sebasnap_back")}
              </button>

              <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-900/10 p-4">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                  {t("import_sebasnap_review_title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("import_sebasnap_review_hint")}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="import-title">{t("import_sebasnap_field_title")}</Label>
                  <Input
                    id="import-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder={t("import_sebasnap_select")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="import-subject">{t("import_sebasnap_field_subject")}</Label>
                  <Input
                    id="import-subject"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder={t("import_sebasnap_field_subject")}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">{t("import_sebasnap_field_type")}</p>
                <Badge variant="secondary" className="capitalize">{t("import_sebasnap_field_slides")}</Badge>
                {Array.isArray(selectedPres.slides) && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {selectedPres.slides.length} {t("import_sebasnap_field_slides")}
                  </span>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setImportOpen(false); setSelectedPres(null); }}>
              {t("cancel")}
            </Button>
            {selectedPres && (
              <Button
                onClick={confirmImport}
                disabled={!editTitle.trim() || importMutation.isPending}
                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t("import_sebasnap_importing")}</>
                ) : (
                  <><Download className="w-4 h-4" /> {t("create_save_material")}</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
