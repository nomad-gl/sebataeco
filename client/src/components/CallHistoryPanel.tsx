/**
 * CallHistoryPanel
 *
 * Collapsible panel shown at the bottom of the SEBA Connect members sidebar.
 * Displays the last 20 DM calls (both as caller and callee) with:
 * - Partner name, call type (video/audio), status badge, timestamp, duration
 * - "Rejoin" button for ended calls
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { ChevronDown, ChevronRight, Phone, Video, PhoneOff, PhoneMissed } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallHistoryPanelProps {
  myId: number | null;
  onRejoin: (roomName: string, partnerName: string) => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}

export function CallHistoryPanel({ myId, onRejoin }: CallHistoryPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const { data: history, isLoading } = trpc.dmCall.getHistory.useQuery(undefined, {
    enabled: open && !!myId,
    refetchInterval: open ? 15_000 : false,
  });

  const statusIcon = (status: string) => {
    if (status === "missed") return <PhoneMissed className="w-3 h-3 text-red-400" />;
    if (status === "declined") return <PhoneOff className="w-3 h-3 text-orange-400" />;
    return <Phone className="w-3 h-3 text-green-400" />;
  };

  const statusLabel = (status: string) => {
    if (status === "missed") return t("call_missed");
    if (status === "declined") return t("call_decline");
    if (status === "ended") return t("call_ended");
    return status;
  };

  return (
    <div className="border-t border-white/10">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-white/5 transition-colors"
      >
        <span>{t("call_history")}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="max-h-52 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : !history || history.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground text-center">{t("call_no_history")}</p>
          ) : (
            history.map((call) => {
              const isCallee = call.calleeId === myId;
              const partnerName = isCallee
                ? (call.callerName ?? "Unknown")
                : (call.calleeName ?? "Unknown");
              const canRejoin = call.status === "ended";

              return (
                <div
                  key={call.id}
                  className="flex items-start gap-2 px-4 py-2 hover:bg-white/5 transition-colors"
                >
                  {/* Call type icon */}
                  <div className="mt-0.5 shrink-0">
                    {call.audioOnly ? (
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Video className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{partnerName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {statusIcon(call.status)}
                      <span className="text-xs text-muted-foreground">{statusLabel(call.status)}</span>
                      {call.durationSeconds ? (
                        <span className="text-xs text-muted-foreground">· {formatDuration(call.durationSeconds)}</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {formatRelative(new Date(call.startedAt))}
                    </p>
                  </div>

                  {/* Rejoin button */}
                  {canRejoin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-blue-400 hover:text-white hover:bg-blue-700 shrink-0"
                      onClick={() => onRejoin(call.roomName, partnerName)}
                    >
                      ↩
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
