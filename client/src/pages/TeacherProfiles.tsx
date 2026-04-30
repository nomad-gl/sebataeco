/**
 * TeacherProfiles page — /director/teacher-profiles
 * Shows teaching hours, contracted hours, prep hours, holiday balance, and free periods per teacher.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, User, Clock, Calendar, BookOpen, Coffee, ChevronRight, Sun, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function HoursBadge({ hours, label, color }: { hours: number; label: string; color: string }) {
  return (
    <div className={`rounded-lg p-3 ${color} text-center`}>
      <div className="text-2xl font-bold">{hours.toFixed(1)}</div>
      <div className="text-xs mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function HolidayBar({ taken, owed, entitlement }: { taken: number; owed: number; entitlement: number }) {
  const totalEntitlement = entitlement + owed;
  const pct = totalEntitlement > 0 ? Math.min(100, (taken / totalEntitlement) * 100) : 0;
  const balance = totalEntitlement - taken;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{taken.toFixed(1)}h taken</span>
        <span>{balance.toFixed(1)}h remaining</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Entitlement: {entitlement.toFixed(1)}h</span>
        {owed > 0 && <span className="text-amber-600 font-medium">+{owed.toFixed(1)}h owed</span>}
      </div>
    </div>
  );
}

function WeeklyGrid({ grid }: { grid: Record<number, Array<{ subject: string; startTime: string; endTime: string; classGroup: string | null; hours: number }>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {[1, 2, 3, 4, 5].map(d => (
              <th key={d} className="text-center font-medium text-muted-foreground py-1.5 px-2 border-b border-border w-1/5">
                {DAY_NAMES[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            {[1, 2, 3, 4, 5].map(d => (
              <td key={d} className="px-1 py-1 border-r border-border last:border-r-0">
                <div className="space-y-1">
                  {(grid[d] ?? []).length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-2 italic">Free</div>
                  ) : (
                    (grid[d] ?? []).map((s, i) => (
                      <div key={i} className={`rounded p-1.5 text-xs ${/free|prep|planning/i.test(s.subject) ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-primary/10 border border-primary/20 text-foreground"}`}>
                        <div className="font-medium truncate">{s.subject}</div>
                        <div className="text-muted-foreground">{s.startTime}–{s.endTime}</div>
                        {s.classGroup && <div className="text-muted-foreground truncate">{s.classGroup}</div>}
                      </div>
                    ))
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ProfileDetail({ profileId, onBack }: { profileId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: stats, isLoading } = trpc.teacherProfile.getProfileStats.useQuery({ teacherProfileId: profileId });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: "", type: "taken" as "taken" | "owed", hours: "7.5", notes: "" });
  const [deleteHolidayId, setDeleteHolidayId] = useState<number | null>(null);

  const addHolidayMutation = trpc.teacherProfile.addHolidayRecord.useMutation({
    onSuccess: () => {
      utils.teacherProfile.getProfileStats.invalidate({ teacherProfileId: profileId });
      setShowAddHoliday(false);
      setHolidayForm({ date: "", type: "taken", hours: "7.5", notes: "" });
      toast.success("Holiday record added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteHolidayMutation = trpc.teacherProfile.deleteHolidayRecord.useMutation({
    onSuccess: () => {
      utils.teacherProfile.getProfileStats.invalidate({ teacherProfileId: profileId });
      setDeleteHolidayId(null);
      toast.success("Holiday record deleted");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!stats) return null;

  const { profile, weekly, monthly, annual, semesterStats, holiday, weeklyGrid, freePeriodSessions } = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-white/70 hover:text-white hover:bg-white/10">
          ← Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-blue-300" />
            {profile.name}
          </h1>
          {profile.email && <p className="text-blue-200 text-sm">{profile.email}</p>}
        </div>
      </div>

      {/* Hours Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/10 border-white/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-blue-200 font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Weekly
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <HoursBadge hours={weekly.teachingHours} label="Teaching" color="bg-blue-500/20 text-blue-100" />
              <HoursBadge hours={weekly.contractedHours} label="Contracted" color="bg-purple-500/20 text-purple-100" />
              <HoursBadge hours={weekly.prepHours} label="Prep" color="bg-teal-500/20 text-teal-100" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-blue-200 font-medium flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Monthly
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <HoursBadge hours={monthly.teachingHours} label="Teaching" color="bg-blue-500/20 text-blue-100" />
              <HoursBadge hours={monthly.contractedHours} label="Contracted" color="bg-purple-500/20 text-purple-100" />
              <HoursBadge hours={monthly.prepHours} label="Prep" color="bg-teal-500/20 text-teal-100" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-blue-200 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Annual
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <HoursBadge hours={annual.teachingHours} label="Teaching" color="bg-blue-500/20 text-blue-100" />
              <HoursBadge hours={annual.contractedHours} label="Contracted" color="bg-purple-500/20 text-purple-100" />
              <HoursBadge hours={annual.prepHours} label="Prep" color="bg-teal-500/20 text-teal-100" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-blue-200 font-medium flex items-center gap-1.5">
              <Sun className="w-4 h-4" /> Holiday Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="text-white">
              <span className={`text-2xl font-bold ${holiday.balanceDays >= 0 ? "text-green-300" : "text-red-300"}`}>
                {holiday.balanceDays.toFixed(1)}
              </span>
              <span className="text-blue-200 text-sm ml-1">days left</span>
            </div>
            <HolidayBar
              taken={holiday.takenHours}
              owed={holiday.owedHours}
              entitlement={holiday.entitlementHours}
            />
          </CardContent>
        </Card>
      </div>

      {/* Semester Breakdown */}
      {semesterStats.length > 0 && (
        <Card className="bg-white/10 border-white/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-blue-200 font-medium">Semester Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {semesterStats.map((s) => (
                <div key={s.semesterNumber} className="bg-white/5 rounded-lg p-3 space-y-2">
                  <div className="text-white font-medium text-sm">Semester {s.semesterNumber}</div>
                  <div className="text-blue-200 text-xs">{s.weeks} weeks</div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div className="text-center">
                      <div className="text-blue-100 font-semibold">{s.teachingHours}h</div>
                      <div className="text-blue-300">Teaching</div>
                    </div>
                    <div className="text-center">
                      <div className="text-purple-100 font-semibold">{s.contractedHours}h</div>
                      <div className="text-purple-300">Contracted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-teal-100 font-semibold">{s.prepHours}h</div>
                      <div className="text-teal-300">Prep</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList className="bg-white/10 border-white/20">
          <TabsTrigger value="schedule" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            Weekly Schedule
          </TabsTrigger>
          <TabsTrigger value="free" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            Free Periods
            {freePeriodSessions.length > 0 && (
              <Badge className="ml-1.5 bg-amber-500/30 text-amber-200 border-0 text-xs">{freePeriodSessions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="holiday" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            Holiday Records
          </TabsTrigger>
        </TabsList>

        {/* Weekly Schedule */}
        <TabsContent value="schedule">
          <Card className="bg-white/10 border-white/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-blue-200 font-medium flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Weekly Teaching Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {Object.values(weeklyGrid).every(d => d.length === 0) ? (
                <div className="text-center text-blue-200 py-8">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No schedule sessions found for this teacher.</p>
                  <p className="text-xs mt-1 opacity-70">Add sessions in the Academic Calendar to see them here.</p>
                </div>
              ) : (
                <WeeklyGrid grid={weeklyGrid} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Free Periods */}
        <TabsContent value="free">
          <Card className="bg-white/10 border-white/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-blue-200 font-medium flex items-center gap-1.5">
                <Coffee className="w-4 h-4" /> Free Period Sessions (Cover Available)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {freePeriodSessions.length === 0 ? (
                <div className="text-center text-blue-200 py-8">
                  <Coffee className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No free period sessions detected.</p>
                  <p className="text-xs mt-1 opacity-70">Sessions labelled "Free", "Prep", or "Planning" will appear here for cover planning.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {freePeriodSessions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-amber-500/20 text-amber-200 border-0 text-xs">{DAY_NAMES[s.dayOfWeek]}</Badge>
                        <span className="text-white text-sm font-medium">{s.subject}</span>
                        {s.classGroup && <span className="text-blue-200 text-xs">{s.classGroup}</span>}
                      </div>
                      <span className="text-blue-200 text-sm">{s.startTime}–{s.endTime}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holiday Records */}
        <TabsContent value="holiday">
          <Card className="bg-white/10 border-white/20">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-blue-200 font-medium flex items-center gap-1.5">
                <Sun className="w-4 h-4" /> Holiday Records
              </CardTitle>
              <Button size="sm" onClick={() => setShowAddHoliday(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-7 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Record
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-white">{holiday.entitlementDays.toFixed(1)}</div>
                  <div className="text-xs text-blue-200">Days Entitled</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-300">{(holiday.takenHours / 7.5).toFixed(1)}</div>
                  <div className="text-xs text-red-200">Days Taken</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${holiday.balanceDays >= 0 ? "bg-green-500/10" : "bg-orange-500/10"}`}>
                  <div className={`text-lg font-bold ${holiday.balanceDays >= 0 ? "text-green-300" : "text-orange-300"}`}>
                    {holiday.balanceDays.toFixed(1)}
                  </div>
                  <div className={`text-xs ${holiday.balanceDays >= 0 ? "text-green-200" : "text-orange-200"}`}>Balance</div>
                </div>
              </div>

              {/* Records list */}
              {holiday.records.length === 0 ? (
                <div className="text-center text-blue-200 py-6">
                  <Sun className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No holiday records yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {holiday.records.map((r) => (
                    <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Badge className={`text-xs border-0 ${r.type === "taken" ? "bg-red-500/20 text-red-200" : "bg-amber-500/20 text-amber-200"}`}>
                          {r.type === "taken" ? "Taken" : "Owed"}
                        </Badge>
                        <span className="text-white text-sm">{new Date(r.date as unknown as string).toLocaleDateString()}</span>
                        <span className="text-blue-200 text-sm">{parseFloat(String(r.hours)).toFixed(1)}h</span>
                        {r.notes && <span className="text-blue-300 text-xs italic">{r.notes}</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-300 hover:text-red-200 hover:bg-red-500/20"
                        onClick={() => setDeleteHolidayId(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Holiday Dialog */}
      <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Add Holiday Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-blue-200">Date</Label>
              <Input
                type="date"
                value={holidayForm.date}
                onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-blue-200">Type</Label>
              <Select value={holidayForm.type} onValueChange={v => setHolidayForm(f => ({ ...f, type: v as "taken" | "owed" }))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taken">Holiday Taken</SelectItem>
                  <SelectItem value="owed">Holiday Owed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-blue-200">Hours</Label>
              <Input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={holidayForm.hours}
                onChange={e => setHolidayForm(f => ({ ...f, hours: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-blue-200">Notes (optional)</Label>
              <Input
                value={holidayForm.notes}
                onChange={e => setHolidayForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Annual leave, Sick day..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddHoliday(false)} className="text-white/70">Cancel</Button>
            <Button
              onClick={() => addHolidayMutation.mutate({
                teacherProfileId: profileId,
                date: holidayForm.date,
                type: holidayForm.type,
                hours: parseFloat(holidayForm.hours) || 7.5,
                notes: holidayForm.notes || undefined,
              })}
              disabled={!holidayForm.date || addHolidayMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addHolidayMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Holiday Confirm */}
      <AlertDialog open={deleteHolidayId !== null} onOpenChange={open => !open && setDeleteHolidayId(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday Record?</AlertDialogTitle>
            <AlertDialogDescription className="text-blue-200">This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white border-white/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteHolidayId && deleteHolidayMutation.mutate({ id: deleteHolidayId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProfileCard({ profile, onSelect, onEdit, onDelete }: {
  profile: { id: number; name: string; email: string | null; contractedHoursPerWeek: string; prepHoursPerWeek: string; annualHolidayDays: string };
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className="bg-white/10 border-white/20 hover:bg-white/15 cursor-pointer transition-all group"
      onClick={onSelect}
    >
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="text-white font-semibold truncate">{profile.name}</span>
            </div>
            {profile.email && <div className="text-blue-300 text-xs mt-0.5 ml-6">{profile.email}</div>}
            <div className="flex flex-wrap gap-2 mt-2 ml-6">
              <Badge className="bg-purple-500/20 text-purple-200 border-0 text-xs">
                {parseFloat(profile.contractedHoursPerWeek)}h/wk contracted
              </Badge>
              <Badge className="bg-teal-500/20 text-teal-200 border-0 text-xs">
                {parseFloat(profile.prepHoursPerWeek)}h/wk prep
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-200 border-0 text-xs">
                {parseFloat(profile.annualHolidayDays)} days holiday
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-blue-300 hover:text-white hover:bg-white/10"
              onClick={e => { e.stopPropagation(); onEdit(); }}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-300 hover:text-red-200 hover:bg-red-500/20"
              onClick={e => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <ChevronRight className="w-4 h-4 text-blue-300 group-hover:text-white transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_FORM = {
  name: "",
  email: "",
  contractedHoursPerWeek: 20,
  prepHoursPerWeek: 5,
  annualHolidayDays: 25,
  notes: "",
};

export default function TeacherProfiles() {
  const [location] = useLocation();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data: profiles = [], isLoading } = trpc.teacherProfile.listProfiles.useQuery();

  const upsertMutation = trpc.teacherProfile.upsertProfile.useMutation({
    onSuccess: () => {
      utils.teacherProfile.listProfiles.invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      toast.success(editingId ? "Profile updated" : "Profile created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.teacherProfile.deleteProfile.useMutation({
    onSuccess: () => {
      utils.teacherProfile.listProfiles.invalidate();
      setDeleteId(null);
      toast.success("Profile deleted");
    },
  });

  // Auto-select profile if ?name= query param is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("name");
    if (name && profiles.length > 0) {
      const match = profiles.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (match) setSelectedProfileId(match.id);
    }
  }, [profiles]);

  function openEdit(profile: typeof profiles[0]) {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      email: profile.email ?? "",
      contractedHoursPerWeek: parseFloat(profile.contractedHoursPerWeek as unknown as string),
      prepHoursPerWeek: parseFloat(profile.prepHoursPerWeek as unknown as string),
      annualHolidayDays: parseFloat(profile.annualHolidayDays as unknown as string),
      notes: "",
    });
    setShowForm(true);
  }

  return (
    <div className="min-h-screen relative">
      {/* Fixed hero background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url('/manus-storage/hero-bg_a767782c.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="fixed inset-0 -z-10 bg-black/65" />

      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <BackButton />
        <div className="mt-4">
          {selectedProfileId !== null ? (
            <ProfileDetail profileId={selectedProfileId} onBack={() => setSelectedProfileId(null)} />
          ) : (
            <div className="space-y-6">
              {/* Page header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <User className="w-6 h-6 text-blue-300" />
                    Teacher Profiles
                  </h1>
                  <p className="text-blue-200 text-sm mt-0.5">
                    Track teaching hours, contracted hours, prep time, holiday entitlement, and free periods for cover planning.
                  </p>
                </div>
                <Button
                  onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Teacher
                </Button>
              </div>

              {/* Profile list */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-300" />
                </div>
              ) : profiles.length === 0 ? (
                <Card className="bg-white/10 border-white/20 text-center py-16">
                  <CardContent>
                    <User className="w-12 h-12 mx-auto mb-3 text-blue-300 opacity-50" />
                    <p className="text-white font-medium">No teacher profiles yet</p>
                    <p className="text-blue-200 text-sm mt-1">Create profiles to track hours, holidays, and free periods.</p>
                    <Button
                      onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add First Teacher
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profiles.map(p => (
                    <ProfileCard
                      key={p.id}
                      profile={p as any}
                      onSelect={() => setSelectedProfileId(p.id)}
                      onEdit={() => openEdit(p as any)}
                      onDelete={() => setDeleteId(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Teacher Profile" : "Add Teacher Profile"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-blue-200">Full Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ms García"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <div>
              <Label className="text-blue-200">Email (optional)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="teacher@school.edu"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-blue-200 text-xs">Contracted h/wk</Label>
                <Input
                  type="number"
                  min="0"
                  max="80"
                  step="0.5"
                  value={form.contractedHoursPerWeek}
                  onChange={e => setForm(f => ({ ...f, contractedHoursPerWeek: parseFloat(e.target.value) || 0 }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-blue-200 text-xs">Prep h/wk</Label>
                <Input
                  type="number"
                  min="0"
                  max="40"
                  step="0.5"
                  value={form.prepHoursPerWeek}
                  onChange={e => setForm(f => ({ ...f, prepHoursPerWeek: parseFloat(e.target.value) || 0 }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-blue-200 text-xs">Holiday days/yr</Label>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  value={form.annualHolidayDays}
                  onChange={e => setForm(f => ({ ...f, annualHolidayDays: parseFloat(e.target.value) || 0 }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-blue-200">Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }} className="text-white/70">
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate({
                id: editingId ?? undefined,
                name: form.name,
                email: form.email || undefined,
                contractedHoursPerWeek: form.contractedHoursPerWeek,
                prepHoursPerWeek: form.prepHoursPerWeek,
                annualHolidayDays: form.annualHolidayDays,
                notes: form.notes || undefined,
              })}
              disabled={!form.name.trim() || upsertMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {upsertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Teacher Profile?</AlertDialogTitle>
            <AlertDialogDescription className="text-blue-200">
              This will permanently delete the profile and all holiday records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white border-white/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
