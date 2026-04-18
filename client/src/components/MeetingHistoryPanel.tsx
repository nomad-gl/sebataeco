/**
 * MeetingHistoryPanel
 *
 * Collapsible panel with two views:
 *  - List view: last 30 invitations with status badges, ICS download, Join now
 *  - Calendar view: compact monthly grid with accepted meeting dots
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  ChevronDown, ChevronRight, Calendar, Video,
  CheckCircle, XCircle, Clock, Ban, RefreshCw, FileText, Download, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/** Generate and download a .ics calendar file for a meeting invitation. */
function downloadIcs(inv: {
  title: string;
  proposedAt: Date | string;
  durationMinutes: number;
  roomName: string;
  message?: string | null;
  agenda?: string | null;
}) {
  const start = typeof inv.proposedAt === "string" ? new Date(inv.proposedAt) : inv.proposedAt;
  const end   = new Date(start.getTime() + inv.durationMinutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(".000", "");
  const description = [
    inv.message ? `Message: ${inv.message}` : "",
    inv.agenda  ? `Agenda:\n${inv.agenda}` : "",
    `Room: ${inv.roomName}`,
  ].filter(Boolean).join("\n").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//SEBA AI Studio//AINA Meet//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${inv.title}`, `DESCRIPTION:${description}`,
    `UID:${inv.roomName}@sebataeco.com`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${inv.title.replace(/[^a-z0-9]/gi, "_")}.ics`; a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  myId: number | null;
  onJoin: (roomName: string, title: string) => void;
  onReschedule?: (prefill: { toUserId: number; toName: string; title: string; agenda?: string | null; recurrence?: string | null }) => void;
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

const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function CalendarView({
  history,
  onJoin,
}: {
  history: Array<{ id: number; title: string; proposedAt: Date | string; status: string; roomName: string; durationMinutes: number; message?: string | null; agenda?: string | null }>;
  onJoin: (roomName: string, title: string) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Build a map: day-of-month → list of accepted meetings
  const dotMap = useMemo(() => {
    const map = new Map<number, typeof history>();
    history.forEach((inv) => {
      if (inv.status !== "accepted") return;
      const d = typeof inv.proposedAt === "string" ? new Date(inv.proposedAt) : inv.proposedAt;
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(inv);
      }
    });
    return map;
  }, [history, year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedDay(null); };

  const selectedMeetings = selectedDay !== null ? (dotMap.get(selectedDay) ?? []) : [];

  return (
    <div className="px-2 pb-2">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground text-xs px-1">‹</button>
        <span className="text-xs font-semibold">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground text-xs px-1">›</button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-[9px] text-center text-muted-foreground font-medium">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const hasMeeting = dotMap.has(day);
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`relative flex flex-col items-center justify-center h-6 rounded text-[10px] transition-colors
                ${isSelected ? "bg-[#003082] text-white" : isToday ? "bg-accent text-accent-foreground font-bold" : "hover:bg-muted text-foreground"}
              `}
            >
              {day}
              {hasMeeting && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? "bg-green-300" : "bg-green-500"}`} />
              )}
            </button>
          );
        })}
      </div>
      {/* Selected day meetings */}
      {selectedDay !== null && (
        <div className="mt-2 space-y-1.5">
          {selectedMeetings.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-1">No meetings on this day.</p>
          ) : selectedMeetings.map((inv) => (
            <div key={inv.id} className="rounded-lg bg-muted/40 px-2.5 py-2 space-y-1">
              <p className="text-xs font-medium line-clamp-1">{inv.title}</p>
              <p className="text-[10px] text-muted-foreground">{formatDateTime(inv.proposedAt)} · {inv.durationMinutes} min</p>
              <div className="flex gap-1.5">
                <Button size="sm" className="flex-1 h-6 text-[10px] bg-[#003082] hover:bg-[#002060] text-white gap-1" onClick={() => onJoin(inv.roomName, inv.title)}>
                  <Video className="w-3 h-3" /> Join now
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" title="Add to calendar (.ics)" onClick={() => downloadIcs(inv as any)}>
                  <Download className="w-3 h-3" /> .ics
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MeetingHistoryPanel({ myId, onJoin, onReschedule }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");

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
        <>
          {/* View toggle */}
          <div className="flex items-center gap-1 px-2 pb-1.5">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${view === "list" ? "bg-[#003082] text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-2.5 h-2.5" /> List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${view === "calendar" ? "bg-[#003082] text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Calendar className="w-2.5 h-2.5" /> Calendar
            </button>
          </div>

          {!history && (
            <p className="text-xs text-muted-foreground px-3 py-2">Loading…</p>
          )}

          {history && view === "calendar" && (
            <CalendarView history={history as any} onJoin={onJoin} />
          )}

          {history && view === "list" && (
            <div className="px-2 pb-2 space-y-1.5 max-h-72 overflow-y-auto">
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground px-1 py-2">No meeting history yet.</p>
              )}
              {history.map((inv) => {
                const statusInfo = STATUS_STYLES[inv.status] ?? STATUS_STYLES.pending;
                const isMine = inv.fromUserId === myId;
                return (
                  <div key={inv.id} className="rounded-lg bg-muted/40 px-2.5 py-2 space-y-1">
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
                    {(inv as any).agenda && (
                      <p className="text-[10px] text-muted-foreground flex items-start gap-1 mt-0.5">
                        <FileText className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2 opacity-80">{(inv as any).agenda}</span>
                      </p>
                    )}
                    {inv.status === "accepted" && (
                      <div className="flex gap-1.5 mt-1">
                        <Button size="sm" className="flex-1 h-6 text-[10px] bg-[#003082] hover:bg-[#002060] text-white gap-1" onClick={() => onJoin(inv.roomName, inv.title)}>
                          <Video className="w-3 h-3" /> Join now
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" title="Add to calendar (.ics)" onClick={() => downloadIcs(inv as any)}>
                          <Download className="w-3 h-3" /> .ics
                        </Button>
                      </div>
                    )}
                    {(inv.status === "declined" || inv.status === "cancelled") && isMine && onReschedule && (
                      <div className="flex gap-1.5 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-6 text-[10px] gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => onReschedule({
                            toUserId: inv.toUserId,
                            toName: inv.toName ?? "",
                            title: inv.title,
                            agenda: (inv as any).agenda,
                            recurrence: (inv as any).recurrence,
                          })}
                        >
                          <RefreshCw className="w-3 h-3" /> Reschedule
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
