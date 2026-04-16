/**
 * MeetingHistoryPanel
 *
 * Collapsible panel showing the last 30 meeting invitations (sent + received).
 * Shows status badges, date/time, and a "Join now" button for accepted meetings.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { ChevronDown, ChevronRight, Calendar, Video, CheckCircle, XCircle, Clock, Ban, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  myId: number | null;
  onJoin: (roomName: string, title: string) => void;
}

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   cls: "bg-yellow-500/20 text-yellow-300", icon: <Clock className="w-3 h-3" /> },
  accepted:  { label: "Accepted",  cls: "bg-green-500/20 text-green-300",   icon: <CheckCircle className="w-3 h-3" /> },
  declined:  { label: "Declined",  cls: "bg-red-500/20 text-red-300",       icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Cancelled", cls: "bg-gray-500/20 text-gray-400",     icon: <Ban className="w-3 h-3" /> },
};

function formatDateTime(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function MeetingHistoryPanel({ myId, onJoin }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const { data: history } = trpc.meetingInvitation.getHistory.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Meetings
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-1.5 max-h-72 overflow-y-auto">
          {!history && (
            <p className="text-xs text-muted-foreground px-1 py-2">Loading…</p>
          )}
          {history && history.length === 0 && (
            <p className="text-xs text-muted-foreground px-1 py-2">No meeting history yet.</p>
          )}
          {history?.map((inv) => {
            const statusInfo = STATUS_STYLES[inv.status] ?? STATUS_STYLES.pending;
            const isMine = inv.fromUserId === myId;
            return (
              <div
                key={inv.id}
                className="rounded-lg bg-muted/40 px-2.5 py-2 space-y-1"
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xs font-medium leading-tight line-clamp-1">{inv.title}</p>
                  <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusInfo.cls}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {isMine ? `To: ${inv.toName}` : `From: ${inv.fromName}`}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                  <Calendar className="w-3 h-3" />
                  {formatDateTime(inv.proposedAt)}
                  <span className="opacity-60">· {inv.durationMinutes} min</span>
                  {(inv as any).recurrence && (inv as any).recurrence !== "none" && (
                    <span className="flex items-center gap-0.5 text-blue-400">
                      <RefreshCw className="w-2.5 h-2.5" />
                      {(inv as any).recurrence === "weekly" ? "Weekly" : "Biweekly"}
                    </span>
                  )}
                </p>
                {/* Agenda snippet */}
                {(inv as any).agenda && (
                  <p className="text-[10px] text-muted-foreground flex items-start gap-1 mt-0.5">
                    <FileText className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2 opacity-80">{(inv as any).agenda}</span>
                  </p>
                )}
                {inv.status === "accepted" && (
                  <Button
                    size="sm"
                    className="w-full h-6 text-[10px] bg-[#003082] hover:bg-[#002060] text-white gap-1 mt-1"
                    onClick={() => onJoin(inv.roomName, inv.title)}
                  >
                    <Video className="w-3 h-3" />
                    Join now
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
