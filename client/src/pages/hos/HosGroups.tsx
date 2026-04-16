import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import {
  Users, Plus, Pencil, Trash2, Loader2, GraduationCap, UserCheck, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const YEAR_GROUP_LABELS: Record<string, string> = {
  junior: "Junior (Yr 3–4)",
  primary: "Primary (Yr 5–6)",
  secondary: "Secondary (Yr 7–10)",
};

const YEAR_GROUP_COLORS: Record<string, string> = {
  junior: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  primary: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  secondary: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

type GroupForm = {
  id?: number;
  className: string;
  yearGroup: "junior" | "primary" | "secondary";
  academicYear: string;
  formTutorId: number | null;
  studentCount: number;
  notes: string;
};

const EMPTY_FORM: GroupForm = {
  className: "",
  yearGroup: "secondary",
  academicYear: "2025-26",
  formTutorId: null,
  studentCount: 0,
  notes: "",
};

export default function HosGroups() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin" && user.role !== "head_of_study") {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  const [academicYear] = useState("2025-26");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: groups = [], isLoading } = trpc.hos.getGroups.useQuery({ academicYear });
  const { data: teachers = [] } = trpc.hos.getTeachers.useQuery();

  const upsertMutation = trpc.hos.upsertGroup.useMutation({
    onSuccess: () => {
      utils.hos.getGroups.invalidate();
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast.success(form.id ? t("hos_group_updated") : t("hos_group_created"));
    },
    onError: () => toast.error(t("hos_group_error")),
  });

  const deleteMutation = trpc.hos.deleteGroup.useMutation({
    onSuccess: () => {
      utils.hos.getGroups.invalidate();
      setDeleteDialogOpen(false);
      setDeletingId(null);
      toast.success(t("hos_group_deleted"));
    },
    onError: () => toast.error(t("hos_group_error")),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(g: typeof groups[0]) {
    setForm({
      id: g.id,
      className: g.className,
      yearGroup: (g.yearGroup ?? "secondary") as "junior" | "primary" | "secondary",
      academicYear: g.academicYear ?? "2025-26",
      formTutorId: g.formTutorId ?? null,
      studentCount: g.studentCount ?? 0,
      notes: g.notes ?? "",
    });
    setDialogOpen(true);
  }

  function openDelete(id: number) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function handleSave() {
    if (!form.className.trim()) { toast.error(t("hos_group_name_required")); return; }
    upsertMutation.mutate({
      id: form.id,
      className: form.className.trim(),
      yearGroup: form.yearGroup,
      academicYear: form.academicYear,
      formTutorId: form.formTutorId,
      studentCount: form.studentCount,
      notes: form.notes || null,
    });
  }

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin" && user?.role !== "head_of_study") return null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("hos_groups")}</h1>
              <p className="text-sm text-muted-foreground">{t("hos_groups_desc")}</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("hos_group_add")}
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(["junior", "primary", "secondary"] as const).map((yg) => {
            const count = groups.filter((g) => (g.yearGroup ?? "secondary") === yg).length;
            return (
              <Card key={yg} className="text-center py-4">
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{YEAR_GROUP_LABELS[yg]}</p>
              </Card>
            );
          })}
          <Card className="text-center py-4">
            <p className="text-2xl font-bold text-foreground">
              {groups.reduce((s, g) => s + (g.studentCount ?? 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t("hos_total_students")}</p>
          </Card>
        </div>

        {/* Groups table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              {t("hos_groups_list")} — {academicYear}
            </CardTitle>
            <CardDescription>{t("hos_groups_list_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">{t("hos_no_groups")}</p>
                <Button variant="outline" onClick={openCreate} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t("hos_group_add")}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">{t("hos_group_name")}</th>
                      <th className="text-left py-2 pr-4 font-medium">{t("hos_year_group")}</th>
                      <th className="text-left py-2 pr-4 font-medium">{t("hos_form_tutor")}</th>
                      <th className="text-left py-2 pr-4 font-medium">{t("hos_student_count")}</th>
                      <th className="text-left py-2 pr-4 font-medium">{t("hos_notes")}</th>
                      <th className="text-right py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-semibold text-foreground">{g.className}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${YEAR_GROUP_COLORS[g.yearGroup ?? "secondary"]}`}>
                            {YEAR_GROUP_LABELS[g.yearGroup ?? "secondary"]}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {g.formTutorName ? (
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-primary" />
                              {g.formTutorName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 italic text-xs">{t("hos_no_tutor")}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-foreground font-medium">{g.studentCount ?? 0}</td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs max-w-[200px] truncate">
                          {g.notes || "—"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Group video room button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#003082] hover:text-[#003082]"
                              onClick={() =>
                                window.open(
                                  `https://meet.jit.si/seba-group-${g.id}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              title={t("hos_video_room")}
                            >
                              <Video className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEdit(g)}
                              title={t("hos_edit_group")}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => openDelete(g.id)}
                              title={t("hos_delete_group")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? t("hos_edit_group") : t("hos_group_add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("hos_group_name")} *</Label>
              <Input
                value={form.className}
                onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                placeholder="e.g. 1r ESO A"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("hos_year_group")}</Label>
                <Select
                  value={form.yearGroup}
                  onValueChange={(v) => setForm((f) => ({ ...f, yearGroup: v as "junior" | "primary" | "secondary" }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="junior">Junior (Yr 3–4)</SelectItem>
                    <SelectItem value="primary">Primary (Yr 5–6)</SelectItem>
                    <SelectItem value="secondary">Secondary (Yr 7–10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("hos_student_count")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={form.studentCount}
                  onChange={(e) => setForm((f) => ({ ...f, studentCount: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("hos_form_tutor")}</Label>
              <Select
                value={form.formTutorId != null ? String(form.formTutorId) : "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, formTutorId: v === "none" ? null : Number(v) }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("hos_no_tutor")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("hos_no_tutor")}</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={String(teacher.id)}>
                      {teacher.name ?? teacher.email ?? `User #${teacher.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("hos_notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("hos_notes_placeholder")}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("hos_delete_group_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">{t("hos_delete_group_confirm_desc")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate({ id: deletingId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
