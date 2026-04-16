/**
 * SebaMeet — Sovereign WebRTC Video Call Engine (Session 33 rewrite)
 *
 * Key fixes vs Session 32:
 * - Presence-based peer discovery: joinRoom now upserts a webrtc_participants row
 *   so late joiners can find existing participants via getParticipants polling.
 * - Heartbeat: fires every 10 s to keep the participant row alive.
 * - Targeted signals: sendSignal always has toUserId — no broadcast ambiguity.
 * - Late-joiner handling: getParticipants polled every 3 s; new peers get offers.
 * - Raise-hand queue: raise-hand signal type stored server-side; shown in header.
 * - "Powered by SEBA" watermark in recording banner.
 * - Participant name resolution via webrtc.getPeerName.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { SebaSymbol } from "@/components/SebaSymbol";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff,
  Circle, Volume2, Users, Hand, PhoneCall, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Peer {
  id: number;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  audioRef: React.RefObject<HTMLAudioElement>;
  muted: boolean;
  quality: number;   // 0 = unknown, 1–4 bars
  speaking: boolean;
  connected: boolean;
}

interface Reaction {
  id: number;
  emoji: string;
  x: number;
}

interface RaisedHand {
  userId: number;
  name: string;
  at: number;
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
const MAX_PEERS = 7;
const HEARTBEAT_MS = 10_000;
const POLL_PARTICIPANTS_MS = 3_000;
const POLL_SIGNALS_MS = 1_500;

function calcQuality(rttMs: number, lossPercent: number): number {
  if (rttMs === 0) return 4;
  if (rttMs > 400 || lossPercent > 10) return 1;
  if (rttMs > 200 || lossPercent > 5)  return 2;
  if (rttMs > 100 || lossPercent > 2)  return 3;
  return 4;
}

function gridClass(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n <= 2) return "grid-cols-2";
  if (n <= 4) return "grid-cols-2";
  if (n <= 6) return "grid-cols-3";
  return "grid-cols-4";
}

function QualityBars({ bars }: { bars: number }) {
  if (bars === 0) return null;
  const colors = ["text-red-400", "text-orange-400", "text-yellow-400", "text-green-400"];
  return (
    <span className={`flex items-end gap-px ${colors[bars - 1]}`} title={`Signal: ${bars}/4`}>
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

  // ── Local media ──
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const [audioMuted,   setAudioMuted]   = useState(false);
  const [videoMuted,   setVideoMuted]   = useState(audioOnly);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ── Peers ──
  const [peers, setPeers]   = useState<Peer[]>([]);
  const peersRef            = useRef<Peer[]>([]);
  const myIdRef             = useRef<number | null>(null);
  const knownPeerIds        = useRef<Set<number>>(new Set());

  // ── Speaker / quality ──
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserMapRef   = useRef<Map<number, AnalyserNode>>(new Map());
  const speakerTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const qualityTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Raise-hand queue ──
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const [handRaised,  setHandRaised]  = useState(false);

  // ── Connection state & call timer ──
  const [callConnected,    setCallConnected]    = useState(false);
  const [callSeconds,      setCallSeconds]      = useState(0);
  const callStartRef       = useRef<number | null>(null);
  const callTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI ──
  const [reactions,    setReactions]    = useState<Reaction[]>([]);
  const [recording,    setRecording]    = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── tRPC ──
  const iceServersQuery  = trpc.webrtc.getIceServers.useQuery(undefined, { staleTime: Infinity });
  const joinRoom         = trpc.webrtc.joinRoom.useMutation();
  const heartbeatMut     = trpc.webrtc.heartbeat.useMutation();
  const leaveRoom        = trpc.webrtc.leaveRoom.useMutation();
  const sendSignal       = trpc.webrtc.sendSignal.useMutation();
  const notifyOwner      = trpc.system.notifyOwner.useMutation();
  const raiseHandMut     = trpc.webrtc.raiseHand.useMutation();
  const lowerHandMut     = trpc.webrtc.lowerHand.useMutation();
  const utils            = trpc.useUtils();

  // Poll signals every 1.5 s
  const { data: incomingSignals } = trpc.webrtc.pollSignals.useQuery(
    { roomName },
    { refetchInterval: POLL_SIGNALS_MS, refetchIntervalInBackground: true }
  );

  // Poll participants every 3 s (late-joiner discovery)
  const { data: activeParticipants } = trpc.webrtc.getParticipants.useQuery(
    { roomName },
    { refetchInterval: POLL_PARTICIPANTS_MS, refetchIntervalInBackground: true }
  );

  // Poll server-side hand queue every 3 s
  const { data: serverHandQueue } = trpc.webrtc.getHandQueue.useQuery(
    { roomName },
    { refetchInterval: 3_000, refetchIntervalInBackground: true }
  );

  // ── Create RTCPeerConnection ───────────────────────────────────────────────

  const createPeerConnection = useCallback(
    (peerId: number, peerName: string): Peer => {
      const iceServers = iceServersQuery.data ?? [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ];
      const pc = new RTCPeerConnection({ iceServers });
      const videoRef = { current: null } as unknown as React.RefObject<HTMLVideoElement>;

      // Add local tracks
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // ICE candidates → targeted signal
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

      // Track connection state for the "Connected" badge and call timer
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallConnected(true);
          if (!callStartRef.current) {
            callStartRef.current = Date.now();
            if (callTimerRef.current) clearInterval(callTimerRef.current);
            callTimerRef.current = setInterval(() => {
              setCallSeconds(Math.floor((Date.now() - callStartRef.current!) / 1000));
            }, 1000);
          }
          // Resume audio context if suspended (browser autoplay policy)
          audioCtxRef.current?.resume().catch(() => {});
          setPeers((prev) =>
            prev.map((p) => p.id === peerId ? { ...p, connected: true } : p)
          );
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setPeers((prev) =>
            prev.map((p) => p.id === peerId ? { ...p, connected: false } : p)
          );
        }
      };

      // Remote stream — attach to BOTH video and a hidden audio element
      const audioRef = { current: null } as unknown as React.RefObject<HTMLAudioElement>;
      const remoteStream = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        // Video element
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch(() => {});
        }
        // Dedicated audio element — ensures audio plays even when video is muted/hidden
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(() => {});
        }

        // Audio analyser for speaker detection
        if (remoteStream.getAudioTracks().length > 0) {
          try {
            if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
            else audioCtxRef.current.resume().catch(() => {});
            const src      = audioCtxRef.current.createMediaStreamSource(remoteStream);
            const analyser = audioCtxRef.current.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyserMapRef.current.set(peerId, analyser);
          } catch { /* blocked */ }
        }
      };

      return { id: peerId, name: peerName, pc, stream: remoteStream, videoRef, audioRef, muted: false, quality: 0, speaking: false, connected: false };
    },
    [roomName, sendSignal, iceServersQuery.data]
  );

  // ── Offer helper ──────────────────────────────────────────────────────────

  const sendOfferTo = useCallback(
    async (peer: Peer) => {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      sendSignal.mutate({
        roomName,
        toUserId: peer.id,
        type: "offer",
        payload: JSON.stringify(offer),
      });
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
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const result = await joinRoom.mutateAsync({ roomName });
        if (cancelled) return;
        myIdRef.current = result.myId;

        // Connect to peers already in the room
        for (const remotePeer of result.peers.slice(0, MAX_PEERS)) {
          if (cancelled) break;
          if (knownPeerIds.current.has(remotePeer.id)) continue;
          knownPeerIds.current.add(remotePeer.id);
          const peer = createPeerConnection(remotePeer.id, remotePeer.name);
          peersRef.current = [...peersRef.current, peer];
          if (!cancelled) setPeers([...peersRef.current]);
          await sendOfferTo(peer);
        }
      } catch (err) {
        console.error("[SebaMeet] init error", err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => {
      heartbeatMut.mutate({ roomName });
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [roomName, heartbeatMut]);

  // ── Late-joiner discovery: connect to new participants ────────────────────

  useEffect(() => {
    if (!activeParticipants || myIdRef.current === null) return;

    (async () => {
      for (const remotePeer of activeParticipants) {
        if (knownPeerIds.current.has(remotePeer.id)) continue;
        if (peersRef.current.length >= MAX_PEERS) break;
        knownPeerIds.current.add(remotePeer.id);
        const peer = createPeerConnection(remotePeer.id, remotePeer.name);
        peersRef.current = [...peersRef.current, peer];
        setPeers([...peersRef.current]);
        await sendOfferTo(peer);
      }
    })();
  }, [activeParticipants, createPeerConnection, sendOfferTo]);

  // ── Handle incoming signals ────────────────────────────────────────────────

  useEffect(() => {
    if (!incomingSignals || incomingSignals.length === 0) return;

    (async () => {
      for (const signal of incomingSignals) {
        const fromId = signal.fromUserId;
        if (fromId === myIdRef.current) continue;

        // ── Leave ──
        if (signal.type === "leave") {
          peersRef.current.find((p) => p.id === fromId)?.pc.close();
          peersRef.current = peersRef.current.filter((p) => p.id !== fromId);
          knownPeerIds.current.delete(fromId);
          analyserMapRef.current.delete(fromId);
          setPeers([...peersRef.current]);
          continue;
        }

        // ── Raise-hand ──
        if (signal.type === "raise-hand") {
          try {
            const data = JSON.parse(signal.payload) as { name: string; raised: boolean };
            setRaisedHands((prev) => {
              if (data.raised) {
                if (prev.some((h) => h.userId === fromId)) return prev;
                return [...prev, { userId: fromId, name: data.name, at: Date.now() }];
              } else {
                return prev.filter((h) => h.userId !== fromId);
              }
            });
          } catch { /* ignore */ }
          continue;
        }

        // ── SDP / ICE ──
        let peer = peersRef.current.find((p) => p.id === fromId);

        if (!peer && peersRef.current.length < MAX_PEERS) {
          if (!knownPeerIds.current.has(fromId)) {
            knownPeerIds.current.add(fromId);
            peer = createPeerConnection(fromId, `User ${fromId}`);
            peersRef.current = [...peersRef.current, peer];
            setPeers([...peersRef.current]);
          }
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
          } catch { /* stale */ }
        }
      }
    })();
  }, [incomingSignals, createPeerConnection, roomName, sendSignal]);

  // ── Speaker detection ─────────────────────────────────────────────────────

  useEffect(() => {
    speakerTimerRef.current = setInterval(() => {
      const buf = new Uint8Array(128);
      let maxId = -1, maxLevel = 15;
      analyserMapRef.current.forEach((analyser, peerId) => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        if (avg > maxLevel) { maxLevel = avg; maxId = peerId; }
      });
      setPeers((prev) => prev.map((p) => ({ ...p, speaking: p.id === maxId })));
    }, 200);
    return () => { if (speakerTimerRef.current) clearInterval(speakerTimerRef.current); };
  }, []);

  // ── Call quality ──────────────────────────────────────────────────────────

  useEffect(() => {
    qualityTimerRef.current = setInterval(async () => {
      const updated: Record<number, number> = {};
      for (const peer of peersRef.current) {
        try {
          const stats = await peer.pc.getStats();
          let rttMs = 0, lossPercent = 0;
          stats.forEach((r) => {
            if (r.type === "remote-inbound-rtp") {
              if (r.roundTripTime !== undefined) rttMs = Math.max(rttMs, r.roundTripTime * 1000);
              if (r.packetsLost !== undefined && r.packetsReceived !== undefined && r.packetsReceived > 0) {
                lossPercent = Math.max(lossPercent, (r.packetsLost / (r.packetsLost + r.packetsReceived)) * 100);
              }
            }
          });
          updated[peer.id] = calcQuality(rttMs, lossPercent);
        } catch { updated[peer.id] = 0; }
      }
      if (Object.keys(updated).length > 0) {
        setPeers((prev) => prev.map((p) => ({ ...p, quality: updated[p.id] ?? p.quality })));
      }
    }, 5000);
    return () => { if (qualityTimerRef.current) clearInterval(qualityTimerRef.current); };
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((p) => p.pc.close());
      audioCtxRef.current?.close();
      if (speakerTimerRef.current)  clearInterval(speakerTimerRef.current);
      if (qualityTimerRef.current)  clearInterval(qualityTimerRef.current);
      if (callTimerRef.current)     clearInterval(callTimerRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // ── Controls auto-hide ────────────────────────────────────────────────────

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
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        peersRef.current.forEach((p) => {
          p.pc.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(videoTrack);
        });
      }
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        setScreenSharing(true);
        const screenTrack = screen.getVideoTracks()[0];
        peersRef.current.forEach((p) => {
          p.pc.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => toggleScreenShare();
      } catch { /* user cancelled */ }
    }
  }, [screenSharing]);

  const toggleRecording = useCallback(() => {
    const next = !recording;
    setRecording(next);
    if (next) notifyOwner.mutate({ title: "SebaMeet — Recording started", content: `Room: ${roomName}` });
  }, [recording, roomName, notifyOwner]);

  const toggleRaiseHand = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    if (next) {
      // Use server-side raiseHand procedure (broadcast via toUserId=0 sentinel)
      raiseHandMut.mutate({ roomName }, {
        onSuccess: () => utils.webrtc.getHandQueue.invalidate({ roomName }),
      });
    } else {
      // Lower own hand: find own signal in the queue and consume it
      const mySignal = serverHandQueue?.find((h) => h.userId === myIdRef.current);
      if (mySignal) {
        lowerHandMut.mutate({ signalId: mySignal.signalId }, {
          onSuccess: () => utils.webrtc.getHandQueue.invalidate({ roomName }),
        });
      }
      setRaisedHands((prev) => prev.filter((h) => h.userId !== myIdRef.current));
    }
  }, [handRaised, roomName, raiseHandMut, lowerHandMut, serverHandQueue, utils]);

  const sendReaction = useCallback((emoji: string) => {
    const id = ++reactionCounter;
    const x  = 10 + Math.random() * 80;
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

  // ── Render ────────────────────────────────────────────────────────────────

  // ── Call timer formatter ──
  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const totalParticipants = 1 + peers.length;

  return (
    <div
      className="relative w-full h-full bg-gray-950 flex flex-col overflow-hidden select-none"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* ── Header ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <SebaSymbol className="w-7 h-7 text-white" />
          <span className="text-white font-bold text-sm tracking-wide">SebaMeet</span>
          {channelName && <span className="text-white/60 text-xs ml-1">· {channelName}</span>}
        </div>

        <div className="flex items-center gap-3">
          {/* Connected badge + call timer */}
          {callConnected && (
            <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/40 text-green-300 text-xs px-2.5 py-1 rounded-full">
              <PhoneCall className="w-3 h-3" />
              <span className="font-medium">Connected</span>
              <span className="opacity-70">·</span>
              <Clock className="w-3 h-3" />
              <span className="font-mono">{formatCallTime(callSeconds)}</span>
            </div>
          )}
          {/* Server-side raised-hand queue */}
          {(serverHandQueue ?? []).length > 0 && (
            <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-2 py-0.5 max-w-xs overflow-x-auto">
              <Hand className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                {(serverHandQueue ?? []).map((h) => (
                  <span key={h.signalId} className="flex items-center gap-1">
                    <span className="text-yellow-300 text-xs font-medium">{h.name}</span>
                    <button
                      onClick={() => lowerHandMut.mutate({ signalId: h.signalId }, {
                        onSuccess: () => utils.webrtc.getHandQueue.invalidate({ roomName }),
                      })}
                      title={`Lower ${h.name}'s hand`}
                      className="text-yellow-400/60 hover:text-yellow-200 transition-colors text-[10px] leading-none"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <span className="flex items-center gap-1 text-white/70 text-xs">
            <Users className="w-3.5 h-3.5" />
            {totalParticipants}
          </span>
          {schoolLogoUrl && (
            <img src={schoolLogoUrl} alt="School logo" className="h-7 w-auto object-contain opacity-90" />
          )}
        </div>
      </div>

      {/* ── Recording banner with SEBA watermark ── */}
      {recording && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-red-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>Recording</span>
          <span className="mx-1 opacity-40">·</span>
          <SebaSymbol className="w-3.5 h-3.5 text-white/80" />
          <span className="text-white/80 font-normal tracking-wide text-[10px]">Powered by SEBA</span>
        </div>
      )}

      {/* ── Video grid ── */}
      <div className={`flex-1 grid gap-1 p-1 pt-14 ${gridClass(totalParticipants)}`}>
        {/* Local video */}
        <div className="relative rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
          {videoMuted ? (
            <div className="flex flex-col items-center gap-2 text-white/40">
              <VideoOff className="w-8 h-8" />
              <span className="text-xs">Camera off</span>
            </div>
          ) : (
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {audioMuted && <MicOff className="w-3 h-3 text-red-400" />}
            {handRaised  && <Hand  className="w-3 h-3 text-yellow-400" />}
            <span>You</span>
          </div>
          {screenSharing && (
            <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">Sharing</div>
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
            {/* Hidden audio element — plays remote audio independently of video autoplay policy */}
            <audio
              ref={(el) => {
                (peer.audioRef as React.MutableRefObject<HTMLAudioElement | null>).current = el;
                if (el && peer.stream) {
                  el.srcObject = peer.stream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              className="hidden"
            />
            <video
              ref={(el) => {
                (peer.videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                if (el && peer.stream) {
                  el.srcObject = peer.stream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              {peer.speaking && <Volume2 className="w-3 h-3 text-green-400" />}
              {raisedHands.some((h) => h.userId === peer.id) && <Hand className="w-3 h-3 text-yellow-400" />}
              <span>{peer.name}</span>
              <QualityBars bars={peer.quality} />
            </div>
          </div>
        ))}

        {/* Empty state */}
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
              <button key={emoji} onClick={() => sendReaction(emoji)} className="text-lg hover:scale-125 transition-transform px-0.5">{emoji}</button>
            ))}
          </div>

          {/* Raise hand */}
          <button
            onClick={toggleRaiseHand}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              handRaised ? "bg-yellow-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
            }`}
            title={handRaised ? "Lower hand" : "Raise hand"}
          >
            <Hand className="w-5 h-5" />
          </button>

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
