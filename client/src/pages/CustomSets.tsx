import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit3,
  Play,
  Sparkles,
  ChevronLeft,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const COMPETENCY_CODES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"] as const;
const YEAR_GROUPS = [
  { value: "infantil", label: "Infantil (3–6)" },
  { value: "lower_primary", label: "Primària Inicial (Yr 1–2)" },
  { value: "junior", label: "Primària Cicle Mitjà (Yr 3–4)" },
  { value: "primary", label: "Primària Cicle Superior (Yr 5–6)" },
  { value: "secondary", label: "ESO (Yr 7–10)" },
] as const;

type YearGroup = (typeof YEAR_GROUPS)[number]["value"];
type Competency = (typeof COMPETENCY_CODES)[number];

interface QuestionForm {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctIndex: number;
  explanation: string;
  competency: Competency | "";
  yearGroup: YearGroup | "";
}

const emptyQForm = (): QuestionForm => ({
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctIndex: 0,
  explanation: "",
  competency: "",
  yearGroup: "",
});

export default function CustomSets() {
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const utils = trpc.useUtils();

  // View state: "list" | "detail"
  const [view, setView] = useState<"list" | "detail">("list");
  const [activeSetId, setActiveSetId] = useState<number | null>(null);

  // Create set dialog
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [newSetDesc, setNewSetDesc] = useState("");
  const [newSetComp, setNewSetComp] = useState<Competency | "">("");
  const [newSetYear, setNewSetYear] = useState<YearGroup | "">("");

  // Edit set dialog
  const [showEditSet, setShowEditSet] = useState(false);
  const [editSetName, setEditSetName] = useState("");
  const [editSetDesc, setEditSetDesc] = useState("");
  const [editSetComp, setEditSetComp] = useState<Competency | "">("");
  const [editSetYear, setEditSetYear] = useState<YearGroup | "">("");

  // Add/edit question dialog
  const [showQDialog, setShowQDialog] = useState(false);
  const [editingQId, setEditingQId] = useState<number | null>(null);
  const [qForm, setQForm] = useState<QuestionForm>(emptyQForm());

  // AI generate dialog
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genYear, setGenYear] = useState<YearGroup>("primary");
  const [genCount, setGenCount] = useState(5);

  // Delete confirmation
  const [deleteSetId, setDeleteSetId] = useState<number | null>(null);
  const [deleteQId, setDeleteQId] = useState<number | null>(null);

  // Queries
  const { data: sets, isLoading: setsLoading } = trpc.customSets.listSets.useQuery();
  const { data: setDetail, isLoading: detailLoading } = trpc.customSets.getSet.useQuery(
    { setId: activeSetId! },
    { enabled: !!activeSetId }
  );

  // Mutations
  const createSet = trpc.customSets.createSet.useMutation({
    onSuccess: () => {
      utils.customSets.listSets.invalidate();
      setShowCreateSet(false);
      setNewSetName("");
      setNewSetDesc("");
      setNewSetComp("");
      setNewSetYear("");
      toast.success(t("custom_sets_created"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSet = trpc.customSets.updateSet.useMutation({
    onSuccess: () => {
      utils.customSets.listSets.invalidate();
      if (activeSetId) utils.customSets.getSet.invalidate({ setId: activeSetId });
      setShowEditSet(false);
      toast.success(t("custom_sets_updated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSet = trpc.customSets.deleteSet.useMutation({
    onSuccess: () => {
      utils.customSets.listSets.invalidate();
      setDeleteSetId(null);
      if (view === "detail") {
        setView("list");
        setActiveSetId(null);
      }
      toast.success(t("custom_sets_deleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  const addQuestion = trpc.customSets.addQuestion.useMutation({
    onSuccess: () => {
      if (activeSetId) utils.customSets.getSet.invalidate({ setId: activeSetId });
      utils.customSets.listSets.invalidate();
      setShowQDialog(false);
      setQForm(emptyQForm());
      setEditingQId(null);
      toast.success(t("custom_sets_q_added"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateQuestion = trpc.customSets.updateQuestion.useMutation({
    onSuccess: () => {
      if (activeSetId) utils.customSets.getSet.invalidate({ setId: activeSetId });
      setShowQDialog(false);
      setQForm(emptyQForm());
      setEditingQId(null);
      toast.success(t("custom_sets_q_updated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteQuestion = trpc.customSets.deleteQuestion.useMutation({
    onSuccess: () => {
      if (activeSetId) utils.customSets.getSet.invalidate({ setId: activeSetId });
      utils.customSets.listSets.invalidate();
      setDeleteQId(null);
      toast.success(t("custom_sets_q_deleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  const generateQuestions = trpc.customSets.generateQuestions.useMutation({
    onSuccess: (data) => {
      if (activeSetId) utils.customSets.getSet.invalidate({ setId: activeSetId });
      utils.customSets.listSets.invalidate();
      setShowGenDialog(false);
      setGenTopic("");
      toast.success(`${data.added} ${t("custom_sets_gen_added")}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Helpers
  const openEditSet = () => {
    if (!setDetail) return;
    setEditSetName(setDetail.name);
    setEditSetDesc(setDetail.description ?? "");
    setEditSetComp((setDetail.competency as Competency) ?? "");
    setEditSetYear((setDetail.yearGroup as YearGroup) ?? "");
    setShowEditSet(true);
  };

  const openAddQuestion = () => {
    setEditingQId(null);
    setQForm(emptyQForm());
    setShowQDialog(true);
  };

  const openEditQuestion = (q: NonNullable<typeof setDetail>["questions"][number]) => {
    const opts = JSON.parse(q.options) as string[];
    setQForm({
      question: q.question,
      optionA: opts[0] ?? "",
      optionB: opts[1] ?? "",
      optionC: opts[2] ?? "",
      optionD: opts[3] ?? "",
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      competency: (q.competency as Competency) ?? "",
      yearGroup: (q.yearGroup as YearGroup) ?? "",
    });
    setEditingQId(q.id);
    setShowQDialog(true);
  };

  const submitQuestion = () => {
    const options = [qForm.optionA, qForm.optionB, qForm.optionC, qForm.optionD];
    if (!qForm.question.trim() || options.some((o) => !o.trim()) || !qForm.explanation.trim()) {
      toast.error(t("custom_sets_q_fill_all"));
      return;
    }
    const payload = {
      question: qForm.question,
      options,
      correctIndex: qForm.correctIndex,
      explanation: qForm.explanation,
      competency: qForm.competency || undefined,
      yearGroup: qForm.yearGroup || undefined,
    };
    if (editingQId) {
      updateQuestion.mutate({ questionId: editingQId, ...payload });
    } else {
      addQuestion.mutate({ setId: activeSetId!, ...payload });
    }
  };

  const practiseSet = (setId: number) => {
    navigate(`/practice?customSetId=${setId}`);
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/practice")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{t("custom_sets_title")}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{t("custom_sets_subtitle")}</p>
            </div>
            <Button onClick={() => setShowCreateSet(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t("custom_sets_new")}
            </Button>
          </div>

          {/* Sets grid */}
          {setsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !sets || sets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">{t("custom_sets_empty")}</p>
              <p className="text-sm mt-1">{t("custom_sets_empty_hint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sets.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => {
                    setActiveSetId(s.id);
                    setView("detail");
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">{s.name}</CardTitle>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            practiseSet(s.id);
                          }}
                          title={t("custom_sets_practise")}
                        >
                          <Play className="w-3.5 h-3.5 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteSetId(s.id);
                          }}
                          title={t("custom_sets_delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {s.description && (
                      <CardDescription className="text-xs line-clamp-2">{s.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs text-muted-foreground">
                        <HelpCircle className="w-3 h-3 inline mr-0.5" />
                        {s.questionCount} {t("custom_sets_questions")}
                      </span>
                      {s.competency && (
                        <Badge variant="secondary" className="text-xs py-0">
                          {s.competency}
                        </Badge>
                      )}
                      {s.yearGroup && (
                        <Badge variant="outline" className="text-xs py-0">
                          {YEAR_GROUPS.find((y) => y.value === s.yearGroup)?.label ?? s.yearGroup}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create set dialog */}
        <Dialog open={showCreateSet} onOpenChange={setShowCreateSet}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("custom_sets_new")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>{t("custom_sets_name")}</Label>
                <Input
                  className="mt-1"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder={t("custom_sets_name_ph")}
                />
              </div>
              <div>
                <Label>{t("custom_sets_desc")}</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={newSetDesc}
                  onChange={(e) => setNewSetDesc(e.target.value)}
                  placeholder={t("custom_sets_desc_ph")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("custom_sets_competency")}</Label>
                  <Select value={newSetComp} onValueChange={(v) => setNewSetComp(v as Competency | "")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t("custom_sets_any")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">{t("custom_sets_any")}</SelectItem>
                      {COMPETENCY_CODES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("custom_sets_year_group")}</Label>
                  <Select value={newSetYear} onValueChange={(v) => setNewSetYear(v as YearGroup | "")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t("custom_sets_any")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">{t("custom_sets_any")}</SelectItem>
                      {YEAR_GROUPS.map((y) => (
                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateSet(false)}>{t("cancel")}</Button>
              <Button
                disabled={!newSetName.trim() || createSet.isPending}
                onClick={() =>
                  createSet.mutate({
                    name: newSetName.trim(),
                    description: newSetDesc.trim() || undefined,
                    competency: newSetComp || undefined,
                    yearGroup: newSetYear || undefined,
                  })
                }
              >
                {createSet.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("custom_sets_create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete set confirmation */}
        <Dialog open={!!deleteSetId} onOpenChange={() => setDeleteSetId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("custom_sets_delete_confirm")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t("custom_sets_delete_hint")}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteSetId(null)}>{t("cancel")}</Button>
              <Button
                variant="destructive"
                disabled={deleteSet.isPending}
                onClick={() => deleteSetId && deleteSet.mutate({ setId: deleteSetId })}
              >
                {deleteSet.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("custom_sets_delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setView("list");
              setActiveSetId(null);
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            {detailLoading ? (
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <h1 className="text-xl font-bold truncate">{setDetail?.name}</h1>
                {setDetail?.description && (
                  <p className="text-sm text-muted-foreground truncate">{setDetail.description}</p>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditSet}>
              <Edit3 className="w-3.5 h-3.5" />
              {t("custom_sets_edit")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700"
              onClick={() => activeSetId && practiseSet(activeSetId)}
              disabled={!setDetail || setDetail.questions.length === 0}
            >
              <Play className="w-3.5 h-3.5" />
              {t("custom_sets_practise")}
            </Button>
          </div>
        </div>

        {/* Tags row */}
        {setDetail && (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-sm text-muted-foreground">
              {setDetail.questionCount} {t("custom_sets_questions")}
            </span>
            {setDetail.competency && <Badge variant="secondary">{setDetail.competency}</Badge>}
            {setDetail.yearGroup && (
              <Badge variant="outline">
                {YEAR_GROUPS.find((y) => y.value === setDetail.yearGroup)?.label ?? setDetail.yearGroup}
              </Badge>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mb-6">
          <Button variant="outline" className="gap-2" onClick={openAddQuestion}>
            <Plus className="w-4 h-4" />
            {t("custom_sets_add_q")}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowGenDialog(true)}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            {t("custom_sets_gen_q")}
          </Button>
        </div>

        {/* Questions list */}
        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !setDetail || setDetail.questions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{t("custom_sets_no_questions")}</p>
            <p className="text-sm mt-1">{t("custom_sets_no_questions_hint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {setDetail.questions.map((q, idx) => {
              const opts = JSON.parse(q.options) as string[];
              return (
                <Card key={q.id} className="border-border/60">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                          {q.question}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                          {opts.map((opt, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              {i === q.correctIndex ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0 inline-block" />
                              )}
                              <span className={i === q.correctIndex ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                                {opt}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          {q.competency && (
                            <Badge variant="secondary" className="text-xs py-0">{q.competency}</Badge>
                          )}
                          {q.yearGroup && (
                            <Badge variant="outline" className="text-xs py-0">
                              {YEAR_GROUPS.find((y) => y.value === q.yearGroup)?.label ?? q.yearGroup}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditQuestion(q)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteQId(q.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit set dialog */}
      <Dialog open={showEditSet} onOpenChange={setShowEditSet}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("custom_sets_edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("custom_sets_name")}</Label>
              <Input className="mt-1" value={editSetName} onChange={(e) => setEditSetName(e.target.value)} />
            </div>
            <div>
              <Label>{t("custom_sets_desc")}</Label>
              <Textarea className="mt-1" rows={2} value={editSetDesc} onChange={(e) => setEditSetDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("custom_sets_competency")}</Label>
                <Select value={editSetComp || "any"} onValueChange={(v) => setEditSetComp(v === "any" ? "" : v as Competency)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("custom_sets_any")}</SelectItem>
                    {COMPETENCY_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("custom_sets_year_group")}</Label>
                <Select value={editSetYear || "any"} onValueChange={(v) => setEditSetYear(v === "any" ? "" : v as YearGroup)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("custom_sets_any")}</SelectItem>
                    {YEAR_GROUPS.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSet(false)}>{t("cancel")}</Button>
            <Button
              disabled={!editSetName.trim() || updateSet.isPending}
              onClick={() =>
                activeSetId &&
                updateSet.mutate({
                  setId: activeSetId,
                  name: editSetName.trim(),
                  description: editSetDesc.trim() || undefined,
                  competency: (editSetComp || undefined) as Competency | undefined,
                  yearGroup: (editSetYear || undefined) as YearGroup | undefined,
                })
              }
            >
              {updateSet.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/edit question dialog */}
      <Dialog open={showQDialog} onOpenChange={(open) => { if (!open) { setShowQDialog(false); setEditingQId(null); setQForm(emptyQForm()); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQId ? t("custom_sets_edit_q") : t("custom_sets_add_q")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("custom_sets_q_text")}</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={qForm.question}
                onChange={(e) => setQForm((f) => ({ ...f, question: e.target.value }))}
                placeholder={t("custom_sets_q_text_ph")}
              />
            </div>
            {(["A", "B", "C", "D"] as const).map((letter, i) => (
              <div key={letter}>
                <Label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctIndex"
                    checked={qForm.correctIndex === i}
                    onChange={() => setQForm((f) => ({ ...f, correctIndex: i }))}
                    className="accent-green-500"
                  />
                  {t("custom_sets_option")} {letter} {qForm.correctIndex === i && <span className="text-green-500 text-xs">({t("custom_sets_correct")})</span>}
                </Label>
                <Input
                  className="mt-1"
                  value={qForm[`option${letter}` as keyof QuestionForm] as string}
                  onChange={(e) => setQForm((f) => ({ ...f, [`option${letter}`]: e.target.value }))}
                  placeholder={`${t("custom_sets_option")} ${letter}`}
                />
              </div>
            ))}
            <div>
              <Label>{t("custom_sets_explanation")}</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={qForm.explanation}
                onChange={(e) => setQForm((f) => ({ ...f, explanation: e.target.value }))}
                placeholder={t("custom_sets_explanation_ph")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("custom_sets_competency")}</Label>
                <Select value={qForm.competency || "any"} onValueChange={(v) => setQForm((f) => ({ ...f, competency: v === "any" ? "" : v as Competency }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("custom_sets_ai_detect")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("custom_sets_ai_detect")}</SelectItem>
                    {COMPETENCY_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("custom_sets_year_group")}</Label>
                <Select value={qForm.yearGroup || "any"} onValueChange={(v) => setQForm((f) => ({ ...f, yearGroup: v === "any" ? "" : v as YearGroup }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("custom_sets_any")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("custom_sets_any")}</SelectItem>
                    {YEAR_GROUPS.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowQDialog(false); setEditingQId(null); setQForm(emptyQForm()); }}>{t("cancel")}</Button>
            <Button
              disabled={addQuestion.isPending || updateQuestion.isPending}
              onClick={submitQuestion}
            >
              {(addQuestion.isPending || updateQuestion.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingQId ? t("save") : t("custom_sets_add_q")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI generate dialog */}
      <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              {t("custom_sets_gen_q")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("custom_sets_gen_topic")}</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder={t("custom_sets_gen_topic_ph")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("custom_sets_year_group")}</Label>
                <Select value={genYear} onValueChange={(v) => setGenYear(v as YearGroup)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEAR_GROUPS.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("custom_sets_gen_count")}</Label>
                <Select value={String(genCount)} onValueChange={(v) => setGenCount(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 8, 10, 15, 20].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenDialog(false)}>{t("cancel")}</Button>
            <Button
              disabled={!genTopic.trim() || generateQuestions.isPending}
              onClick={() =>
                activeSetId &&
                generateQuestions.mutate({
                  setId: activeSetId,
                  topic: genTopic.trim(),
                  yearGroup: genYear,
                  count: genCount,
                })
              }
            >
              {generateQuestions.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("custom_sets_generating")}</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />{t("custom_sets_generate")}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete question confirmation */}
      <Dialog open={!!deleteQId} onOpenChange={() => setDeleteQId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("custom_sets_delete_q_confirm")}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteQId(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteQuestion.isPending}
              onClick={() => deleteQId && deleteQuestion.mutate({ questionId: deleteQId })}
            >
              {deleteQuestion.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("custom_sets_delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
