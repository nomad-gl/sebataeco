/**
 * IncomingCallBanner
 *
 * Polls trpc.dmCall.getPending every 3 seconds.
 * When a pending call is found, shows a ringing overlay banner with:
 * - Caller name and avatar
 * - Accept (video) and Accept (audio-only) buttons
 * - Decline button
 *
 * On Accept: calls trpc.dmCall.accept, then opens the pre-call screen via onAccept callback.
 * On Decline: calls trpc.dmCall.decline and dismisses.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video, Volume2, VolumeX } from "lucide-react";

interface IncomingCallBannerProps {
  /** Called when user accepts — pass room name and audioOnly flag */
  onAccept: (roomName: string, callerName: string, audioOnly: boolean) => void;
}

export function IncomingCallBanner({ onAccept }: IncomingCallBannerProps) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [ringMuted, setRingMuted] = useState(false);

  // Poll every 3 seconds
  const { data: pendingCall } = trpc.dmCall.getPending.useQuery(undefined, {
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const acceptMutation = trpc.dmCall.accept.useMutation();
  const declineMutation = trpc.dmCall.decline.useMutation();

  // Ringing sound via Web Audio API (simple beep pattern)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRinging = () => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const playBeep = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      };
      if (!ringMuted) playBeep();
      ringIntervalRef.current = setInterval(() => { if (!ringMuted) playBeep(); }, 1500);
    } catch {
      // Audio not available — silent
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

  const hasCall = pendingCall && pendingCall.id !== dismissed;

  useEffect(() => {
    if (hasCall) {
      startRinging();
    } else {
      stopRinging();
    }
    return stopRinging;
  }, [hasCall]);

  if (!hasCall) return null;

  const handleAccept = async (audioOnly: boolean) => {
    stopRinging();
    await acceptMutation.mutateAsync({ callId: pendingCall.id });
    utils.dmCall.getPending.invalidate();
    utils.dmCall.getHistory.invalidate();
    setDismissed(pendingCall.id);
    onAccept(pendingCall.roomName, pendingCall.callerName ?? "Unknown", audioOnly);
  };

  const handleDecline = async () => {
    stopRinging();
    await declineMutation.mutateAsync({ callId: pendingCall.id });
    utils.dmCall.getPending.invalidate();
    utils.dmCall.getHistory.invalidate();
    setDismissed(pendingCall.id);
  };

  const initials = (pendingCall.callerName ?? "?").charAt(0).toUpperCase();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="relative bg-[#003082] text-white rounded-2xl shadow-2xl p-4 w-80 border border-white/10">
        {/* Mute ringtone toggle */}
        <button
          onClick={() => setRingMuted((m) => !m)}
          className="absolute top-3 right-3 text-white/50 hover:text-white/90 transition-colors"
          title={ringMuted ? "Unmute ringtone" : "Mute ringtone"}
        >
          {ringMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Pulsing ring indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {initials}
            </div>
            {/* Pulsing ring */}
            <span className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-60" />
          </div>
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wider font-medium">
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

        {/* Action buttons */}
        <div className="flex gap-2">
          {/* Decline */}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 text-white gap-1.5"
            onClick={handleDecline}
            disabled={declineMutation.isPending}
          >
            <PhoneOff className="w-3.5 h-3.5" />
            {t("call_decline")}
          </Button>

          {/* Accept audio-only */}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 border-green-600 text-white gap-1.5"
            onClick={() => handleAccept(true)}
            disabled={acceptMutation.isPending}
          >
            <Phone className="w-3.5 h-3.5" />
            {t("call_audio")}
          </Button>

          {/* Accept video */}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-blue-500 hover:bg-blue-600 border-blue-500 text-white gap-1.5"
            onClick={() => handleAccept(false)}
            disabled={acceptMutation.isPending}
          >
            <Video className="w-3.5 h-3.5" />
            {t("call_video")}
          </Button>
        </div>
      </div>
    </div>
  );
}
