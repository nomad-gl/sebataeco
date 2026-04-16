/**
 * SebaMeet — Sovereign WebRTC Video Call Engine
 *
 * Replaces the Jitsi iframe with a fully self-hosted peer-to-peer call.
 * Uses tRPC polling for signalling (offer/answer/ICE) — no external service.
 *
 * Architecture:
 * - One RTCPeerConnection per remote peer (up to 8 participants)
 * - ICE servers: STUN (Google + Cloudflare) + TURN (Metered.ca relay) from server
 * - Signalling: tRPC webrtc.sendSignal / webrtc.pollSignals (polls every 1.5 s)
 * - Screen share: getDisplayMedia, replaces video track on all peer connections
 * - Speaker highlight: AudioContext analyser per peer, active speaker gets glow border
 * - Call quality: RTCPeerConnection.getStats() RTT + packet-loss → 1–4 bar icon
 * - Reactions: local animated overlay, no network needed
 * - Recording notice: local state, sends owner notification
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { SebaSymbol } from "@/components/SebaSymbol";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff,
  Hand, ThumbsUp, Smile, Heart, Circle,
  Volume2, VolumeX, Users, Wifi, WifiOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Peer {
  id: number;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  muted: boolean;
  /** 0 = unknown, 1–4 = quality bars */
  quality: number;
  /** true when this peer is the active speaker */
  speaking: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

let reactionCounter = 0;
const REACTIONS = ["✋", "👍", "👏", "😄", "❤️"];
const MAX_PEERS = 7; // 1 local + 7 remote = 8 total

/** Map RTT (ms) + packet-loss (%) to 1–4 quality bars */
function calcQuality(rttMs: number, lossPercent: number): number {
  if (rttMs === 0) return 4; // no data yet → optimistic
  if (rttMs > 400 || lossPercent > 10) return 1;
  if (rttMs > 200 || lossPercent > 5) return 2;
  if (rttMs > 100 || lossPercent > 2) return 3;
  return 4;
}

/** Grid class based on total participant count */
function gridClass(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n <= 2) return "grid-cols-2";
  if (n <= 4) return "grid-cols-2";
  if (n <= 6) return "grid-cols-3";
  return "grid-cols-4";
}

/** Quality bar icon component */
function QualityBars({ bars }: { bars: number }) {
  if (bars === 0) return null;
  const colors = ["text-red-400", "text-orange-400", "text-yellow-400", "text-green-400"];
  const color = colors[bars - 1];
  return (
    <span className={`flex items-end gap-px ${color}`} title={`Signal: ${bars}/4`}>
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={`inline-block w-0.5 rounded-sm ${b <= bars ? "opacity-100" : "opacity-25"}`}
          style={{ height: `${b * 3 + 2}px`, background: "currentColor" }}
        />
      ))}
    </span>
  );
}

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

  // ── Speaker detection ──
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserMapRef = useRef<Map<number, AnalyserNode>>(new Map());
  const speakerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Quality polling ──
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI state ──
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [recording, setRecording] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── tRPC ──
  const iceServersQuery = trpc.webrtc.getIceServers.useQuery(undefined, {
    staleTime: Infinity,
  });
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
      const iceServers = iceServersQuery.data ?? [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ];
      const pc = new RTCPeerConnection({ iceServers });
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

      // Remote stream → attach to video element + set up audio analyser
      const remoteStream = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
        // Set up audio analyser for speaker detection
        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length > 0) {
          try {
            if (!audioCtxRef.current) {
              audioCtxRef.current = new AudioContext();
            }
            const source = audioCtxRef.current.createMediaStreamSource(remoteStream);
            const analyser = audioCtxRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserMapRef.current.set(peerId, analyser);
          } catch {
            // AudioContext may be blocked in some browsers
          }
        }
      };

      const peer: Peer = {
        id: peerId,
        name: peerName,
        pc,
        stream: remoteStream,
        videoRef,
        muted: false,
        quality: 0,
        speaking: false,
      };

      return peer;
    },
    [roomName, sendSignal, iceServersQuery.data]
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

        const result = await joinRoom.mutateAsync({ roomName });
        if (cancelled) return;
        myIdRef.current = result.myId;

        // Connect to existing peers (up to MAX_PEERS)
        for (const remotePeer of result.peers.slice(0, MAX_PEERS)) {
          if (cancelled) break;
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
      } catch (err) {
        console.error("[SebaMeet] init error", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // ── Handle incoming signals ────────────────────────────────────────────────

  useEffect(() => {
    if (!incomingSignals || incomingSignals.length === 0) return;

    (async () => {
      for (const signal of incomingSignals) {
        const fromId = signal.fromUserId;
        if (fromId === myIdRef.current) continue;

        if (signal.type === "leave") {
          peersRef.current.find((p) => p.id === fromId)?.pc.close();
          peersRef.current = peersRef.current.filter((p) => p.id !== fromId);
          analyserMapRef.current.delete(fromId);
          setPeers([...peersRef.current]);
          continue;
        }

        let peer = peersRef.current.find((p) => p.id === fromId);

        if (!peer && peersRef.current.length < MAX_PEERS) {
          peer = createPeerConnection(fromId, `User ${fromId}`);
          peersRef.current = [...peersRef.current, peer];
          setPeers([...peersRef.current]);
        }

        if (!peer) continue;

        const payload = JSON.parse(signal.payload);

        if (signal.type === "offer") {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          sendSignal.mutate({
            roomName,
            toUserId: fromId,
            type: "answer",
            payload: JSON.stringify(answer),
          });
        } else if (signal.type === "answer") {
          if (peer.pc.signalingState !== "stable") {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(payload));
          }
        } else if (signal.type === "ice-candidate") {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(payload));
          } catch {
            // ignore stale candidates
          }
        }
      }
    })();
  }, [incomingSignals, createPeerConnection, roomName, sendSignal]);

  // ── Speaker detection (audio level polling every 200 ms) ──────────────────

  useEffect(() => {
    speakerTimerRef.current = setInterval(() => {
      const buf = new Uint8Array(128);
      let maxPeerId = -1;
      let maxLevel = 15; // threshold — below this = silence

      analyserMapRef.current.forEach((analyser, peerId) => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        if (avg > maxLevel) {
          maxLevel = avg;
          maxPeerId = peerId;
        }
      });

      setPeers((prev) =>
        prev.map((p) => ({ ...p, speaking: p.id === maxPeerId }))
      );
    }, 200);

    return () => {
      if (speakerTimerRef.current) clearInterval(speakerTimerRef.current);
    };
  }, []);

  // ── Call quality polling (getStats every 5 s) ─────────────────────────────

  useEffect(() => {
    qualityTimerRef.current = setInterval(async () => {
      const updated: Record<number, number> = {};

      for (const peer of peersRef.current) {
        try {
          const stats = await peer.pc.getStats();
          let rttMs = 0;
          let lossPercent = 0;

          stats.forEach((report) => {
            if (report.type === "remote-inbound-rtp") {
              if (report.roundTripTime !== undefined) {
                rttMs = Math.max(rttMs, report.roundTripTime * 1000);
              }
              if (
                report.packetsLost !== undefined &&
                report.packetsReceived !== undefined &&
                report.packetsReceived > 0
              ) {
                lossPercent = Math.max(
                  lossPercent,
                  (report.packetsLost / (report.packetsLost + report.packetsReceived)) * 100
                );
              }
            }
          });

          updated[peer.id] = calcQuality(rttMs, lossPercent);
        } catch {
          updated[peer.id] = 0;
        }
      }

      if (Object.keys(updated).length > 0) {
        setPeers((prev) =>
          prev.map((p) => ({ ...p, quality: updated[p.id] ?? p.quality }))
        );
      }
    }, 5000);

    return () => {
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    };
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((p) => p.pc.close());
      audioCtxRef.current?.close();
      if (speakerTimerRef.current) clearInterval(speakerTimerRef.current);
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // ── Controls auto-hide ─────────────────────────────────────────────────────

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  // ── Media controls ────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !audioMuted;
    stream.getAudioTracks().forEach((t) => { t.enabled = enabled; });
    setAudioMuted(!enabled);
  }, [audioMuted]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !videoMuted;
    stream.getVideoTracks().forEach((t) => { t.enabled = enabled; });
    setVideoMuted(!enabled);
  }, [videoMuted]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      // Restore camera track on all peers
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        peersRef.current.forEach((p) => {
          const sender = p.pc.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(videoTrack);
        });
      }
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        setScreenSharing(true);
        const screenTrack = screen.getVideoTracks()[0];
        peersRef.current.forEach((p) => {
          const sender = p.pc.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => toggleScreenShare();
      } catch {
        // user cancelled
      }
    }
  }, [screenSharing]);

  const toggleRecording = useCallback(() => {
    const next = !recording;
    setRecording(next);
    if (next) {
      notifyOwner.mutate({
        title: "SebaMeet — Recording started",
        content: `Recording started in room: ${roomName}`,
      });
    }
  }, [recording, roomName, notifyOwner]);

  const sendReaction = useCallback((emoji: string) => {
    const id = ++reactionCounter;
    const x = 10 + Math.random() * 80;
    setReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
  }, []);

  const handleEnd = useCallback(() => {
    leaveRoom.mutate({ roomName });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((p) => p.pc.close());
    onEnd();
  }, [leaveRoom, roomName, onEnd]);

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
        className={`flex-1 grid gap-1 p-1 pt-14 ${gridClass(totalParticipants)}`}
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
            className={`relative rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center transition-all duration-200 ${
              peer.speaking ? "ring-2 ring-green-400 ring-offset-1 ring-offset-gray-950" : ""
            }`}
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
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              {peer.speaking && <Volume2 className="w-3 h-3 text-green-400" />}
              <span>{peer.name}</span>
              <QualityBars bars={peer.quality} />
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
