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
import { useEffect, useRef, useState, useCallback, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { SebaSymbol } from "@/components/SebaSymbol";
import { VIDEO_BACKGROUNDS, VIDEO_FILTERS } from "@/components/PreCallScreen";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff,
  Circle, Volume2, Users, Hand, PhoneCall, Clock, MessageSquare, Send as SendIcon, X, Pin,
  Settings, Sliders, CheckCircle,
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

interface ChatMessage {
  id: number;
  from: string;  // display name
  text: string;
  own: boolean;
  at: number;    // timestamp ms
}

// ─── localStorage keys (mirrors PreCallScreen) ───────────────────────────────
const LS_BG_KEY            = "seba_precall_bg";
const LS_FILTER_KEY        = "seba_precall_filter";
const LS_BLUR_INTENSITY_KEY = "seba_precall_blur_intensity";

// Mirrors PreCallScreen BLUR_RADIUS_MAP
const BLUR_RADIUS_MAP = [4, 8, 12, 16, 24]; // px

interface SebaMeetProps {
  roomName: string;
  channelName?: string;
  audioOnly?: boolean;
  schoolLogoUrl?: string;
  /** CSS filter string from the selected VideoFilter (e.g. "grayscale(1)") */
  videoFilter?: string;
  /** Background id from the selected VideoBackground */
  backgroundId?: string;
  /** DM call ID for persisting in-call chat messages */
  callId?: number;
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
  if (n <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (n <= 4) return "grid-cols-2";
  if (n <= 6) return "grid-cols-2 sm:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-4";
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

const SebaMeetInner = function SebaMeet({
  roomName,
  channelName,
  audioOnly = false,
  schoolLogoUrl,
  videoFilter,
  backgroundId,
  callId,
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

  // ── In-call chat ──
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput,   setChatInput]   = useState("");
  const chatIdRef     = useRef(0);
  const chatEndRef    = useRef<HTMLDivElement>(null);
  // Data channels: one per peer (keyed by peerId)
  const dataChannelsRef = useRef<Map<number, RTCDataChannel>>(new Map());
  // My display name (resolved once)
  const myNameRef = useRef("Me");

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

  // ── Host detection (first to join = host) ──
  const [isHost, setIsHost] = useState(false);

  // ── Call summary (shown briefly on hang-up) ──
  interface CallSummary { durationSecs: number; participantCount: number; avgQuality: number; }
  const [callSummary, setCallSummary] = useState<CallSummary | null>(null);

  // ── PiP draggable local tile (distance from bottom-right corner) ──
  const [pipPos, setPipPos] = useState({ x: 16, y: 80 });
  const [pipTransitioning, setPipTransitioning] = useState(false);

  // ── Pinned speaker (click-to-promote) ──
  const [pinnedPeerId, setPinnedPeerId] = useState<number | null>(null);

  // ── Active peer video/audio DOM refs (stable, not recreated on re-render) ──
  const activePeerVideoElRef = useRef<HTMLVideoElement | null>(null);
  const activePeerAudioElRef = useRef<HTMLAudioElement | null>(null);

  // ── Participant popover ──
  const [participantPopoverOpen, setParticipantPopoverOpen] = useState(false);

  // ── PiP double-tap to swap ──
  const pipLastTapRef = useRef<number>(0);
  const activePeerRef = useRef<Peer | null>(null);
  const handlePipDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - pipLastTapRef.current < 350) {
      // Double-tap detected — pin/unpin the active peer to swap
      const peer = activePeerRef.current;
      if (peer) {
        setPinnedPeerId((prev) => (prev === peer.id ? null : peer.id));
      }
    }
    pipLastTapRef.current = now;
  }, []);
  const pipDragRef = useRef<{ dragging: boolean; startX: number; startY: number; startPosX: number; startPosY: number }>(
    { dragging: false, startX: 0, startY: 0, startPosX: 16, startPosY: 80 }
  );

  // ── In-call settings overlay ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"backgrounds" | "filters">("backgrounds");
  // Live overrides (null = use prop/localStorage)
  const [liveFilterCss, setLiveFilterCss] = useState<string | null>(null);
  const [liveBgId, setLiveBgId] = useState<string | null>(null);
  const [liveBlurIntensity, setLiveBlurIntensity] = useState<number | null>(null);

  // ── Noise suppression toggle ──
  const [noiseSuppression, setNoiseSuppression] = useState(true);

  // ── MediaRecorder for canvas-stream recording ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // ── Host transfer ──
  const [contextMenuPeerId, setContextMenuPeerId] = useState<number | null>(null);

  // ── Persisted background / filter ──
  // Read from props (passed by PreCallScreen via callOpts) or fall back to localStorage.
  // This ensures the settings are always applied even if props are not passed.
  const resolvedFilter = liveFilterCss
    ?? videoFilter
    ?? (() => { try { return localStorage.getItem(LS_FILTER_KEY) ?? ""; } catch { return ""; } })();
  const resolvedBgId   = liveBgId
    ?? backgroundId
    ?? (() => { try { return localStorage.getItem(LS_BG_KEY) ?? "none"; } catch { return "none"; } })();

  // ── Canvas-based background compositing (mirrors PreCallScreen) ──
  const localCanvasRef   = useRef<HTMLCanvasElement>(null);
  const bgImgRef         = useRef<HTMLImageElement | null>(null);
  const segRef           = useRef<{ send?: (o: { image: HTMLVideoElement }) => Promise<void>; close?: () => void } | null>(null);
  const segAnimRef       = useRef<number>(0);
  const [bgReady,        setBgReady]        = useState(false);
  // Stable refs so onResults always reads the latest values without closure staleness
  const resolvedBgUrlRef    = useRef("");
  const resolvedBlurRadiusRef = useRef(16);
  // Cached offscreen canvas for person masking (reused every frame to avoid GC pressure)
  const personCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Resolve background URL from id
  // Read blur intensity from live override or localStorage (set by PreCallScreen)
  const resolvedBlurRadius = (() => {
    if (liveBlurIntensity !== null && liveBlurIntensity >= 1 && liveBlurIntensity <= 5) {
      return BLUR_RADIUS_MAP[liveBlurIntensity - 1];
    }
    try {
      const v = localStorage.getItem(LS_BLUR_INTENSITY_KEY);
      if (v !== null) {
        const n = parseInt(v, 10);
        if (n >= 1 && n <= 5) return BLUR_RADIUS_MAP[n - 1];
      }
    } catch { /* ignore */ }
    return 16; // default: 16px (intensity 4)
  })();

  const resolvedBgUrl = (() => {
    if (!resolvedBgId || resolvedBgId === "none") return "";
    if (resolvedBgId === "blur") return "blur";
    // If live override is set, look up from VIDEO_BACKGROUNDS catalogue
    if (liveBgId) {
      const found = VIDEO_BACKGROUNDS.find((b) => b.id === liveBgId);
      if (found?.url) return found.url;
    }
    // Fall back to localStorage-persisted URL (set by PreCallScreen)
    try {
      const stored = localStorage.getItem("seba_precall_bg_url");
      if (stored) return stored;
    } catch { /* ignore */ }
    return "";
  })();

  // Keep stable refs in sync so onResults never reads stale closure values
  useEffect(() => { resolvedBgUrlRef.current = resolvedBgUrl; }, [resolvedBgUrl]);
  useEffect(() => { resolvedBlurRadiusRef.current = resolvedBlurRadius; }, [resolvedBlurRadius]);

  // Load background image
  useEffect(() => {
    if (resolvedBgUrl && resolvedBgUrl !== "blur") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = resolvedBgUrl;
      img.onload = () => { bgImgRef.current = img; setBgReady(true); };
      img.onerror = () => { bgImgRef.current = null; };
    } else {
      bgImgRef.current = null;
    }
  }, [resolvedBgUrl]);

  // Start/stop MediaPipe segmentation for background compositing
  const stopBgSeg = useCallback(() => {
    cancelAnimationFrame(segAnimRef.current);
    segRef.current?.close?.();
    segRef.current = null;
    setBgReady(false);
  }, []);

  const startBgSeg = useCallback(async () => {
    if (segRef.current || !localVideoRef.current || videoMuted) return;
    try {
      const { SelfieSegmentation } = await import("@mediapipe/selfie_segmentation");
      const seg = new SelfieSegmentation({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}`,
      });
      seg.setOptions({ modelSelection: 1, selfieMode: true });
      seg.onResults((results: { segmentationMask: CanvasImageSource; image: CanvasImageSource }) => {
        const canvas = localCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const { width, height } = canvas;
        // Read latest values from stable refs (never stale)
        const bgUrl    = resolvedBgUrlRef.current;
        const blurPx   = resolvedBlurRadiusRef.current;
        const bgImg    = bgImgRef.current;

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        // Step 1: Draw the background layer first
        if (bgUrl === "blur") {
          ctx.filter = `blur(${blurPx}px)`;
          ctx.drawImage(results.image, 0, 0, width, height);
          ctx.filter = "none";
        } else if (bgImg) {
          // Cover-fit the background image
          const scale = Math.max(width / bgImg.naturalWidth, height / bgImg.naturalHeight);
          const sw = bgImg.naturalWidth * scale;
          const sh = bgImg.naturalHeight * scale;
          const sx = (width - sw) / 2;
          const sy = (height - sh) / 2;
          ctx.drawImage(bgImg, sx, sy, sw, sh);
        } else {
          // Background image not yet loaded — show dark placeholder
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, width, height);
        }

        // Step 2: Feather the segmentation mask edge (2px blur softens hair/edge artefacts)
        // Use a dedicated mask canvas so the blur doesn't affect the person image
        if (!personCanvasRef.current) personCanvasRef.current = document.createElement("canvas");
        const personCanvas = personCanvasRef.current;
        if (personCanvas.width !== width) personCanvas.width = width;
        if (personCanvas.height !== height) personCanvas.height = height;

        // 2a: Draw the raw mask with a small blur to feather edges
        const pCtx = personCanvas.getContext("2d")!;
        pCtx.clearRect(0, 0, width, height);
        pCtx.filter = "blur(2px)";
        pCtx.drawImage(results.segmentationMask, 0, 0, width, height);
        pCtx.filter = "none";

        // 2b: Use the feathered mask to cut out the person from the live video
        pCtx.globalCompositeOperation = "source-in";
        pCtx.drawImage(results.image, 0, 0, width, height);
        pCtx.globalCompositeOperation = "source-over";

        // Step 3: Composite the masked person over the background
        ctx.drawImage(personCanvas, 0, 0);
        ctx.restore();
      });
      await seg.initialize();
      segRef.current = seg as unknown as typeof segRef.current;
      setBgReady(true);
      const loop = async () => {
        if (localVideoRef.current && localVideoRef.current.readyState >= 2) {
          await segRef.current?.send?.({ image: localVideoRef.current });
        }
        segAnimRef.current = requestAnimationFrame(loop);
      };
      segAnimRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.warn("SebaMeet bg seg failed:", e);
    }
  }, [resolvedBgUrl, videoMuted]);

  useEffect(() => {
    if (resolvedBgUrl && !videoMuted) {
      stopBgSeg();
      const t = setTimeout(() => startBgSeg(), 50);
      return () => clearTimeout(t);
    } else {
      stopBgSeg();
    }
  }, [resolvedBgUrl, videoMuted, startBgSeg, stopBgSeg]);

  // Cleanup on unmount
  useEffect(() => () => stopBgSeg(), [stopBgSeg]);

  // ── tRPC ──
  const iceServersQuery  = trpc.webrtc.getIceServers.useQuery(undefined, { staleTime: Infinity });
  const joinRoom         = trpc.webrtc.joinRoom.useMutation();
  const heartbeatMut     = trpc.webrtc.heartbeat.useMutation();
  const leaveRoom        = trpc.webrtc.leaveRoom.useMutation();
  const sendSignal       = trpc.webrtc.sendSignal.useMutation();
  const notifyOwner      = trpc.system.notifyOwner.useMutation();
  const raiseHandMut     = trpc.webrtc.raiseHand.useMutation();
  const lowerHandMut     = trpc.webrtc.lowerHand.useMutation();
  const saveChatMsg      = trpc.callChat.saveMessage.useMutation();
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

      // Add local tracks and set encoding parameters for quality
      localStreamRef.current?.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current!);
        // Apply bitrate caps after the sender is created
        // (setParameters requires an existing offer/answer, so we defer via setTimeout)
        setTimeout(async () => {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            if (track.kind === "video") {
              params.encodings[0].maxBitrate = 2_500_000; // 2.5 Mbps
              params.encodings[0].maxFramerate = 30;
            } else if (track.kind === "audio") {
              params.encodings[0].maxBitrate = 128_000; // 128 kbps
            }
            await sender.setParameters(params);
          } catch { /* setParameters may fail before negotiation completes */ }
        }, 2000);
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

      // Data channel for in-call chat (offerer creates it; answerer receives it)
      // We create it on every peer connection; the remote side receives it via ondatachannel.
      const dc = pc.createDataChannel("chat", { ordered: true });
      dataChannelsRef.current.set(peerId, dc);
      const handleDcMessage = (data: string) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "mute-request") {
            // Host requested mute — mute local audio
            const stream = localStreamRef.current;
            if (stream) stream.getAudioTracks().forEach((t) => { t.enabled = false; });
            setAudioMuted(true);
            return;
          }
          if (parsed.type === "host-transfer") {
            // We have been made host
            setIsHost(true);
            return;
          }
          // Default: chat message
          const msg = parsed as { from: string; text: string };
          setChatMessages((prev) => [
            ...prev,
            { id: ++chatIdRef.current, from: msg.from, text: msg.text, own: false, at: Date.now() },
          ]);
        } catch { /* ignore */ }
      };
      dc.onmessage = (e) => handleDcMessage(e.data);
      pc.ondatachannel = (e) => {
        // Answerer side: replace the channel reference
        dataChannelsRef.current.set(peerId, e.channel);
        e.channel.onmessage = (ev) => handleDcMessage(ev.data);
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
          // Attempt ICE restart to recover from transient network drops
          if (pc.connectionState === "disconnected") {
            // Wait 3 s before restarting in case it self-recovers
            setTimeout(() => {
              if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                try {
                  pc.restartIce();
                  // Re-create offer with iceRestart flag if we are the offerer
                  pc.createOffer({ iceRestart: true })
                    .then((offer) => pc.setLocalDescription(offer))
                    .then(() => {
                      if (pc.localDescription) {
                        sendSignal.mutate({
                          roomName,
                          toUserId: peerId,
                          type: "offer",
                          payload: JSON.stringify(pc.localDescription),
                        });
                      }
                    })
                    .catch(() => { /* ignore if not offerer */ });
                } catch { /* ignore */ }
              }
            }, 3000);
          } else {
            // Failed state — try immediate ICE restart
            try { pc.restartIce(); } catch { /* ignore */ }
          }
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
          video: audioOnly ? false : {
            width:     { ideal: 1280, max: 1920 },
            height:    { ideal: 720,  max: 1080 },
            frameRate: { ideal: 30,   max: 30   },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl:  true,
            sampleRate:       { ideal: 48000 },
          },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const result = await joinRoom.mutateAsync({ roomName });
        if (cancelled) return;
        myIdRef.current = result.myId;
        // First to join (no existing peers) = host
        if (result.peers.length === 0) setIsHost(true);

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

  // Resolve own name from the first peer's name lookup result (use auth me)
  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: Infinity });
  useEffect(() => {
    if (meQuery.data?.name) myNameRef.current = meQuery.data.name;
  }, [meQuery.data]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((p) => p.pc.close());
      dataChannelsRef.current.forEach((dc) => dc.close());
      dataChannelsRef.current.clear();
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

  // ── Keyboard shortcuts (M = mute, V = video, Space = raise/lower hand) ────────────────

  // Ref to the raise-hand button so the Space shortcut can trigger it
  const raiseHandBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        const stream = localStreamRef.current;
        if (!stream) return;
        setAudioMuted((prev) => {
          const next = !prev;
          stream.getAudioTracks().forEach((t) => { t.enabled = !next; });
          return next;
        });
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        const stream = localStreamRef.current;
        if (!stream) return;
        setVideoMuted((prev) => {
          const next = !prev;
          stream.getVideoTracks().forEach((t) => { t.enabled = !next; });
          return next;
        });
      } else if (e.key === " ") {
        e.preventDefault();
        raiseHandBtnRef.current?.click();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Media controls ───────────────────────────────────────────────────────────────────────────────────

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
    if (next) {
      // Start recording the local canvas stream (or raw video if no canvas)
      notifyOwner.mutate({ title: "SebaMeet — Recording started", content: `Room: ${roomName}` });
      const canvas = localCanvasRef.current;
      const captureStream: MediaStream | null = canvas
        ? (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream?.(25) ?? null
        : localStreamRef.current;
      if (captureStream && typeof MediaRecorder !== "undefined") {
        recordedChunksRef.current = [];
        const mr = new MediaRecorder(captureStream, { mimeType: "video/webm;codecs=vp8" });
        mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
        };
        mr.start();
        mediaRecorderRef.current = mr;
      }
    } else {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    }
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

  // Send a chat message to all peers via data channels and persist to DB
  const sendChatMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    const payload = JSON.stringify({ from: myNameRef.current, text });
    dataChannelsRef.current.forEach((dc) => {
      if (dc.readyState === "open") dc.send(payload);
    });
    setChatMessages((prev) => [
      ...prev,
      { id: ++chatIdRef.current, from: myNameRef.current, text, own: true, at: Date.now() },
    ]);
    // Persist to DB if we have a callId (DM calls only)
    if (callId) {
      saveChatMsg.mutate({ callId, message: text });
    }
    setChatInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [chatInput, callId, saveChatMsg]);

  // Mute-all: host sends a data-channel signal to all peers requesting them to mute
  const handleMuteAll = useCallback(() => {
    const payload = JSON.stringify({ type: "mute-request" });
    dataChannelsRef.current.forEach((dc) => {
      if (dc.readyState === "open") dc.send(payload);
    });
  }, []);

  // Host transfer: send host-transfer signal to a specific peer and relinquish host status
  const handleMakeHost = useCallback((peerId: number) => {
    const dc = dataChannelsRef.current.get(peerId);
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "host-transfer" }));
    }
    setIsHost(false);
    setContextMenuPeerId(null);
  }, []);

  // Noise suppression: replace audio track with new constraints
  const toggleNoiseSuppression = useCallback(async () => {
    const next = !noiseSuppression;
    setNoiseSuppression(next);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: next, echoCancellation: true },
        video: false,
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (!newAudioTrack) return;
      // Replace in local stream
      const oldAudioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (oldAudioTrack && localStreamRef.current) {
        localStreamRef.current.removeTrack(oldAudioTrack);
        localStreamRef.current.addTrack(newAudioTrack);
        oldAudioTrack.stop();
      }
      // Replace in all peer connections
      peersRef.current.forEach((p) => {
        const sender = p.pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) sender.replaceTrack(newAudioTrack).catch(() => {});
      });
      // Respect current mute state
      newAudioTrack.enabled = !audioMuted;
    } catch { /* ignore — user may have denied */ }
  }, [noiseSuppression, audioMuted]);

  const handleEnd = useCallback(() => {
    // Build call summary before tearing down
    const durationSecs = callStartRef.current ? Math.floor((Date.now() - callStartRef.current) / 1000) : 0;
    const participantCount = 1 + peersRef.current.length;
    const qualities = peersRef.current.map((p) => p.quality).filter((q) => q > 0);
    const avgQuality = qualities.length > 0 ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : 0;
    // Show summary briefly, then call onEnd
    setCallSummary({ durationSecs, participantCount, avgQuality });
    leaveRoom.mutate({ roomName });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((p) => p.pc.close());
    dataChannelsRef.current.forEach((dc) => dc.close());
    dataChannelsRef.current.clear();
    setTimeout(() => { setCallSummary(null); onEnd(); }, 3500);
  }, [leaveRoom, roomName, onEnd]);

  // ── Render ────────────────────────────────────────────────────────────────

  // ── Call timer formatter ──
  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── PiP drag handlers ──
  const handlePipMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    pipDragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pipPos.x,
      startPosY: pipPos.y,
    };
    const onMove = (me: MouseEvent) => {
      if (!pipDragRef.current.dragging) return;
      const dx = me.clientX - pipDragRef.current.startX;
      const dy = me.clientY - pipDragRef.current.startY;
      setPipPos({
        x: Math.max(8, pipDragRef.current.startPosX - dx),
        y: Math.max(8, pipDragRef.current.startPosY - dy),
      });
    };
    const onUp = () => {
      pipDragRef.current.dragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // Snap to nearest corner
      setPipTransitioning(true);
      setPipPos((cur) => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const PIP_W = 160; const PIP_H = 112;
        const snapX = cur.x < W / 2 - PIP_W / 2 ? 8 : 8;
        const snapY = cur.y < H / 2 - PIP_H / 2 ? 8 : cur.y;
        // Determine nearest corner
        const fromRight = cur.x;   // distance from right edge
        const fromBottom = cur.y;  // distance from bottom edge
        const fromLeft = W - cur.x - PIP_W;
        const fromTop = H - cur.y - PIP_H;
        const minH = Math.min(fromRight, fromLeft);
        const minV = Math.min(fromBottom, fromTop);
        const cornerX = minH === fromRight ? 8 : 8 + (W - PIP_W - 16);
        const cornerY = minV === fromBottom ? 8 : 8 + (H - PIP_H - 16);
        void snapX; void snapY;
        return { x: cornerX, y: cornerY };
      });
      setTimeout(() => setPipTransitioning(false), 300);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pipPos]);

  const handlePipTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    pipDragRef.current = {
      dragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startPosX: pipPos.x,
      startPosY: pipPos.y,
    };
    const onMove = (te: TouchEvent) => {
      if (!pipDragRef.current.dragging) return;
      const t = te.touches[0];
      const dx = t.clientX - pipDragRef.current.startX;
      const dy = t.clientY - pipDragRef.current.startY;
      setPipPos({
        x: Math.max(8, pipDragRef.current.startPosX - dx),
        y: Math.max(8, pipDragRef.current.startPosY - dy),
      });
    };
    const onEnd = () => {
      pipDragRef.current.dragging = false;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      // Snap to nearest corner
      setPipTransitioning(true);
      setPipPos((cur) => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const PIP_W = 160; const PIP_H = 112;
        const fromRight = cur.x;
        const fromBottom = cur.y;
        const fromLeft = W - cur.x - PIP_W;
        const fromTop = H - cur.y - PIP_H;
        const minH = Math.min(fromRight, fromLeft);
        const minV = Math.min(fromBottom, fromTop);
        const cornerX = minH === fromRight ? 8 : 8 + (W - PIP_W - 16);
        const cornerY = minV === fromBottom ? 8 : 8 + (H - PIP_H - 16);
        return { x: cornerX, y: cornerY };
      });
      setTimeout(() => setPipTransitioning(false), 300);
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  }, [pipPos]);

  // Determine which peer fills the main screen:
  // 1. Pinned peer (click-to-promote), 2. Loudest speaker, 3. First peer
  const activePeer = (
    (pinnedPeerId ? peers.find((p) => p.id === pinnedPeerId) : null)
    ?? peers.find((p) => p.speaking)
    ?? peers[0]
    ?? null
  );
  const secondaryPeers = peers.filter((p) => p !== activePeer);
  // Keep ref in sync so handlePipDoubleTap can read it without closure staleness
  activePeerRef.current = activePeer;

  // Auto-clear pin if pinned peer leaves (use useEffect to avoid setState-in-render)
  useEffect(() => {
    if (pinnedPeerId !== null && !peers.find((p) => p.id === pinnedPeerId)) {
      setPinnedPeerId(null);
    }
  }, [peers, pinnedPeerId]);

  // Sync activePeer stream to the stable DOM elements when the active peer changes.
  // This avoids re-mounting the <video> element (which causes flicker) while still
  // updating the stream when the loudest speaker or pinned peer changes.
  useEffect(() => {
    const videoEl = activePeerVideoElRef.current;
    const audioEl = activePeerAudioElRef.current;
    if (!activePeer) return;
    if (videoEl && activePeer.stream && videoEl.srcObject !== activePeer.stream) {
      videoEl.srcObject = activePeer.stream;
      videoEl.play().catch(() => {});
    }
    if (audioEl && activePeer.stream && audioEl.srcObject !== activePeer.stream) {
      audioEl.srcObject = activePeer.stream;
      audioEl.play().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeer?.id, activePeer?.stream]);

  const totalParticipants = 1 + peers.length;

  return (
    <div
      className="relative w-full h-full bg-gray-950 overflow-hidden select-none"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* ── Full-screen main video area ── */}
      <div className="absolute inset-0 bg-gray-900">
        {peers.length === 0 ? (
          /* Empty state: show waiting overlay */
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-black/40 rounded-2xl px-6 py-4 flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-white/40" />
              <p className="text-white/50 text-sm">Waiting for others to join…</p>
            </div>
          </div>
        ) : (
          /* Active peer fills the screen */
          activePeer ? (
            <>
              {/* Hidden audio — stable DOM element, stream updated via useEffect */}
              <audio
                ref={(el) => {
                  activePeerAudioElRef.current = el;
                  (activePeer.audioRef as React.MutableRefObject<HTMLAudioElement | null>).current = el;
                  if (el && activePeer.stream && el.srcObject !== activePeer.stream) {
                    el.srcObject = activePeer.stream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay playsInline className="hidden"
              />
              {/* Video — stable DOM element, stream updated via useEffect to prevent flicker */}
              <video
                ref={(el) => {
                  activePeerVideoElRef.current = el;
                  (activePeer.videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                  if (el && activePeer.stream && el.srcObject !== activePeer.stream) {
                    el.srcObject = activePeer.stream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Active peer name label */}
              <div className="absolute bottom-24 left-4 flex items-center gap-1.5 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                {activePeer.speaking && <Volume2 className="w-3.5 h-3.5 text-green-400" />}
                {raisedHands.some((h) => h.userId === activePeer.id) && <Hand className="w-3.5 h-3.5 text-yellow-400" />}
                <span>{activePeer.name}</span>
                <QualityBars bars={activePeer.quality} />
              </div>
            </>
          ) : null
        )}
      </div>

      {/* ── Secondary peers strip (bottom, above controls) ── */}
      {secondaryPeers.length > 0 && (
        <div
          className="absolute bottom-20 left-0 right-0 z-10 flex items-end gap-2 px-3 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {secondaryPeers.map((peer) => (
            <div
              key={peer.id}
              onClick={() => setPinnedPeerId((prev) => prev === peer.id ? null : peer.id)}
              title={pinnedPeerId === peer.id ? "Unpin" : "Pin as main speaker"}
              className={`relative flex-shrink-0 w-28 h-20 rounded-xl overflow-hidden bg-gray-800 border-2 transition-all duration-200 cursor-pointer hover:scale-105 ${
                pinnedPeerId === peer.id ? "border-blue-400 ring-2 ring-blue-400/40" :
                peer.speaking ? "border-green-400" : "border-white/20"
              }`}
            >
              <audio
                ref={(el) => {
                  const ref = peer.audioRef as React.MutableRefObject<HTMLAudioElement | null>;
                  if (ref.current === el) return;
                  ref.current = el;
                  if (el && peer.stream && el.srcObject !== peer.stream) { el.srcObject = peer.stream; el.play().catch(() => {}); }
                }}
                autoPlay playsInline className="hidden"
              />
              <video
                ref={(el) => {
                  const ref = peer.videoRef as React.MutableRefObject<HTMLVideoElement | null>;
                  if (ref.current === el) return;
                  ref.current = el;
                  if (el && peer.stream && el.srcObject !== peer.stream) { el.srcObject = peer.stream; el.play().catch(() => {}); }
                }}
                autoPlay playsInline muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full truncate">
                {pinnedPeerId === peer.id && <Pin className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />}
                {peer.speaking && <Volume2 className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />}
                {raisedHands.some((h) => h.userId === peer.id) && <Hand className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0" />}
                <span className="truncate">{peer.name}</span>
                <QualityBars bars={peer.quality} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Local PiP tile (draggable, corner-snapping, double-tap to swap) ── */}
      <div
        className="absolute z-20 w-36 h-24 sm:w-40 sm:h-28 rounded-xl overflow-hidden bg-gray-800 border-2 border-white/30 shadow-2xl cursor-grab active:cursor-grabbing group"
        style={{
          right: pipPos.x,
          bottom: pipPos.y,
          transition: pipTransitioning ? "right 0.3s cubic-bezier(0.34,1.56,0.64,1), bottom 0.3s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
        }}
        onMouseDown={handlePipMouseDown}
        onTouchStart={handlePipTouchStart}
        onClick={handlePipDoubleTap}
      >
        {videoMuted ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/40">
            <VideoOff className="w-6 h-6" />
            <span className="text-[10px]">Camera off</span>
          </div>
        ) : (
          <>
            {/* Raw local video — source for segmentation; shown when bg compositing is off */}
            <video
              ref={localVideoRef}
              autoPlay muted playsInline
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              style={{ display: bgReady ? "none" : "block", ...(resolvedFilter ? { filter: resolvedFilter } : {}) }}
            />
            {/* Canvas — shown when background compositing is active */}
            <canvas
              ref={localCanvasRef}
              width={640} height={360}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              style={{ display: bgReady ? "block" : "none", ...(resolvedFilter ? { filter: resolvedFilter } : {}) }}
            />
          </>
        )}
        {/* PiP label */}
        <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
          {audioMuted && <MicOff className="w-2.5 h-2.5 text-red-400" />}
          {handRaised  && <Hand  className="w-2.5 h-2.5 text-yellow-400" />}
          <span>You</span>
        </div>
        {screenSharing && (
          <div className="absolute top-1 right-1 bg-blue-600 text-white text-[9px] px-1 py-0.5 rounded-full font-semibold">Sharing</div>
        )}
      </div>

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

          {/* Participant count badge with hover/tap popover */}
          <div className="relative">
            <button
              onClick={() => setParticipantPopoverOpen((o) => !o)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                participantPopoverOpen
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Participants"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{totalParticipants}</span>
            </button>
            {participantPopoverOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-56 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-white text-xs font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Participants ({totalParticipants})
                  </span>
                  <button onClick={() => setParticipantPopoverOpen(false)} className="text-white/40 hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="py-1 max-h-52 overflow-y-auto">
                  {/* Local user */}
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                        {myNameRef.current.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-xs truncate max-w-[110px]">{myNameRef.current} <span className="text-white/40">(You)</span></span>
                    </div>
                    <QualityBars bars={4} />
                  </div>
                  {/* Remote peers */}
                  {peers.map((peer) => (
                    <div key={peer.id} className="relative">
                      <div
                        className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded cursor-default"
                        onContextMenu={(e) => {
                          if (!isHost) return;
                          e.preventDefault();
                          setContextMenuPeerId((prev) => prev === peer.id ? null : peer.id);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {peer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-white text-xs truncate max-w-[90px]">{peer.name}</span>
                          {peer.speaking && <Volume2 className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />}
                          {raisedHands.some((h) => h.userId === peer.id) && <Hand className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0" />}
                          {pinnedPeerId === peer.id && <Pin className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <QualityBars bars={peer.quality} />
                          {isHost && (
                            <button
                              onClick={() => setContextMenuPeerId((prev) => prev === peer.id ? null : peer.id)}
                              className="text-white/30 hover:text-orange-400 transition-colors ml-1"
                              title="Host options"
                            >
                              <span className="text-[10px] leading-none">⋯</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Host context menu */}
                      {isHost && contextMenuPeerId === peer.id && (
                        <div className="absolute right-2 top-full mt-0.5 z-50 bg-gray-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                          <button
                            onClick={() => handleMakeHost(peer.id)}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-orange-300 hover:bg-orange-500/20 w-full whitespace-nowrap transition-colors"
                          >
                            <Pin className="w-3 h-3" />
                            Make host
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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

      {/* ── In-call chat panel ── */}
      {chatOpen && (
        <div className="absolute top-0 right-0 bottom-0 z-30 w-full sm:w-72 flex flex-col bg-gray-900/95 border-l border-white/10 shadow-2xl">
          {/* Chat header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
            <span className="text-white text-sm font-semibold flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              In-call Chat
            </span>
            <button onClick={() => setChatOpen(false)} className="text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {chatMessages.length === 0 && (
              <p className="text-white/30 text-xs text-center mt-6">No messages yet. Say hello!</p>
            )}
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.own ? "items-end" : "items-start"}`}>
                <span className="text-white/40 text-[10px] mb-0.5">{msg.from}</span>
                <div className={`max-w-[90%] px-2.5 py-1.5 rounded-xl text-sm ${
                  msg.own
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white/15 text-white rounded-bl-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {/* Emoji quick-pick */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-t border-white/10">
            {["👍","❤️","😂","🎉","🤔","👏","🙌","🔥"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => setChatInput((prev) => prev + emoji)}
                className="text-base hover:scale-125 transition-transform px-0.5"
                title={emoji}
              >{emoji}</button>
            ))}
          </div>
          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder="Type a message…"
              className="flex-1 bg-white/10 text-white placeholder-white/30 text-sm px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
            >
              <SendIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
        <div className="flex items-center justify-center gap-1 sm:gap-2 pb-5 pt-3 bg-gradient-to-t from-black/80 to-transparent flex-wrap px-2">
          {/* Reactions */}
          <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 mr-2">
            {REACTIONS.map((emoji) => (
              <button key={emoji} onClick={() => sendReaction(emoji)} className="text-lg hover:scale-125 transition-transform px-0.5">{emoji}</button>
            ))}
          </div>

          {/* Raise hand */}
          <button
            ref={raiseHandBtnRef}
            onClick={toggleRaiseHand}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              handRaised ? "bg-yellow-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
            }`}
            title={handRaised ? "Lower hand (Space)" : "Raise hand (Space)"}
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

          {/* Chat toggle */}
          <button
            onClick={() => setChatOpen((o) => !o)}
            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              chatOpen ? "bg-blue-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
            }`}
            title={chatOpen ? "Close chat" : "Open chat"}
          >
            <MessageSquare className="w-5 h-5" />
            {/* Unread badge */}
            {!chatOpen && chatMessages.filter((m) => !m.own).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {chatMessages.filter((m) => !m.own).length > 9 ? "9+" : chatMessages.filter((m) => !m.own).length}
              </span>
            )}
          </button>

          {/* In-call settings */}
          {!audioOnly && (
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                settingsOpen ? "bg-indigo-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
              }`}
              title="Background & filter settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          {/* Mute all (host only) */}
          {isHost && peers.length > 0 && (
            <button
              onClick={handleMuteAll}
              className="w-11 h-11 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition-colors"
              title="Mute all participants"
            >
              <MicOff className="w-5 h-5" />
            </button>
          )}

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

      {/* ── In-call settings overlay ── */}
      {settingsOpen && (
        <div className="absolute bottom-20 right-4 z-40 w-72 bg-gray-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-white text-sm font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              Video Settings
            </span>
            <button onClick={() => setSettingsOpen(false)} className="text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setSettingsTab("backgrounds")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                settingsTab === "backgrounds" ? "text-indigo-300 border-b-2 border-indigo-400" : "text-white/50 hover:text-white/80"
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              Backgrounds
            </button>
            <button
              onClick={() => setSettingsTab("filters")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                settingsTab === "filters" ? "text-indigo-300 border-b-2 border-indigo-400" : "text-white/50 hover:text-white/80"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Filters
            </button>
          </div>

          {/* Backgrounds grid */}
          {settingsTab === "backgrounds" && (
            <div className="p-3 overflow-y-auto max-h-64">
              <div className="grid grid-cols-3 gap-2">
                {VIDEO_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => {
                      setLiveBgId(bg.id);
                      if (bg.url && bg.url !== "blur") {
                        try { localStorage.setItem("seba_precall_bg_url", bg.url); } catch { /* ignore */ }
                      } else {
                        try { localStorage.removeItem("seba_precall_bg_url"); } catch { /* ignore */ }
                      }
                      try { localStorage.setItem(LS_BG_KEY, bg.id); } catch { /* ignore */ }
                    }}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      resolvedBgId === bg.id
                        ? "border-indigo-400 ring-2 ring-indigo-400/30"
                        : "border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {bg.url && bg.url !== "blur" ? (
                      <img src={bg.url} alt={bg.label} className="w-full h-full object-cover" loading="lazy" />
                    ) : bg.url === "blur" ? (
                      <div className="w-full h-full bg-gradient-to-br from-blue-900/60 to-gray-700/60 backdrop-blur-md flex items-center justify-center">
                        <Settings className="w-3.5 h-3.5 text-blue-300" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <VideoOff className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center py-0.5 truncate px-1 text-white">
                      {bg.label}
                    </div>
                    {resolvedBgId === bg.id && (
                      <div className="absolute top-0.5 right-0.5">
                        <CheckCircle className="w-3 h-3 text-indigo-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {/* Blur intensity slider */}
              {resolvedBgId === "blur" && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-300 font-medium">Blur Intensity</span>
                    <span className="text-xs text-indigo-400 font-semibold">
                      {["Subtle", "Light", "Medium", "Strong", "Heavy"][(liveBlurIntensity ?? 3) - 1]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1} max={5} step={1}
                    value={liveBlurIntensity ?? 3}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLiveBlurIntensity(v);
                      try { localStorage.setItem(LS_BLUR_INTENSITY_KEY, String(v)); } catch { /* ignore */ }
                    }}
                    className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Subtle</span><span>Heavy</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filters list */}
          {settingsTab === "filters" && (
            <div className="p-3 overflow-y-auto max-h-64 flex flex-col gap-1.5">
              {VIDEO_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    // "none" means no filter — store empty string as the resolved CSS
                    setLiveFilterCss(f.css === "none" ? "" : f.css);
                    try { localStorage.setItem(LS_FILTER_KEY, f.id); } catch { /* ignore */ }
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-sm ${
                    resolvedFilter === (f.css === "none" ? "" : f.css)
                      ? "border-indigo-400 bg-indigo-500/10 text-indigo-300"
                      : "border-gray-700 hover:border-gray-500 text-gray-300"
                  }`}
                >
                  <span className="font-medium">{f.label}</span>
                  {resolvedFilter === (f.css === "none" ? "" : f.css) && <CheckCircle className="w-4 h-4 text-indigo-400" />}
                </button>
              ))}
              {/* Noise suppression toggle */}
              <div className="mt-2 pt-2 border-t border-white/10">
                <button
                  onClick={toggleNoiseSuppression}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-all text-sm ${
                    noiseSuppression
                      ? "border-green-500/50 bg-green-500/10 text-green-300"
                      : "border-gray-700 hover:border-gray-500 text-gray-300"
                  }`}
                >
                  <span className="font-medium">Noise Suppression</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    noiseSuppression ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"
                  }`}>
                    {noiseSuppression ? "ON" : "OFF"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Recording download toast ── */}
      {downloadUrl && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl px-4 py-3">
          <Circle className="w-4 h-4 text-red-400 fill-current flex-shrink-0" />
          <span className="text-white text-sm">Recording ready</span>
          <a
            href={downloadUrl}
            download={`seba-call-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`}
            onClick={() => setTimeout(() => { URL.revokeObjectURL(downloadUrl); setDownloadUrl(null); }, 1000)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Download
          </a>
          <button onClick={() => { URL.revokeObjectURL(downloadUrl); setDownloadUrl(null); }} className="text-white/40 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Call summary card (shown briefly on hang-up) ── */}
      {callSummary && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 text-white">
            <div className="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center mb-1">
              <PhoneOff className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-lg font-semibold">Call ended</p>
            <div className="flex gap-6 text-sm text-white/70">
              <div className="flex flex-col items-center gap-0.5">
                <Clock className="w-4 h-4 mb-0.5 text-white/40" />
                <span className="font-medium text-white">{Math.floor(callSummary.durationSecs / 60)}m {callSummary.durationSecs % 60}s</span>
                <span>Duration</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Users className="w-4 h-4 mb-0.5 text-white/40" />
                <span className="font-medium text-white">{callSummary.participantCount}</span>
                <span>Participants</span>
              </div>
              {callSummary.avgQuality > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                  <Volume2 className="w-4 h-4 mb-0.5 text-white/40" />
                  <QualityBars bars={callSummary.avgQuality} />
                  <span>Avg quality</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Keyboard shortcut hint (shown for 4s when call starts) ── */}
      {callConnected && callSeconds <= 4 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex gap-2 text-[11px] text-white/50 pointer-events-none animate-fade-in">
          <span className="bg-black/40 rounded px-1.5 py-0.5">M mute</span>
          <span className="bg-black/40 rounded px-1.5 py-0.5">V video</span>
          <span className="bg-black/40 rounded px-1.5 py-0.5">Space hand</span>
        </div>
      )}
    </div>
  );
};

/**
 * Memoised export — prevents the parent (SebaConnect) from re-rendering this
 * component on every poll tick (messages, members, call-status queries).
 * Only re-renders when roomName / channelName / audioOnly / schoolLogoUrl / onEnd change.
 */
export const SebaMeet = memo(SebaMeetInner);
