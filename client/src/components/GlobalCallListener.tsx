/**
 * GlobalCallListener
 *
 * Mounted at the App root so it runs on EVERY page, not just /connect.
 * Polls trpc.dmCall.getPending every 3 s and shows the IncomingCallBanner.
 *
 * On Accept:
 *  - If already on /connect, delegates to the SebaConnect page state via a
 *    custom DOM event ("seba:incoming-call-accepted") so the pre-call dialog
 *    opens with the right room.
 *  - If on any other page, navigates to /connect and passes the room via
 *    sessionStorage so SebaConnect can pick it up on mount.
 *
 * The SebaConnect page still renders its own IncomingCallBanner for the
 * in-page flow; this component handles the cross-page case.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video, Volume2, VolumeX } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";

export function GlobalCallListener() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [dismissed, setDismissed] = useState<number | null>(null);
  const [ringMuted, setRingMuted] = useState(false);
  const ringMutedRef = useRef(ringMuted);
  useEffect(() => { ringMutedRef.current = ringMuted; }, [ringMuted]);

  // Only poll when logged in
  const { data: pendingCall } = trpc.dmCall.getPending.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  });

  const acceptMut  = trpc.dmCall.accept.useMutation();
  const declineMut = trpc.dmCall.decline.useMutation();

  // ── Ring audio ────────────────────────────────────────────────────────────
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRinging = () => {
    if (audioCtxRef.current) return; // already ringing
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const playBeep = () => {
        if (ringMutedRef.current) return;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      };
      playBeep();
      ringIntervalRef.current = setInterval(playBeep, 1_500);
    } catch {
      // Audio blocked by browser — silent fallback
    }
  };

  const stopRinging = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  const hasCall = !!pendingCall && pendingCall.id !== dismissed;

  useEffect(() => {
    if (hasCall) startRinging();
    else stopRinging();
    return stopRinging;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCall]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAccept = async (audioOnly: boolean) => {
    if (!pendingCall) return;
    stopRinging();
    try {
      await acceptMut.mutateAsync({ callId: pendingCall.id });
    } catch { /* non-critical */ }
    utils.dmCall.getPending.invalidate();
    utils.dmCall.getHistory.invalidate();
    setDismissed(pendingCall.id);

    const roomName   = pendingCall.roomName;
    const callerName = pendingCall.callerName ?? "Unknown";

    if (location === "/connect") {
      // Delegate to SebaConnect via custom event
      window.dispatchEvent(new CustomEvent("seba:incoming-call-accepted", {
        detail: { roomName, callerName, audioOnly },
      }));
    } else {
      // Navigate to /connect, passing call info via sessionStorage
      sessionStorage.setItem("seba:pending-call", JSON.stringify({ roomName, callerName, audioOnly }));
      navigate("/connect");
    }
  };

  const handleDecline = async () => {
    if (!pendingCall) return;
    stopRinging();
    try {
      await declineMut.mutateAsync({ callId: pendingCall.id });
    } catch { /* non-critical */ }
    utils.dmCall.getPending.invalidate();
    setDismissed(pendingCall.id);
  };

  // ── Don't render on /connect — SebaConnect has its own IncomingCallBanner
  if (location === "/connect") return null;
  if (!hasCall || !pendingCall) return null;

  const initials = (pendingCall.callerName ?? "?").charAt(0).toUpperCase();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="relative bg-[#003082] text-white rounded-2xl shadow-2xl p-4 w-80 border border-white/10">
        {/* Mute toggle */}
        <button
          onClick={() => setRingMuted((m) => !m)}
          className="absolute top-3 right-3 text-white/50 hover:text-white/90 transition-colors"
          title={ringMuted ? "Unmute ringtone" : "Mute ringtone"}
        >
          {ringMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Caller info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {initials}
            </div>
            <span className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-60" />
          </div>
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wider font-medium flex items-center gap-1">
              <SebaSymbol className="w-3 h-3" />
              {t("call_incoming")}
            </p>
            <p className="text-base font-semibold leading-tight">
              {pendingCall.callerName ?? t("call_unknown_caller")}
            </p>
            <p className="text-xs text-white/50">
              {pendingCall.audioOnly ? t("call_audio_only") : t("call_video")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 text-white gap-1.5"
            onClick={handleDecline}
            disabled={declineMut.isPending}
          >
            <PhoneOff className="w-3.5 h-3.5" />
            {t("call_decline")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 border-green-600 text-white gap-1.5"
            onClick={() => handleAccept(true)}
            disabled={acceptMut.isPending}
          >
            <Phone className="w-3.5 h-3.5" />
            {t("call_audio")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-blue-500 hover:bg-blue-600 border-blue-500 text-white gap-1.5"
            onClick={() => handleAccept(false)}
            disabled={acceptMut.isPending}
          >
            <Video className="w-3.5 h-3.5" />
            {t("call_video")}
          </Button>
        </div>
      </div>
    </div>
  );
}
