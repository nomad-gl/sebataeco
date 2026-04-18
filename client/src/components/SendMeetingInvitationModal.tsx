/**
 * SendMeetingInvitationModal
 *
 * Dialog that lets the current user invite one or more users to a scheduled meeting.
 * All invitees share the same room. Supports a searchable multi-select picker.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { SebaSymbol } from "@/components/SebaSymbol";
import { useI18n } from "@/contexts/I18nContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, RefreshCw, Send, FileText, Search, X, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional pre-selected invitee (e.g. from clicking a user's profile card) */
  toUserId?: number;
  toUserName?: string;
  prefillTitle?: string;
  prefillAgenda?: string | null;
  prefillRecurrence?: string | null;
}

function toLocalDatetimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SendMeetingInvitationModal({
  open,
  onOpenChange,
  toUserId,
  toUserName,
  prefillTitle,
  prefillAgenda,
  prefillRecurrence,
}: Props) {
  const { t } = useI18n();

  // Duration and recurrence options use t() so they update when language changes
  const DURATION_OPTIONS = [
    { value: "15",  label: t("meet_dur_15") },
    { value: "30",  label: t("meet_dur_30") },
    { value: "45",  label: t("meet_dur_45") },
    { value: "60",  label: t("meet_dur_60") },
    { value: "90",  label: t("meet_dur_90") },
    { value: "120", label: t("meet_dur_120") },
  ];

  const RECURRENCE_OPTIONS = [
    { value: "none",     label: t("meet_rec_none") },
    { value: "weekly",   label: t("meet_rec_weekly") },
    { value: "biweekly", label: t("meet_rec_biweekly") },
  ];

  // ── Invitee multi-select ────────────────────────────────────────────────
  const [selectedInvitees, setSelectedInvitees] = useState<{ id: number; name: string }[]>(
    () => (toUserId && toUserName ? [{ id: toUserId, name: toUserName }] : [])
  );
  const [userSearch, setUserSearch] = useState("");

  const usersQuery = trpc.forum.getUsers.useQuery(undefined, { staleTime: 60_000 });
  const allUsers = usersQuery.data ?? [];

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    return allUsers.filter(
      (u) =>
        !selectedInvitees.some((s) => s.id === u.id) &&
        (q === "" || u.name.toLowerCase().includes(q))
    );
  }, [allUsers, selectedInvitees, userSearch]);

  const addInvitee = (u: { id: number; name: string }) => {
    setSelectedInvitees((prev) => [...prev, { id: u.id, name: u.name }]);
    setUserSearch("");
  };

  const removeInvitee = (id: number) =>
    setSelectedInvitees((prev) => prev.filter((s) => s.id !== id));

  // ── Meeting fields ──────────────────────────────────────────────────────
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  defaultDate.setHours(9, 0, 0, 0);

  const [title,      setTitle]      = useState(prefillTitle ?? "");
  const [dateTime,   setDateTime]   = useState(toLocalDatetimeValue(defaultDate));
  const [duration,   setDuration]   = useState("30");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly">(
    (prefillRecurrence as "none" | "weekly" | "biweekly" | null | undefined) ?? "none"
  );
  const [message,    setMessage]    = useState("");
  const [agenda,     setAgenda]     = useState(prefillAgenda ?? "");
  const [showAgenda, setShowAgenda] = useState(!!prefillAgenda);

  const sendMut = trpc.meetingInvitation.send.useMutation({
    onSuccess: () => {
      toast.success(
        selectedInvitees.length === 1
          ? `Meeting invitation sent to ${selectedInvitees[0].name}`
          : `Meeting invitation sent to ${selectedInvitees.length} people`
      );
      onOpenChange(false);
      setTitle(""); setMessage(""); setAgenda(""); setShowAgenda(false);
      setSelectedInvitees(toUserId && toUserName ? [{ id: toUserId, name: toUserName }] : []);
    },
    onError: () => toast.error("Could not send invitation"),
  });

  const handleSend = () => {
    if (selectedInvitees.length === 0) { toast.error("Please select at least one invitee"); return; }
    if (!title.trim()) { toast.error("Please add a meeting title"); return; }
    const proposedAt = new Date(dateTime);
    if (isNaN(proposedAt.getTime())) { toast.error("Invalid date/time"); return; }
    sendMut.mutate({
      toUserIds: selectedInvitees.map((s) => s.id),
      title: title.trim(),
      proposedAt,
      durationMinutes: parseInt(duration, 10),
      recurrence,
      message: message.trim() || undefined,
      agenda: agenda.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SebaSymbol className="w-5 h-5 text-[#003082]" />
            {t("meet_modal_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">

          {/* ── Invitees ─────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {t("meet_modal_invitees")}
            </Label>

            {selectedInvitees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {selectedInvitees.map((s) => (
                  <Badge key={s.id} variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
                    {s.name}
                    <button
                      type="button"
                      onClick={() => removeInvitee(s.id)}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t("meet_modal_search_people")}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>

            {(userSearch.trim() !== "" || selectedInvitees.length === 0) && filteredUsers.length > 0 && (
              <div className="border rounded-md max-h-36 overflow-y-auto bg-background shadow-sm">
                {filteredUsers.slice(0, 12).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addInvitee(u)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <span className="w-6 h-6 rounded-full bg-[#003082]/20 text-[#003082] text-xs font-semibold flex items-center justify-center shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    {u.name}
                    {(u as any).online && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {userSearch.trim() !== "" && filteredUsers.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">{t("meet_modal_no_users")}</p>
            )}
          </div>

          {/* ── Title ────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="meet-title">{t("meet_modal_meeting_title")}</Label>
            <Input
              id="meet-title"
              placeholder={t("meet_modal_title_placeholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={256}
            />
          </div>

          {/* ── Date & time ──────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="meet-datetime" className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {t("meet_modal_datetime")}
            </Label>
            <Input
              id="meet-datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              min={toLocalDatetimeValue(new Date())}
            />
          </div>

          {/* ── Duration + Recurrence ────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {t("meet_modal_duration")}
              </Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> {t("meet_modal_repeats")}
              </Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as typeof recurrence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Message ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="meet-message">{t("meet_modal_message")}</Label>
            <Textarea
              id="meet-message"
              placeholder={t("meet_modal_message_placeholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>

          {/* ── Agenda ───────────────────────────────────────────────── */}
          {!showAgenda ? (
            <button
              type="button"
              onClick={() => setShowAgenda(true)}
              className="flex items-center gap-1.5 text-xs text-[#003082] hover:text-[#002060] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {t("meet_modal_add_agenda")}
            </button>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="meet-agenda" className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> {t("meet_modal_agenda")}
              </Label>
              <Textarea
                id="meet-agenda"
                placeholder={t("meet_modal_agenda_placeholder")}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                rows={4}
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground text-right">{agenda.length}/4000</p>
            </div>
          )}

          {recurrence !== "none" && (
            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
              <RefreshCw className="w-3 h-3 inline mr-1 text-blue-500" />
              {t("meet_modal_recurrence_note")}
            </p>
          )}

          {/* ── Send ─────────────────────────────────────────────────── */}
          <Button
            className="w-full bg-[#003082] hover:bg-[#002060] text-white gap-2"
            onClick={handleSend}
            disabled={sendMut.isPending || !title.trim() || selectedInvitees.length === 0}
          >
            <Send className="w-4 h-4" />
            {sendMut.isPending
              ? t("meet_modal_sending")
              : selectedInvitees.length > 1
                ? t("meet_modal_send_to_many").replace("{count}", String(selectedInvitees.length))
                : t("meet_modal_send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
