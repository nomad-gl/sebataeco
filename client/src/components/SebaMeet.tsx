/**
 * SebaMeet — Sovereign WebRTC Video Call Engine
 *
 * Replaces the Jitsi iframe with a fully self-hosted peer-to-peer call.
 * Uses tRPC polling for signalling (offer/answer/ICE) — no external service.
 *
 * Architecture:
 * - One RTCPeerConnection per remote peer
 * - STUN servers: Google + Cloudflare (public, no auth required)
 * - Signalling: tRPC webrtc.sendSignal / webrtc.pollSignals (polls every 1.5 s)
 * - Screen share: getDisplayMedia, replaces video track on all peer connections
 * - Reactions: local animated overlay, no network needed
 * - Recording notice: local state, sends owner notification
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { SebaSymbol } from "@/components/SebaSymbol";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff,
  Hand, ThumbsUp, Smile, Heart, Circle,
  Volume2, VolumeX, Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Peer {
  id: number;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  muted: boolean;
}

interface Reaction {
  id: number;
  emoji: string;
  x: number;
}

interface SebaMeetProps {
  roomName: string;
  channelName?: string;
  audioOnly?: boolean;
  schoolLogoUrl?: string;
  onEnd: () => void;
}

// ─── STUN configuration ───────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let reactionCounter = 0;
const REACTIONS = ["✋", "👍", "👏", "😄", "❤️"];

// ─── Component ────────────────────────────────────────────────────────────────

export function SebaMeet({
  roomName,
  channelName,
  audioOnly = false,
  schoolLogoUrl,
  onEnd,
}: SebaMeetProps) {
  const { t } = useI18n();

  // ── Local media state ──
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(audioOnly);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ── Peers ──
  const [peers, setPeers] = useState<Peer[]>([]);
  const peersRef = useRef<Peer[]>([]);
  const myIdRef = useRef<number | null>(null);

  // ── UI state ──
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [recording, setRecording] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── tRPC ──
  const joinRoom = trpc.webrtc.joinRoom.useMutation();
  const sendSignal = trpc.webrtc.sendSignal.useMutation();
  const leaveRoom = trpc.webrtc.leaveRoom.useMutation();
  const notifyOwner = trpc.system.notifyOwner.useMutation();

  // Poll for signals every 1.5 s
  const { data: incomingSignals } = trpc.webrtc.pollSignals.useQuery(
    { roomName },
    { refetchInterval: 1500, refetchIntervalInBackground: true }
  );

  // ── Create peer connection ──────────────────────────────────────────────────

  const createPeerConnection = useCallback(
    (peerId: number, peerName: string): Peer => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const videoRef = { current: null } as unknown as React.RefObject<HTMLVideoElement>;

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // ICE candidates → send via signalling
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal.mutate({
            roomName,
            toUserId: peerId,
            type: "ice-candidate",
            payload: JSON.stringify(e.candidate),
          });
        }
      };

      // Remote stream → attach to video element
      const remoteStream = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
      };

      const peer: Peer = {
        id: peerId,
        name: peerName,
        pc,
        stream: remoteStream,
        videoRef,
        muted: false,
      };

      return peer;
    },
    [roomName, sendSignal]
  );

  // ── Initialise: get media + join room ─────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: !audioOnly,
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch {
        // Camera/mic denied — continue without local stream
      }

      // Join room
      try {
        const result = await joinRoom.mutateAsync({ roomName });
        if (cancelled) return;
        myIdRef.current = result.myId;

        // For each existing peer, create a PC and send an offer
        for (const remotePeer of result.peers) {
          const peer = createPeerConnection(remotePeer.id, remotePeer.name);
          const offer = await peer.pc.createOffer();
          await peer.pc.setLocalDescription(offer);
          sendSignal.mutate({
            roomName,
            toUserId: remotePeer.id,
            type: "offer",
            payload: JSON.stringify(offer),
          });
          peersRef.current = [...peersRef.current, peer];
          if (!cancelled) setPeers([...peersRef.current]);
        }
      } catch (e) {
        console.error("SebaMeet joinRoom error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // ── Process incoming signals ───────────────────────────────────────────────

  useEffect(() => {
    if (!incomingSignals || incomingSignals.length === 0) return;

    (async () => {
      for (const signal of incomingSignals) {
        const fromId = signal.fromUserId;
        if (fromId === myIdRef.current) continue;

        let peer = peersRef.current.find((p) => p.id === fromId);

        if (signal.type === "offer") {
          // New peer is calling us — create PC and answer
          if (!peer) {
            peer = createPeerConnection(fromId, `User ${fromId}`);
            peersRef.current = [...peersRef.current, peer];
            setPeers([...peersRef.current]);
          }
          const offer = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
          await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          sendSignal.mutate({
            roomName,
            toUserId: fromId,
            type: "answer",
            payload: JSON.stringify(answer),
          });
        } else if (signal.type === "answer" && peer) {
          const answer = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
          if (peer.pc.signalingState !== "stable") {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } else if (signal.type === "ice-candidate" && peer) {
          try {
            const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
            await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // Stale candidate — ignore
          }
        } else if (signal.type === "leave") {
          if (peer) {
            peer.pc.close();
            peersRef.current = peersRef.current.filter((p) => p.id !== fromId);
            setPeers([...peersRef.current]);
          }
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSignals]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      leaveRoom.mutate({ roomName });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((p) => p.pc.close());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // ── Controls ───────────────────────────────────────────────────────────────

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = audioMuted; });
    setAudioMuted((m) => !m);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = videoMuted; });
    setVideoMuted((m) => !m);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Stop screen share — restore camera
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        peersRef.current.forEach((p) => {
          const sender = p.pc.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(camTrack);
        });
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        setScreenSharing(true);
        peersRef.current.forEach((p) => {
          const sender = p.pc.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(screenTrack);
        });
        // Auto-stop when user clicks browser's "Stop sharing"
        screenTrack.onended = () => {
          setScreenSharing(false);
          screenStreamRef.current = null;
          const camTrack = localStreamRef.current?.getVideoTracks()[0];
          if (camTrack) {
            peersRef.current.forEach((p) => {
              const sender = p.pc.getSenders().find((s) => s.track?.kind === "video");
              sender?.replaceTrack(camTrack);
            });
          }
        };
      } catch {
        // User cancelled
      }
    }
  };

  const sendReaction = (emoji: string) => {
    const id = ++reactionCounter;
    const x = 10 + Math.random() * 80;
    setReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
  };

  const toggleRecording = () => {
    const next = !recording;
    setRecording(next);
    if (next) {
      notifyOwner.mutate({
        title: "SebaMeet Recording Started",
        content: `Recording started in room: ${roomName}`,
      });
    }
  };

  const handleEnd = () => {
    leaveRoom.mutate({ roomName });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((p) => p.pc.close());
    onEnd();
  };

  // Auto-hide controls after 4 s of inactivity
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalParticipants = 1 + peers.length;

  return (
    <div
      className="relative w-full h-full bg-gray-950 flex flex-col overflow-hidden select-none"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* ── Header ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        {/* Left: SEBA branding */}
        <div className="flex items-center gap-2">
          <SebaSymbol className="w-7 h-7 text-white" />
          <span className="text-white font-bold text-sm tracking-wide">SebaMeet</span>
          {channelName && (
            <span className="text-white/60 text-xs ml-1">· {channelName}</span>
          )}
        </div>

        {/* Right: school logo + participant count */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-white/70 text-xs">
            <Users className="w-3.5 h-3.5" />
            {totalParticipants}
          </span>
          {schoolLogoUrl && (
            <img
              src={schoolLogoUrl}
              alt="School logo"
              className="h-7 w-auto object-contain opacity-90"
            />
          )}
        </div>
      </div>

      {/* ── Recording banner ── */}
      {recording && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-red-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Recording
        </div>
      )}

      {/* ── Video grid ── */}
      <div
        className={`flex-1 grid gap-1 p-1 pt-14 ${
          totalParticipants === 1
            ? "grid-cols-1"
            : totalParticipants === 2
            ? "grid-cols-2"
            : totalParticipants <= 4
            ? "grid-cols-2"
            : "grid-cols-3"
        }`}
      >
        {/* Local video */}
        <div className="relative rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
          {videoMuted ? (
            <div className="flex flex-col items-center gap-2 text-white/40">
              <VideoOff className="w-8 h-8" />
              <span className="text-xs">Camera off</span>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {audioMuted && <MicOff className="w-3 h-3 text-red-400" />}
            <span>You</span>
          </div>
          {screenSharing && (
            <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
              Sharing
            </div>
          )}
        </div>

        {/* Remote peers */}
        {peers.map((peer) => (
          <div
            key={peer.id}
            className="relative rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center"
          >
            <video
              ref={(el) => {
                (peer.videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                if (el && peer.stream) el.srcObject = peer.stream;
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              <Circle className="w-2 h-2 fill-green-400 text-green-400" />
              <span>{peer.name}</span>
            </div>
          </div>
        ))}

        {/* Empty state when alone */}
        {peers.length === 0 && (
          <div className="flex flex-col items-center justify-center text-white/30 gap-3">
            <Users className="w-10 h-10" />
            <p className="text-sm">Waiting for others to join…</p>
          </div>
        )}
      </div>

      {/* ── Reaction overlays ── */}
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-24 text-3xl animate-bounce pointer-events-none z-30"
          style={{ left: `${r.x}%` }}
        >
          {r.emoji}
        </div>
      ))}

      {/* ── Controls bar ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-center gap-2 pb-5 pt-3 bg-gradient-to-t from-black/80 to-transparent">
          {/* Reactions */}
          <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 mr-2">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-lg hover:scale-125 transition-transform px-0.5"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Mute audio */}
          <button
            onClick={toggleAudio}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              audioMuted ? "bg-red-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
            }`}
            title={audioMuted ? "Unmute" : "Mute"}
          >
            {audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle video */}
          {!audioOnly && (
            <button
              onClick={toggleVideo}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                videoMuted ? "bg-red-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
              }`}
              title={videoMuted ? "Start video" : "Stop video"}
            >
              {videoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          {/* Screen share */}
          <button
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              screenSharing ? "bg-blue-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
            }`}
            title={screenSharing ? "Stop sharing" : "Share screen"}
          >
            {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Recording */}
          <button
            onClick={toggleRecording}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              recording ? "bg-red-600 text-white animate-pulse" : "bg-white/15 text-white hover:bg-white/25"
            }`}
            title={recording ? "Stop recording notice" : "Start recording notice"}
          >
            <Circle className="w-4 h-4 fill-current" />
          </button>

          {/* End call */}
          <button
            onClick={handleEnd}
            className="w-14 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors ml-2"
            title="End call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
