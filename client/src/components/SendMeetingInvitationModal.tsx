/**
 * SendMeetingInvitationModal
 *
 * Dialog that lets the current user invite another user to a scheduled meeting.
 * Fields: title, date, time, duration (15/30/45/60/90/120 min), optional message.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { SebaSymbol } from "@/components/SebaSymbol";
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
import { Calendar, Clock, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toUserId: number;
  toUserName: string;
}

const DURATION_OPTIONS = [
  { value: "15",  label: "15 minutes" },
  { value: "30",  label: "30 minutes" },
  { value: "45",  label: "45 minutes" },
  { value: "60",  label: "1 hour" },
  { value: "90",  label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

function toLocalDatetimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SendMeetingInvitationModal({ open, onOpenChange, toUserId, toUserName }: Props) {
  const { t } = useI18n();

  // Default to tomorrow at 09:00
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  defaultDate.setHours(9, 0, 0, 0);

  const [title,    setTitle]    = useState("");
  const [dateTime, setDateTime] = useState(toLocalDatetimeValue(defaultDate));
  const [duration, setDuration] = useState("30");
  const [message,  setMessage]  = useState("");

  const sendMut = trpc.meetingInvitation.send.useMutation({
    onSuccess: () => {
      toast.success(`Meeting invitation sent to ${toUserName}`);
      onOpenChange(false);
      setTitle(""); setMessage("");
    },
    onError: () => toast.error("Could not send invitation"),
  });

  const handleSend = () => {
    if (!title.trim()) { toast.error("Please add a meeting title"); return; }
    const proposedAt = new Date(dateTime);
    if (isNaN(proposedAt.getTime())) { toast.error("Invalid date/time"); return; }
    sendMut.mutate({
      toUserId,
      title: title.trim(),
      proposedAt,
      durationMinutes: parseInt(duration, 10),
      message: message.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SebaSymbol className="w-5 h-5 text-[#003082]" />
            Invite {toUserName} to a Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="meet-title">Meeting title</Label>
            <Input
              id="meet-title"
              placeholder="e.g. Weekly check-in, Curriculum review…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={256}
            />
          </div>

          {/* Date & time */}
          <div className="space-y-1.5">
            <Label htmlFor="meet-datetime" className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date & time
            </Label>
            <Input
              id="meet-datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              min={toLocalDatetimeValue(new Date())}
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Duration
            </Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="meet-message">Message (optional)</Label>
            <Textarea
              id="meet-message"
              placeholder="Add context or agenda…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Send */}
          <Button
            className="w-full bg-[#003082] hover:bg-[#002060] text-white gap-2"
            onClick={handleSend}
            disabled={sendMut.isPending || !title.trim()}
          >
            <Send className="w-4 h-4" />
            {sendMut.isPending ? "Sending…" : "Send Invitation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
