/**
 * IndividualPlans.tsx
 * Combined page for Individual Learning Plans (ILP) and Individual Lesson Plans.
 * Teachers can generate, view, edit, and print/PDF both plan types.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  BookOpen,
  GraduationCap,
  Plus,
  Trash2,
  Edit3,
  Printer,
  Sparkles,
  ChevronLeft,
  User,
  Clock,
  FileText,
  Loader2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Language = "en" | "es" | "ca";
type ILPStatus = "draft" | "active" | "completed" | "archived";
type LessonStatus = "draft" | "ready" | "delivered";

const YEAR_GROUPS = [
  "Infantil 3", "Infantil 4", "Infantil 5",
  "1r Primària", "2n Primària", "3r Primària", "4t Primària", "5è Primària", "6è Primària",
  "1r ESO", "2n ESO", "3r ESO", "4t ESO",
  "1r Batxillerat", "2n Batxillerat",
];

const SUBJECTS = [
  "Matemàtiques", "Llengua Catalana", "Llengua Castellana", "Anglès",
  "Ciències Naturals", "Ciències Socials", "Educació Física", "Música",
  "Arts Visuals", "Tecnologia", "Filosofia", "Educació en Valors",
  "Cross-curricular", "Other",
];

const COMPETENCIES = [
  "CCL – Linguistic", "STEM – Mathematical/Scientific", "CD – Digital",
  "CPSAA – Personal/Social", "CC – Citizenship", "CE – Entrepreneurial",
  "CCEC – Cultural/Artistic", "All eight competencies",
];

const ILP_STATUS_COLOURS: Record<ILPStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

const LESSON_STATUS_COLOURS: Record<LessonStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  ready: "bg-amber-100 text-amber-700",
  delivered: "bg-green-100 text-green-700",
};

// ─── Print helper ──────────────────────────────────────────────────────────────

function printPlan(title: string, content: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>${title}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
      h1 { font-size: 1.6rem; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; color: #1e3a5f; }
      h2 { font-size: 1.2rem; color: #1e3a5f; margin-top: 1.5rem; }
      h3 { font-size: 1rem; color: #374151; }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
      th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
      th { background: #f3f4f6; }
      code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
      @media print { body { margin: 20px; } }
    </style>
  </head><body>
    <h1>${title}</h1>
    <div id="content"></div>
    <script>
      // Simple markdown-to-HTML for print
      const md = ${JSON.stringify(content)};
      const html = md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\\/li>)/gs, '<ul>$1</ul>')
        .replace(/\\n\\n/g, '</p><p>')
        .replace(/^(?!<[hul])/gm, '<p>')
        .replace(/(?<![>])$/gm, '</p>');
      document.getElementById('content').innerHTML = html;
      window.onload = () => window.print();
    </script>
  </body></html>`);
  win.document.close();
}

// ─── ILP Form ──────────────────────────────────────────────────────────────────

interface ILPFormData {
  studentName: string;
  yearGroup: string;
  subject: string;
  competencies: string;
  duration: string;
  studentContext: string;
  learningGoals: string;
  planContent: string;
  language: Language;
  status: ILPStatus;
}

const defaultILPForm = (): ILPFormData => ({
  studentName: "",
  yearGroup: "",
  subject: "",
  competencies: "",
  duration: "One term",
  studentContext: "",
  learningGoals: "",
  planContent: "",
  language: "en",
  status: "draft",
});

// ─── Lesson Plan Form ──────────────────────────────────────────────────────────

interface LessonFormData {
  studentName: string;
  yearGroup: string;
  subject: string;
  topic: string;
  competencies: string;
  durationMinutes: number;
  studentContext: string;
  objectives: string;
  planContent: string;
  language: Language;
  status: LessonStatus;
}

const defaultLessonForm = (): LessonFormData => ({
  studentName: "",
  yearGroup: "",
  subject: "",
  topic: "",
  competencies: "",
  durationMinutes: 60,
  studentContext: "",
  objectives: "",
  planContent: "",
  language: "en",
  status: "draft",
});

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IndividualPlans() {
  const { user } = useAuth();

  const utils = trpc.useUtils();

  // ── ILP state ──
  const [ilpView, setIlpView] = useState<"list" | "form" | "detail">("list");
  const [ilpForm, setIlpForm] = useState<ILPFormData>(defaultILPForm());
  const [editingIlpId, setEditingIlpId] = useState<number | null>(null);
  const [viewingIlpId, setViewingIlpId] = useState<number | null>(null);
  const [deleteIlpId, setDeleteIlpId] = useState<number | null>(null);
  const [ilpGenerating, setIlpGenerating] = useState(false);

  // ── Lesson Plan state ──
  const [lpView, setLpView] = useState<"list" | "form" | "detail">("list");
  const [lpForm, setLpForm] = useState<LessonFormData>(defaultLessonForm());
  const [editingLpId, setEditingLpId] = useState<number | null>(null);
  const [viewingLpId, setViewingLpId] = useState<number | null>(null);
  const [deleteLpId, setDeleteLpId] = useState<number | null>(null);
  const [lpGenerating, setLpGenerating] = useState(false);

  // ── Queries ──
  const ilpList = trpc.ilp.list.useQuery();
  const lpList = trpc.lessonPlan.list.useQuery();
  const viewingIlp = trpc.ilp.get.useQuery(
    { id: viewingIlpId! },
    { enabled: viewingIlpId !== null }
  );
  const viewingLp = trpc.lessonPlan.get.useQuery(
    { id: viewingLpId! },
    { enabled: viewingLpId !== null }
  );

  // ── ILP mutations ──
  const createIlp = trpc.ilp.create.useMutation({
    onSuccess: () => { utils.ilp.list.invalidate(); setIlpView("list"); toast.success("Learning plan saved."); },
  });
  const updateIlp = trpc.ilp.update.useMutation({
    onSuccess: () => { utils.ilp.list.invalidate(); utils.ilp.get.invalidate(); setIlpView("list"); toast.success("Learning plan updated."); },
  });
  const deleteIlp = trpc.ilp.delete.useMutation({
    onSuccess: () => { utils.ilp.list.invalidate(); setDeleteIlpId(null); toast.success("Learning plan deleted."); },
  });
  const generateIlp = trpc.ilp.generateAI.useMutation();

  // ── Lesson Plan mutations ──
  const createLp = trpc.lessonPlan.create.useMutation({
    onSuccess: () => { utils.lessonPlan.list.invalidate(); setLpView("list"); toast.success("Lesson plan saved."); },
  });
  const updateLp = trpc.lessonPlan.update.useMutation({
    onSuccess: () => { utils.lessonPlan.list.invalidate(); utils.lessonPlan.get.invalidate(); setLpView("list"); toast.success("Lesson plan updated."); },
  });
  const deleteLp = trpc.lessonPlan.delete.useMutation({
    onSuccess: () => { utils.lessonPlan.list.invalidate(); setDeleteLpId(null); toast.success("Lesson plan deleted."); },
  });
  const generateLp = trpc.lessonPlan.generateAI.useMutation();

  if (!user) return null;

  // ─── ILP handlers ──────────────────────────────────────────────────────────

  async function handleGenerateIlp() {
    if (!ilpForm.studentName.trim()) {
      toast.error("Student name is required.");
      return;
    }
    setIlpGenerating(true);
    try {
      const result = await generateIlp.mutateAsync({
        studentName: ilpForm.studentName,
        yearGroup: ilpForm.yearGroup || undefined,
        subject: ilpForm.subject || undefined,
        competencies: ilpForm.competencies || undefined,
        duration: ilpForm.duration || undefined,
        studentContext: ilpForm.studentContext || undefined,
        learningGoals: ilpForm.learningGoals || undefined,
        language: ilpForm.language,
      });
      const generated = result.planContent as string;
      setIlpForm(f => ({ ...f, planContent: generated }));
      toast.success("Plan generated — review and save.");
    } catch {
      toast.error("Generation failed. Please try again.");
    } finally {
      setIlpGenerating(false);
    }
  }

  async function handleSaveIlp() {
    if (!ilpForm.studentName.trim()) {
      toast.error("Student name is required.");
      return;
    }
    if (editingIlpId !== null) {
      await updateIlp.mutateAsync({ id: editingIlpId, ...ilpForm });
    } else {
      await createIlp.mutateAsync(ilpForm);
    }
  }

  function openEditIlp(plan: any) {
    setIlpForm({
      studentName: plan.studentName,
      yearGroup: plan.yearGroup ?? "",
      subject: plan.subject ?? "",
      competencies: plan.competencies ?? "",
      duration: plan.duration ?? "One term",
      studentContext: plan.studentContext ?? "",
      learningGoals: plan.learningGoals ?? "",
      planContent: plan.planContent ?? "",
      language: (plan.language as Language) ?? "en",
      status: (plan.status as ILPStatus) ?? "draft",
    });
    setEditingIlpId(plan.id);
    setIlpView("form");
  }

  // ─── Lesson Plan handlers ──────────────────────────────────────────────────

  async function handleGenerateLp() {
    if (!lpForm.studentName.trim()) {
      toast.error("Student name is required.");
      return;
    }
    setLpGenerating(true);
    try {
      const result = await generateLp.mutateAsync({
        studentName: lpForm.studentName,
        yearGroup: lpForm.yearGroup || undefined,
        subject: lpForm.subject || undefined,
        topic: lpForm.topic || undefined,
        competencies: lpForm.competencies || undefined,
        durationMinutes: lpForm.durationMinutes,
        studentContext: lpForm.studentContext || undefined,
        objectives: lpForm.objectives || undefined,
        language: lpForm.language,
      });
      const generatedLesson = result.planContent as string;
      setLpForm(f => ({ ...f, planContent: generatedLesson }));
      toast.success("Lesson plan generated — review and save.");
    } catch {
      toast.error("Generation failed. Please try again.");
    } finally {
      setLpGenerating(false);
    }
  }

  async function handleSaveLp() {
    if (!lpForm.studentName.trim()) {
      toast.error("Student name is required.");
      return;
    }
    if (editingLpId !== null) {
      await updateLp.mutateAsync({ id: editingLpId, ...lpForm });
    } else {
      await createLp.mutateAsync(lpForm);
    }
  }

  function openEditLp(plan: any) {
    setLpForm({
      studentName: plan.studentName,
      yearGroup: plan.yearGroup ?? "",
      subject: plan.subject ?? "",
      topic: plan.topic ?? "",
      competencies: plan.competencies ?? "",
      durationMinutes: plan.durationMinutes ?? 60,
      studentContext: plan.studentContext ?? "",
      objectives: plan.objectives ?? "",
      planContent: plan.planContent ?? "",
      language: (plan.language as Language) ?? "en",
      status: (plan.status as LessonStatus) ?? "draft",
    });
    setEditingLpId(plan.id);
    setLpView("form");
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-primary" />
            Individual Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate AI-powered Individual Learning Plans and Individual Lesson Plans tailored to each student.
          </p>
        </div>

        <Tabs defaultValue="ilp" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="ilp" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Learning Plans (ILP)
            </TabsTrigger>
            <TabsTrigger value="lesson" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Lesson Plans
            </TabsTrigger>
          </TabsList>

          {/* ── ILP Tab ── */}
          <TabsContent value="ilp">
            {ilpView === "list" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Individual Learning Plans</h2>
                  <Button onClick={() => { setIlpForm(defaultILPForm()); setEditingIlpId(null); setIlpView("form"); }}>
                    <Plus className="w-4 h-4 mr-2" /> New ILP
                  </Button>
                </div>
                {ilpList.isLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
                ) : ilpList.data?.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No learning plans yet</p>
                    <p className="text-sm mt-1">Create your first AI-generated ILP for a student.</p>
                    <Button className="mt-4" onClick={() => { setIlpForm(defaultILPForm()); setEditingIlpId(null); setIlpView("form"); }}>
                      <Plus className="w-4 h-4 mr-2" /> Create ILP
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {ilpList.data?.map(plan => (
                      <Card key={plan.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setViewingIlpId(plan.id); setIlpView("detail"); }}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base flex items-center gap-2">
                              <User className="w-4 h-4 text-primary flex-shrink-0" />
                              {plan.studentName}
                            </CardTitle>
                            <Badge className={ILP_STATUS_COLOURS[plan.status as ILPStatus] + " text-xs"}>
                              {plan.status}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs mt-1">
                            {[plan.yearGroup, plan.subject, plan.duration].filter(Boolean).join(" · ")}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {plan.learningGoals || plan.studentContext || "No context provided."}
                          </p>
                          <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => openEditIlp(plan)}>
                              <Edit3 className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleteIlpId(plan.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {ilpView === "form" && (
              <div className="max-w-3xl">
                <Button variant="ghost" className="mb-4" onClick={() => setIlpView("list")}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to list
                </Button>
                <Card>
                  <CardHeader>
                    <CardTitle>{editingIlpId ? "Edit Learning Plan" : "New Individual Learning Plan"}</CardTitle>
                    <CardDescription>Fill in the student details, then generate or write the plan content.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Student Name *</Label>
                        <Input value={ilpForm.studentName} onChange={e => setIlpForm(f => ({ ...f, studentName: e.target.value }))} placeholder="e.g. Maria García" />
                      </div>
                      <div>
                        <Label>Year Group</Label>
                        <Select value={ilpForm.yearGroup} onValueChange={v => setIlpForm(f => ({ ...f, yearGroup: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select year group" /></SelectTrigger>
                          <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Subject / Area</Label>
                        <Select value={ilpForm.subject} onValueChange={v => setIlpForm(f => ({ ...f, subject: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                          <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>LOMLOE Competencies</Label>
                        <Select value={ilpForm.competencies} onValueChange={v => setIlpForm(f => ({ ...f, competencies: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select competency" /></SelectTrigger>
                          <SelectContent>{COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Plan Duration</Label>
                        <Input value={ilpForm.duration} onChange={e => setIlpForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. One term, 4 weeks" />
                      </div>
                      <div>
                        <Label>Language</Label>
                        <Select value={ilpForm.language} onValueChange={v => setIlpForm(f => ({ ...f, language: v as Language }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="ca">Català</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={ilpForm.status} onValueChange={v => setIlpForm(f => ({ ...f, status: v as ILPStatus }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Student Context / Current Level</Label>
                      <Textarea rows={3} value={ilpForm.studentContext} onChange={e => setIlpForm(f => ({ ...f, studentContext: e.target.value }))} placeholder="Describe the student's current level, strengths, challenges, learning style, any additional needs..." />
                    </div>
                    <div>
                      <Label>Learning Goals</Label>
                      <Textarea rows={3} value={ilpForm.learningGoals} onChange={e => setIlpForm(f => ({ ...f, learningGoals: e.target.value }))} placeholder="What do you want this student to achieve by the end of this plan?" />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleGenerateIlp} disabled={ilpGenerating} className="flex-1">
                        {ilpGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>}
                      </Button>
                    </div>

                    {ilpForm.planContent && (
                      <div>
                        <Label>Plan Content (editable)</Label>
                        <Textarea rows={20} value={ilpForm.planContent} onChange={e => setIlpForm(f => ({ ...f, planContent: e.target.value }))} className="font-mono text-sm" />
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleSaveIlp} disabled={createIlp.isPending || updateIlp.isPending} className="flex-1">
                        {createIlp.isPending || updateIlp.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingIlpId ? "Update Plan" : "Save Plan"}
                      </Button>
                      {ilpForm.planContent && (
                        <Button variant="outline" onClick={() => printPlan(`ILP — ${ilpForm.studentName}`, ilpForm.planContent)}>
                          <Printer className="w-4 h-4 mr-2" /> Print / PDF
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setIlpView("list")}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {ilpView === "detail" && viewingIlpId !== null && (
              <div className="max-w-3xl">
                <Button variant="ghost" className="mb-4" onClick={() => setIlpView("list")}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to list
                </Button>
                {viewingIlp.isLoading ? (
                  <Skeleton className="h-96 w-full" />
                ) : viewingIlp.data ? (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" />
                            {viewingIlp.data.studentName}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {[viewingIlp.data.yearGroup, viewingIlp.data.subject, viewingIlp.data.duration].filter(Boolean).join(" · ")}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditIlp(viewingIlp.data)}>
                            <Edit3 className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          {viewingIlp.data.planContent && (
                            <Button size="sm" variant="outline" onClick={() => printPlan(`ILP — ${viewingIlp.data!.studentName}`, viewingIlp.data!.planContent ?? "")}>
                              <Printer className="w-4 h-4 mr-1" /> Print
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {viewingIlp.data.planContent ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <Streamdown>{viewingIlp.data.planContent}</Streamdown>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No plan content yet. Edit to generate or write content.</p>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )}
          </TabsContent>

          {/* ── Lesson Plan Tab ── */}
          <TabsContent value="lesson">
            {lpView === "list" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Individual Lesson Plans</h2>
                  <Button onClick={() => { setLpForm(defaultLessonForm()); setEditingLpId(null); setLpView("form"); }}>
                    <Plus className="w-4 h-4 mr-2" /> New Lesson Plan
                  </Button>
                </div>
                {lpList.isLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
                ) : lpList.data?.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No lesson plans yet</p>
                    <p className="text-sm mt-1">Create your first AI-generated lesson plan for a student.</p>
                    <Button className="mt-4" onClick={() => { setLpForm(defaultLessonForm()); setEditingLpId(null); setLpView("form"); }}>
                      <Plus className="w-4 h-4 mr-2" /> Create Lesson Plan
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {lpList.data?.map(plan => (
                      <Card key={plan.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setViewingLpId(plan.id); setLpView("detail"); }}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base flex items-center gap-2">
                              <User className="w-4 h-4 text-primary flex-shrink-0" />
                              {plan.studentName}
                            </CardTitle>
                            <Badge className={LESSON_STATUS_COLOURS[plan.status as LessonStatus] + " text-xs"}>
                              {plan.status}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs mt-1">
                            {[plan.subject, plan.topic, plan.durationMinutes ? `${plan.durationMinutes} min` : null].filter(Boolean).join(" · ")}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {plan.objectives || plan.studentContext || "No context provided."}
                          </p>
                          <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => openEditLp(plan)}>
                              <Edit3 className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleteLpId(plan.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {lpView === "form" && (
              <div className="max-w-3xl">
                <Button variant="ghost" className="mb-4" onClick={() => setLpView("list")}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to list
                </Button>
                <Card>
                  <CardHeader>
                    <CardTitle>{editingLpId ? "Edit Lesson Plan" : "New Individual Lesson Plan"}</CardTitle>
                    <CardDescription>Fill in the lesson details, then generate or write the plan content.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Student Name *</Label>
                        <Input value={lpForm.studentName} onChange={e => setLpForm(f => ({ ...f, studentName: e.target.value }))} placeholder="e.g. Marc Puig" />
                      </div>
                      <div>
                        <Label>Year Group</Label>
                        <Select value={lpForm.yearGroup} onValueChange={v => setLpForm(f => ({ ...f, yearGroup: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select year group" /></SelectTrigger>
                          <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Subject</Label>
                        <Select value={lpForm.subject} onValueChange={v => setLpForm(f => ({ ...f, subject: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                          <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Lesson Topic</Label>
                        <Input value={lpForm.topic} onChange={e => setLpForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Fractions — adding unlike denominators" />
                      </div>
                      <div>
                        <Label>LOMLOE Competencies</Label>
                        <Select value={lpForm.competencies} onValueChange={v => setLpForm(f => ({ ...f, competencies: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select competency" /></SelectTrigger>
                          <SelectContent>{COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Duration (minutes)</Label>
                        <Input type="number" min={5} max={480} value={lpForm.durationMinutes} onChange={e => setLpForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 60 }))} />
                      </div>
                      <div>
                        <Label>Language</Label>
                        <Select value={lpForm.language} onValueChange={v => setLpForm(f => ({ ...f, language: v as Language }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="ca">Català</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={lpForm.status} onValueChange={v => setLpForm(f => ({ ...f, status: v as LessonStatus }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Student Context / Differentiation Needs</Label>
                      <Textarea rows={3} value={lpForm.studentContext} onChange={e => setLpForm(f => ({ ...f, studentContext: e.target.value }))} placeholder="Describe any specific needs, learning style, or adaptations required for this student..." />
                    </div>
                    <div>
                      <Label>Learning Objectives</Label>
                      <Textarea rows={3} value={lpForm.objectives} onChange={e => setLpForm(f => ({ ...f, objectives: e.target.value }))} placeholder="What should the student be able to do by the end of this lesson?" />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleGenerateLp} disabled={lpGenerating} className="flex-1">
                        {lpGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>}
                      </Button>
                    </div>

                    {lpForm.planContent && (
                      <div>
                        <Label>Lesson Plan Content (editable)</Label>
                        <Textarea rows={20} value={lpForm.planContent} onChange={e => setLpForm(f => ({ ...f, planContent: e.target.value }))} className="font-mono text-sm" />
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleSaveLp} disabled={createLp.isPending || updateLp.isPending} className="flex-1">
                        {createLp.isPending || updateLp.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingLpId ? "Update Plan" : "Save Plan"}
                      </Button>
                      {lpForm.planContent && (
                        <Button variant="outline" onClick={() => printPlan(`Lesson Plan — ${lpForm.studentName}: ${lpForm.topic}`, lpForm.planContent)}>
                          <Printer className="w-4 h-4 mr-2" /> Print / PDF
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setLpView("list")}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {lpView === "detail" && viewingLpId !== null && (
              <div className="max-w-3xl">
                <Button variant="ghost" className="mb-4" onClick={() => setLpView("list")}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to list
                </Button>
                {viewingLp.isLoading ? (
                  <Skeleton className="h-96 w-full" />
                ) : viewingLp.data ? (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" />
                            {viewingLp.data.studentName}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {[viewingLp.data.subject, viewingLp.data.topic, viewingLp.data.durationMinutes ? `${viewingLp.data.durationMinutes} min` : null].filter(Boolean).join(" · ")}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditLp(viewingLp.data)}>
                            <Edit3 className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          {viewingLp.data.planContent && (
                            <Button size="sm" variant="outline" onClick={() => printPlan(`Lesson Plan — ${viewingLp.data!.studentName}: ${viewingLp.data!.topic ?? ""}`, viewingLp.data!.planContent ?? "")}>
                              <Printer className="w-4 h-4 mr-1" /> Print
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {viewingLp.data.planContent ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <Streamdown>{viewingLp.data.planContent}</Streamdown>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No plan content yet. Edit to generate or write content.</p>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete ILP confirmation */}
      <AlertDialog open={deleteIlpId !== null} onOpenChange={open => !open && setDeleteIlpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Learning Plan?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The plan will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteIlpId !== null && deleteIlp.mutate({ id: deleteIlpId })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Lesson Plan confirmation */}
      <AlertDialog open={deleteLpId !== null} onOpenChange={open => !open && setDeleteLpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson Plan?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The plan will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteLpId !== null && deleteLp.mutate({ id: deleteLpId })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
