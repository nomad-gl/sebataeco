/**
 * MeetingInvitationBanner
 *
 * Polls for pending meeting invitations every 15 s.
 * Shows a card overlay for each pending invitation with:
 * - Sender name, meeting title, proposed date/time, duration, optional message
 * - Accept (opens SebaMeet immediately if the time is now, or confirms for later)
 * - Decline
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { SebaSymbol } from "@/components/SebaSymbol";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Video, X, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onAccept: (roomName: string, title: string) => void;
}

function formatDateTime(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MeetingInvitationBanner({ onAccept }: Props) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const { data: pending } = trpc.meetingInvitation.getPending.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const acceptMut  = trpc.meetingInvitation.accept.useMutation({
    onSuccess: (data, vars) => {
      utils.meetingInvitation.getPending.invalidate();
      utils.meetingInvitation.getHistory.invalidate();
    },
  });
  const declineMut = trpc.meetingInvitation.decline.useMutation({
    onSuccess: () => {
      utils.meetingInvitation.getPending.invalidate();
      utils.meetingInvitation.getHistory.invalidate();
    },
  });

  const visible = (pending ?? []).filter((inv) => !dismissed.has(inv.id));
  // dismissed is a Set<number> — no spread needed above

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full">
      {visible.map((inv) => (
        <div
          key={inv.id}
          className="bg-[#003082] border border-white/20 rounded-xl shadow-2xl p-4 text-white"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <SebaSymbol className="w-5 h-5 text-white/80 flex-shrink-0" />
              <div>
                <p className="text-xs text-white/60 font-medium uppercase tracking-wide">{t("meet_invite_header")}</p>
                <p className="text-sm font-bold leading-tight">{inv.title}</p>
              </div>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set(Array.from(prev).concat(inv.id)))}
              className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* From */}
          <p className="text-xs text-white/70 mb-2">
            {t("meet_invite_from")} <span className="text-white font-semibold">{inv.fromName}</span>
          </p>

          {/* Date/time */}
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1 text-xs text-white/80">
              <Calendar className="w-3.5 h-3.5 text-blue-300" />
              {formatDateTime(inv.proposedAt)}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/80">
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              {inv.durationMinutes} min
            </span>
          </div>

          {/* Message */}
          {inv.message && (
            <p className="text-xs text-white/60 italic mb-3 line-clamp-2">"{inv.message}"</p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs h-8 gap-1"
              disabled={acceptMut.isPending}
              onClick={async () => {
                try {
                  const { roomName } = await acceptMut.mutateAsync({ invitationId: inv.id });
                  setDismissed((prev) => new Set(Array.from(prev).concat(inv.id)));
                  toast.success(t("meet_invite_accepted_toast"));
                  onAccept(roomName, inv.title);
                } catch {
                  toast.error(t("meet_invite_accept_error"));
                }
              }}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {t("meet_invite_accept")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-white/20 text-white/80 hover:bg-white/10 text-xs h-8 gap-1"
              disabled={declineMut.isPending}
              onClick={async () => {
                try {
                  await declineMut.mutateAsync({ invitationId: inv.id });
                  setDismissed((prev) => new Set(Array.from(prev).concat(inv.id)));
                  toast.info(t("meet_invite_declined_toast"));
                } catch {
                  toast.error(t("meet_invite_decline_error"));
                }
              }}
            >
              <XCircle className="w-3.5 h-3.5" />
              {t("meet_invite_decline")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
