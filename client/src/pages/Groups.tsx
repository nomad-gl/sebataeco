import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, Trash2, Mail, BookOpen, Calendar, ChevronRight,
  UserPlus, Send, Loader2, AlertCircle, GraduationCap, ClipboardList, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { Link } from "wouter";

// ── Competency colour map ────────────────────────────────────────────────────
const COMP_COLORS: Record<string, string> = {
  CCL: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  CP: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  STEM: "bg-green-500/20 text-green-300 border-green-500/30",
  CD: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  CPSAA: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  CC: "bg-red-500/20 text-red-300 border-red-500/30",
  CE: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  CCEC: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

type Group = {
  id: number;
  className: string;
  level: string;
  assessmentTitle: string;
  createdAt: Date;
};

// ── Create Group Dialog ──────────────────────────────────────────────────────
function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [className, setClassName] = useState("");
  const [level, setLevel] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("");

  const createMutation = trpc.groups.create.useMutation({
    onSuccess: () => {
      toast.success(t("groups_created"));
      onCreated();
      onClose();
      setClassName(""); setLevel(""); setAssessmentTitle("");
    },
    onError: () => toast.error(t("groups_create_failed")),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            {t("groups_create_title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-white/70">{t("groups_class_name")} *</Label>
            <Input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder={t("groups_class_name_placeholder")}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">{t("groups_level")} *</Label>
            <Input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder={t("groups_level_placeholder")}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">{t("groups_assessment_title")} *</Label>
            <Input
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder={t("groups_assessment_title_placeholder")}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/60 hover:text-white">
            {t("cancel")}
          </Button>
          <Button
            onClick={() => createMutation.mutate({ className, level, assessmentTitle })}
            disabled={!className.trim() || !level.trim() || !assessmentTitle.trim() || createMutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {t("groups_create_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Student Roster Tab ───────────────────────────────────────────────────────
function StudentRoster({ group }: { group: Group }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const { data: students = [], isLoading } = trpc.groups.listStudents.useQuery({ groupId: group.id });

  const addMutation = trpc.groups.addStudent.useMutation({
    onSuccess: () => {
      utils.groups.listStudents.invalidate({ groupId: group.id });
      setName(""); setEmail("");
      toast.success(t("groups_student_added"));
    },
    onError: () => toast.error(t("groups_student_add_failed")),
  });

  const removeMutation = trpc.groups.removeStudent.useMutation({
    onSuccess: () => {
      utils.groups.listStudents.invalidate({ groupId: group.id });
      toast.success(t("groups_student_removed"));
    },
  });

  return (
    <div className="space-y-5">
      {/* Add student form */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white/70 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> {t("groups_add_student")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("groups_student_name")}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1"
            />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("groups_student_email")}
              type="email"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1"
            />
            <Button
              onClick={() => addMutation.mutate({ groupId: group.id, name, email })}
              disabled={!name.trim() || !email.trim() || addMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white shrink-0"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-1.5">{t("groups_add_btn")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roster table */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-10 text-white/40">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{t("groups_no_students")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left w-12">#</th>
                <th className="px-4 py-3 text-left">{t("groups_student_name")}</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">{t("groups_student_email")}</th>
                <th className="px-4 py-3 text-right">{t("groups_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {students.map((s) => (
                <tr key={s.id} className="text-white hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-white/50">{s.studentNumber}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-white/60 hidden sm:table-cell">{s.email}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/groups/${group.id}/student/${s.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-teal-400 hover:text-teal-300 hover:bg-teal-400/10 h-7 px-2 text-xs"
                        >
                          <TrendingUp className="w-3 h-3 mr-1" /> {t("gp_view_student")}
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMutation.mutate({ studentId: s.id, groupId: group.id })}
                        disabled={removeMutation.isPending}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-7 w-7 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-white/5 text-white/40 text-xs">
            {students.length} {t("groups_students_total")}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Send Message Tab ─────────────────────────────────────────────────────────
function SendMessageTab({ group }: { group: Group }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { data: messages = [], isLoading } = trpc.groups.listMessages.useQuery({ groupId: group.id });

  const sendMutation = trpc.groups.sendMessage.useMutation({
    onSuccess: () => {
      utils.groups.listMessages.invalidate({ groupId: group.id });
      setSubject(""); setBody("");
      toast.success(t("groups_message_sent"));
    },
    onError: () => toast.error(t("groups_message_failed")),
  });

  return (
    <div className="space-y-5">
      {/* Compose */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white/70 flex items-center gap-2">
            <Mail className="w-4 h-4" /> {t("groups_compose_message")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">{t("groups_message_subject")}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("groups_message_subject_placeholder")}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">{t("groups_message_body")}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("groups_message_body_placeholder")}
              rows={4}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {t("groups_message_note")}
            </p>
            <Button
              onClick={() => sendMutation.mutate({ groupId: group.id, subject, body })}
              disabled={!subject.trim() || !body.trim() || sendMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {t("groups_send_btn")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message history */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8 text-white/40">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("groups_no_messages")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-white/50 text-xs uppercase tracking-wide font-semibold">{t("groups_sent_messages")}</p>
          {messages.map((m) => (
            <Card key={m.id} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{m.subject}</p>
                    <p className="text-white/60 text-sm mt-1 line-clamp-2">{m.body}</p>
                  </div>
                  <p className="text-white/40 text-xs shrink-0 mt-0.5">
                    {new Date(m.sentAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Challenge History Tab ─────────────────────────────────────────────────────
function ChallengeHistoryTab({ group }: { group: Group }) {
  const { t } = useI18n();
  const { data: logs = [], isLoading } = trpc.groups.listChallengeLog.useQuery({ groupId: group.id });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{t("groups_no_challenges")}</p>
          <p className="text-xs mt-1">{t("groups_no_challenges_hint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{log.challengeTitle}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {(log.competencies as string[]).map((c) => (
                        <Badge
                          key={c}
                          variant="outline"
                          className={`text-xs px-2 py-0.5 ${COMP_COLORS[c] ?? "bg-white/10 text-white/60 border-white/20"}`}
                        >
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/40 text-xs shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(log.runAt).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Groups Page ──────────────────────────────────────────────────────────
export default function Groups() {
  const { t } = useI18n();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const { data: groups = [], isLoading } = trpc.groups.list.useQuery(undefined, {
    enabled: !!user,
  });

  const deleteMutation = trpc.groups.delete.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      if (selectedGroupId === deleteMutation.variables?.id) setSelectedGroupId(null);
      toast.success(t("groups_deleted"));
    },
    onError: () => toast.error(t("groups_delete_failed")),
  });

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-white/10 border-white/20 text-white max-w-sm w-full text-center">
          <CardContent className="p-8 space-y-4">
            <GraduationCap className="w-12 h-12 mx-auto text-blue-400" />
            <h2 className="text-xl font-bold">{t("groups_sign_in_required")}</h2>
            <p className="text-white/60 text-sm">{t("groups_sign_in_desc")}</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-500 text-white w-full">
              <a href={getLoginUrl()}>{t("nav_sign_in")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              {t("groups_title")}
            </h1>
            <p className="text-white/50 mt-1 text-sm">{t("groups_subtitle")}</p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> {t("groups_new_group")}
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Group List Sidebar ── */}
          <div className="lg:w-72 shrink-0 space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : groups.length === 0 ? (
              <Card className="bg-white/5 border-white/10 text-center p-8">
                <Users className="w-10 h-10 mx-auto mb-3 text-white/20" />
                <p className="text-white/50 text-sm">{t("groups_empty")}</p>
                <Button
                  onClick={() => setShowCreate(true)}
                  variant="outline"
                  size="sm"
                  className="mt-4 border-white/20 text-white/70 hover:text-white bg-transparent"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("groups_create_first")}
                </Button>
              </Card>
            ) : (
              groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all group ${
                    selectedGroupId === g.id
                      ? "bg-blue-600/20 border-blue-500/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{g.className}</p>
                      <p className="text-white/50 text-xs mt-0.5 truncate">{g.level}</p>
                      <p className="text-white/40 text-xs mt-1 truncate">{g.assessmentTitle}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${
                      selectedGroupId === g.id ? "text-blue-400 rotate-90" : "text-white/30 group-hover:text-white/60"
                    }`} />
                  </div>
                  <p className="text-white/30 text-xs mt-2">
                    {new Date(g.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* ── Group Detail Panel ── */}
          <div className="flex-1 min-w-0">
            {!selectedGroup ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/30">
                <ClipboardList className="w-14 h-14 mb-4 opacity-30" />
                <p className="text-lg font-medium">{t("groups_select_prompt")}</p>
                <p className="text-sm mt-1">{t("groups_select_hint")}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Group header */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedGroup.className}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/30 text-xs">
                            <GraduationCap className="w-3 h-3 mr-1" /> {selectedGroup.level}
                          </Badge>
                          <Badge variant="outline" className="bg-white/10 text-white/60 border-white/20 text-xs">
                            <ClipboardList className="w-3 h-3 mr-1" /> {selectedGroup.assessmentTitle}
                          </Badge>
                        </div>
                        <p className="text-white/40 text-xs mt-2">
                          {t("groups_created_on")} {new Date(selectedGroup.createdAt).toLocaleDateString(undefined, {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/groups/${selectedGroup.id}/progress`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-teal-500/40 text-teal-300 hover:text-teal-200 hover:bg-teal-600/20 bg-transparent"
                          >
                            <TrendingUp className="w-4 h-4 mr-1.5" /> {t("gp_title")}
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(t("groups_delete_confirm"))) {
                              deleteMutation.mutate({ id: selectedGroup.id });
                            }
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" /> {t("groups_delete_group")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs defaultValue="students">
                  <TabsList className="bg-white/5 border border-white/10 w-full sm:w-auto">
                    <TabsTrigger value="students" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> {t("groups_tab_students")}
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> {t("groups_tab_messages")}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> {t("groups_tab_history")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="students" className="mt-4">
                    <StudentRoster group={selectedGroup} />
                  </TabsContent>
                  <TabsContent value="messages" className="mt-4">
                    <SendMessageTab group={selectedGroup} />
                  </TabsContent>
                  <TabsContent value="history" className="mt-4">
                    <ChallengeHistoryTab group={selectedGroup} />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateGroupDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => utils.groups.list.invalidate()}
      />
    </div>
  );
}
