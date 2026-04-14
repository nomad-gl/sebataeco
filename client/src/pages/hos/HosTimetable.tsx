import { useState, useMemo } from "react";
import { CalendarDays, Plus, Trash2, Save } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

const DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_CA = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"];
const DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const DEFAULT_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:00", end: "09:00" },
  2: { start: "09:00", end: "10:00" },
  3: { start: "10:00", end: "11:00" },
  4: { start: "11:30", end: "12:30" },
  5: { start: "12:30", end: "13:30" },
  6: { start: "15:00", end: "16:00" },
  7: { start: "16:00", end: "17:00" },
  8: { start: "17:00", end: "18:00" },
};

const SUBJECT_COLORS: Record<string, string> = {
  maths: "bg-blue-100 text-blue-800 border-blue-200",
  english: "bg-green-100 text-green-800 border-green-200",
  science: "bg-purple-100 text-purple-800 border-purple-200",
  history: "bg-amber-100 text-amber-800 border-amber-200",
  pe: "bg-red-100 text-red-800 border-red-200",
  art: "bg-pink-100 text-pink-800 border-pink-200",
  music: "bg-indigo-100 text-indigo-800 border-indigo-200",
  default: "bg-slate-100 text-slate-800 border-slate-200",
};

function slotColor(subject?: string | null) {
  if (!subject) return SUBJECT_COLORS.default;
  const key = Object.keys(SUBJECT_COLORS).find((k) =>
    subject.toLowerCase().includes(k)
  );
  return key ? SUBJECT_COLORS[key] : SUBJECT_COLORS.default;
}

type SlotDialogState = {
  open: boolean;
  dayOfWeek: number;
  periodNumber: number;
  existingId?: number;
  teacherId: string;
  classGroupId: string;
  subject: string;
  room: string;
  startTime: string;
  endTime: string;
};

export default function HosTimetable() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [academicYear] = useState("2025-26");

  const { data: slots = [], isLoading } = trpc.hos.getTimetable.useQuery({ academicYear });
  const { data: teachers = [] } = trpc.hos.getTeachers.useQuery();
  const { data: classGroupsList = [] } = trpc.hos.getAllClassGroups.useQuery();

  const saveSlot = trpc.hos.saveSlot.useMutation({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getQueryKey(trpc.hos.getTimetable) });
      toast.success(t("timetable_slot_saved") ?? "Slot saved");
      setDialog((d) => ({ ...d, open: false }));
    },
    onError: () => toast.error("Failed to save slot"),
  });

  const deleteSlot = trpc.hos.deleteSlot.useMutation({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getQueryKey(trpc.hos.getTimetable) });
      toast.success(t("timetable_slot_deleted") ?? "Slot deleted");
      setDialog((d) => ({ ...d, open: false }));
    },
    onError: () => toast.error("Failed to delete slot"),
  });

  const [dialog, setDialog] = useState<SlotDialogState>({
    open: false,
    dayOfWeek: 1,
    periodNumber: 1,
    teacherId: "",
    classGroupId: "",
    subject: "",
    room: "",
    startTime: "08:00",
    endTime: "09:00",
  });

  const slotMap = useMemo(() => {
    const map: Record<string, (typeof slots)[0]> = {};
    slots.forEach((s) => {
      map[`${s.dayOfWeek}-${s.periodNumber}`] = s;
    });
    return map;
  }, [slots]);

  const dayLabels = lang === "ca" ? DAYS_CA : lang === "es" ? DAYS_ES : DAYS_EN;

  function openSlotDialog(day: number, period: number) {
    const existing = slotMap[`${day}-${period}`];
    const defaults = DEFAULT_TIMES[period] ?? { start: "08:00", end: "09:00" };
    setDialog({
      open: true,
      dayOfWeek: day,
      periodNumber: period,
      existingId: existing?.id,
      teacherId: existing?.teacherId?.toString() ?? "",
      classGroupId: existing?.classGroupId?.toString() ?? "",
      subject: existing?.subject ?? "",
      room: existing?.room ?? "",
      startTime: existing?.startTime ?? defaults.start,
      endTime: existing?.endTime ?? defaults.end,
    });
  }

  function handleSave() {
    saveSlot.mutate({
      id: dialog.existingId,
      dayOfWeek: dialog.dayOfWeek,
      periodNumber: dialog.periodNumber,
      startTime: dialog.startTime,
      endTime: dialog.endTime,
      teacherId: dialog.teacherId ? parseInt(dialog.teacherId) : null,
      classGroupId: dialog.classGroupId ? parseInt(dialog.classGroupId) : null,
      subject: dialog.subject || null,
      room: dialog.room || null,
      academicYear,
    });
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("hos_timetable") ?? "Timetable"}</h1>
              <p className="text-sm text-muted-foreground">
                {t("hos_timetable_desc") ?? "Weekly class schedule"} — {academicYear}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {slots.length} {t("timetable_slots_count") ?? "slots configured"}
          </Badge>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading timetable…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-3 text-left font-semibold text-muted-foreground w-24 border-b border-r border-border">
                    {t("timetable_period") ?? "Period"}
                  </th>
                  {dayLabels.map((day, i) => (
                    <th
                      key={i}
                      className="p-3 text-center font-semibold border-b border-r border-border last:border-r-0 min-w-[140px]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => {
                  const defaults = DEFAULT_TIMES[period];
                  return (
                    <tr key={period} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 border-r border-b border-border bg-muted/30">
                        <div className="font-semibold text-xs text-muted-foreground">P{period}</div>
                        {defaults && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {defaults.start}–{defaults.end}
                          </div>
                        )}
                      </td>
                      {[1, 2, 3, 4, 5].map((day) => {
                        const slot = slotMap[`${day}-${period}`];
                        return (
                          <td
                            key={day}
                            className="p-2 border-r border-b border-border last:border-r-0 align-top cursor-pointer group h-16"
                            onClick={() => openSlotDialog(day, period)}
                          >
                            {slot ? (
                              <div
                                className={`rounded-lg border px-2 py-1.5 text-xs font-medium h-full ${slotColor(slot.subject)} transition-all group-hover:shadow-md`}
                              >
                                {slot.subject && (
                                  <div className="font-semibold truncate">{slot.subject}</div>
                                )}
                                {slot.classGroupName && (
                                  <div className="truncate opacity-80">{slot.classGroupName}</div>
                                )}
                                {slot.teacherName && (
                                  <div className="truncate opacity-70 mt-0.5 text-[10px]">{slot.teacherName}</div>
                                )}
                                {slot.room && (
                                  <div className="truncate opacity-60 mt-0.5 text-[10px]">🏫 {slot.room}</div>
                                )}
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-60 transition-opacity rounded-lg border-2 border-dashed border-muted-foreground/30">
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t("timetable_legend") ?? "Click any cell to assign or edit a slot. Colour-coded by subject."}
        </p>
      </div>

      {/* Slot Edit Dialog */}
      <Dialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.existingId
                ? (t("timetable_edit_slot") ?? "Edit Slot")
                : (t("timetable_add_slot") ?? "Add Slot")}
              {" — "}
              {dayLabels[dialog.dayOfWeek - 1]}, P{dialog.periodNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("timetable_start_time") ?? "Start time"}</Label>
                <Input
                  type="time"
                  value={dialog.startTime}
                  onChange={(e) => setDialog((d) => ({ ...d, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("timetable_end_time") ?? "End time"}</Label>
                <Input
                  type="time"
                  value={dialog.endTime}
                  onChange={(e) => setDialog((d) => ({ ...d, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("timetable_subject") ?? "Subject"}</Label>
              <Input
                placeholder={t("timetable_subject_placeholder") ?? "e.g. Maths, English, Science…"}
                value={dialog.subject}
                onChange={(e) => setDialog((d) => ({ ...d, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("timetable_class_group") ?? "Class group"}</Label>
              <Select
                value={dialog.classGroupId || "none"}
                onValueChange={(v) => setDialog((d) => ({ ...d, classGroupId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("timetable_select_group") ?? "Select class group…"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— {t("timetable_unassigned") ?? "Unassigned"} —</SelectItem>
                  {classGroupsList.map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.className} ({g.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("timetable_teacher") ?? "Teacher"}</Label>
              <Select
                value={dialog.teacherId || "none"}
                onValueChange={(v) => setDialog((d) => ({ ...d, teacherId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("timetable_select_teacher") ?? "Select teacher…"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— {t("timetable_unassigned") ?? "Unassigned"} —</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                      {teacher.name ?? teacher.email ?? `User ${teacher.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("timetable_room") ?? "Room"}</Label>
              <Input
                placeholder={t("timetable_room_placeholder") ?? "e.g. Room 12, Lab A…"}
                value={dialog.room}
                onChange={(e) => setDialog((d) => ({ ...d, room: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {dialog.existingId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteSlot.mutate({ id: dialog.existingId! })}
                disabled={deleteSlot.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t("timetable_delete_slot") ?? "Delete"}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setDialog((d) => ({ ...d, open: false }))}>
                {t("cancel") ?? "Cancel"}
              </Button>
              <Button onClick={handleSave} disabled={saveSlot.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {t("save") ?? "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
