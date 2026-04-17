import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  Settings,
  Image as ImageIcon,
  Sliders,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FlipHorizontal2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import SebaSymbol from "@/components/SebaSymbol";

// ─── localStorage keys ─────────────────────────────────────────────────────
const LS_BG_KEY = "seba_precall_bg";
const LS_FILTER_KEY = "seba_precall_filter";
const LS_MIRROR_KEY = "seba_precall_mirror";
const LS_BLUR_INTENSITY_KEY = "seba_precall_blur_intensity";

// Blur intensity levels: 1 (subtle) → 5 (heavy)
const BLUR_RADIUS_MAP = [4, 8, 12, 16, 24]; // px
function getSavedBlurIntensity(): number {
  try {
    const v = localStorage.getItem(LS_BLUR_INTENSITY_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (n >= 1 && n <= 5) return n;
    }
  } catch (_) { /* ignore */ }
  return 3; // default: medium
}

// ─── Autoresolve types ────────────────────────────────────────────────────
type PermState = "unknown" | "prompt" | "granted" | "denied";
type DeviceType = "laptop" | "tablet" | "phone" | "desktop" | null;
type ResolveStep =
  | "idle"           // normal — permissions granted, stream ok
  | "ask_device"     // need to ask device type before prompting
  | "requesting"     // browser permission prompt in progress
  | "denied_guide"   // permission denied — show browser unlock guide
  | "retrying"       // auto-retrying with fallback constraints
  | "audio_only"     // camera unavailable, audio-only mode
  | "resolved";      // autoresolve succeeded

type BrowserName = "chrome" | "firefox" | "safari" | "edge" | "other";

function detectBrowser(): BrowserName {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  if (ua.includes("chrome")) return "chrome";
  return "other";
}

const BROWSER_GUIDES: Record<BrowserName, { title: string; steps: string[] }> = {
  chrome: {
    title: "Unlock camera & microphone in Chrome",
    steps: [
      "Click the 🔒 lock icon in the address bar (top-left)",
      "Find 'Camera' and 'Microphone' in the permissions list",
      "Change both from 'Block' to 'Allow'",
      "Refresh this page and try again",
    ],
  },
  firefox: {
    title: "Unlock camera & microphone in Firefox",
    steps: [
      "Click the 🔒 shield icon in the address bar",
      "Select 'Connection Secure' → 'More Information'",
      "Go to the 'Permissions' tab",
      "Remove the 'Block' setting for Camera and Microphone",
      "Refresh this page and try again",
    ],
  },
  safari: {
    title: "Unlock camera & microphone in Safari",
    steps: [
      "Open Safari → Settings (or Preferences) → Websites",
      "Select 'Camera' in the left sidebar",
      "Find this site and change to 'Allow'",
      "Repeat for 'Microphone'",
      "Refresh this page and try again",
    ],
  },
  edge: {
    title: "Unlock camera & microphone in Edge",
    steps: [
      "Click the 🔒 lock icon in the address bar",
      "Click 'Permissions for this site'",
      "Set Camera and Microphone to 'Allow'",
      "Refresh this page and try again",
    ],
  },
  other: {
    title: "Unlock camera & microphone",
    steps: [
      "Open your browser's site settings for this page",
      "Find Camera and Microphone permissions",
      "Change both from 'Block' to 'Allow'",
      "Refresh this page and try again",
    ],
  },
};

const DEVICE_TYPE_LABELS: Record<NonNullable<DeviceType>, { icon: string; label: string; hint: string }> = {
  laptop: { icon: "💻", label: "Laptop", hint: "Built-in camera above the screen" },
  desktop: { icon: "🖥️", label: "Desktop", hint: "External webcam required" },
  tablet: { icon: "📱", label: "Tablet", hint: "Front or rear camera" },
  phone: { icon: "📱", label: "Phone", hint: "Front-facing camera" },
};

function getSavedMirror(): boolean {
  try {
    const v = localStorage.getItem(LS_MIRROR_KEY);
    return v === null ? true : v === "true";
  } catch (_) { return true; }
}

// ─── Background catalogue ──────────────────────────────────────────────────
export interface VideoBackground {
  id: string;
  label: string;
  url: string;
}

export const VIDEO_BACKGROUNDS: VideoBackground[] = [
  { id: "none", label: "None", url: "" },
  { id: "blur", label: "Smart Blur", url: "blur" },
  { id: "bg-01", label: "Classroom", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-01-classroom_b45bd275.jpg" },
  { id: "bg-02", label: "Library", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-02-library_cc3b079f.jpg" },
  { id: "bg-03", label: "Catalonia", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-03-catalonia_a24363ef.jpg" },
  { id: "bg-04", label: "Courtyard", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-04-courtyard_f81e8016.jpg" },
  { id: "bg-05", label: "Abstract Blue", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-05-abstract-blue_fd46ab68.jpg" },
  { id: "bg-06", label: "Barcelona", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-06-barcelona-Wf3QUJdS7WPN29uTKr7qav.png" },
  { id: "bg-07", label: "Science Lab", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-07-science-lab-Gay5oLWMQi2ccbPZGm42S8.png" },
  { id: "bg-08", label: "Art Studio", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-08-art-studio-DVsJVSciMSeRXpYEjBaYad.png" },
  { id: "bg-09", label: "Pyrenees", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-09-pyrenees-V2FjMAQKmdtbnZdUbjjX8A.png" },
  { id: "bg-10", label: "Teal Gradient", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-10-teal-gradient-LcHZKywxrZgr2u3qtomQLZ.png" },
  { id: "bg-11", label: "Music Room", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-11-music-room-GycarnkuSLvrRYwwJ48VuR.png" },
  { id: "bg-12", label: "Computer Lab", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-12-computer-lab-Nxysp88rNEqu76ewiUp4sA.png" },
  { id: "bg-13", label: "Costa Brava", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-13-costa-brava-N9RUEy6uGm9wckyFbPhWP9.png" },
  { id: "bg-14", label: "Home Office", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-14-warm-office-ZRCB6ZSn3MwEJsHyygMzKK.png" },
  { id: "bg-15", label: "Purple Gradient", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-15-purple-gradient-itWjW5taXja6WghCiASWUw.png" },
  { id: "bg-16", label: "Gymnasium", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-16-gym-HWEf9LC2wnCtSP3TyS293W.png" },
  { id: "bg-17", label: "Montserrat", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-17-montserrat-P9m4fwi6hBAYDDdHtvLh2n.png" },
  { id: "bg-18", label: "Garden", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-18-garden-ZiRHFepgTHCGigwYK9hQuh.png" },
  { id: "bg-19", label: "Castle", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-19-castle-imMyRbpiwyCkfsSSzNVHJg.png" },
  { id: "bg-20", label: "Amber Gradient", url: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/bg-20-amber-gradient-RrWHc6fdr5Haz2kGm9kub7.png" },
];

// ─── Video filter catalogue ────────────────────────────────────────────────
export interface VideoFilter {
  id: string;
  label: string;
  css: string;
}

export const VIDEO_FILTERS: VideoFilter[] = [
  { id: "none", label: "Normal", css: "none" },
  { id: "blur", label: "Soft Blur", css: "blur(2px)" },
  { id: "grayscale", label: "Greyscale", css: "grayscale(100%)" },
  { id: "warm", label: "Warm", css: "sepia(40%) saturate(120%) brightness(105%)" },
  { id: "cool", label: "Cool", css: "hue-rotate(20deg) saturate(110%) brightness(105%)" },
  { id: "vintage", label: "Vintage", css: "sepia(60%) contrast(90%) brightness(95%)" },
  { id: "vivid", label: "Vivid", css: "saturate(160%) contrast(110%)" },
  { id: "dark", label: "Dark Mode", css: "brightness(70%) contrast(120%)" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function getSavedBg(): VideoBackground {
  try {
    const id = localStorage.getItem(LS_BG_KEY);
    if (id) {
      const found = VIDEO_BACKGROUNDS.find((b) => b.id === id);
      if (found) return found;
    }
  } catch (_) { /* ignore */ }
  return VIDEO_BACKGROUNDS[0];
}

function getSavedFilter(): VideoFilter {
  try {
    const id = localStorage.getItem(LS_FILTER_KEY);
    if (id) {
      const found = VIDEO_FILTERS.find((f) => f.id === id);
      if (found) return found;
    }
  } catch (_) { /* ignore */ }
  return VIDEO_FILTERS[0];
}

// ─── Props ─────────────────────────────────────────────────────────────────
interface PreCallScreenProps {
  roomName: string;
  channelName: string;
  sebaLogoUrl?: string;
  schoolLogoUrl?: string;
  onJoin: (opts: { videoEnabled: boolean; audioEnabled: boolean; background: VideoBackground; filter: VideoFilter }) => void;
  onCancel: () => void;
}

type DeviceStatus = "checking" | "ok" | "denied" | "unavailable";

// ─── Component ─────────────────────────────────────────────────────────────
export default function PreCallScreen({
  channelName,
  sebaLogoUrl,
  schoolLogoUrl,
  onJoin,
  onCancel,
}: PreCallScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentationRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>("checking");
  const [micStatus, setMicStatus] = useState<DeviceStatus>("checking");

  // ── Autoresolve state ─────────────────────────────────────────────────
  const [resolveStep, setResolveStep] = useState<ResolveStep>("idle");
  const [permState, setPermState] = useState<PermState>("unknown");
  const [deviceType, setDeviceType] = useState<DeviceType>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [resolveLog, setResolveLog] = useState<string[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const addLog = (msg: string) => setResolveLog((l) => [...l.slice(-9), msg]);

  const [activeTab, setActiveTab] = useState<"backgrounds" | "filters">("backgrounds");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedBg, setSelectedBg] = useState<VideoBackground>(getSavedBg);
  const [selectedFilter, setSelectedFilter] = useState<VideoFilter>(getSavedFilter);
  const [blurIntensity, setBlurIntensity] = useState<number>(getSavedBlurIntensity);
  const [segmentationLoading, setSegmentationLoading] = useState(false);
  const [segmentationReady, setSegmentationReady] = useState(false);

  // ── Persist selections ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(LS_BG_KEY, selectedBg.id);
      // Also persist the URL so SebaMeet can resolve the image without importing the catalogue
      if (selectedBg.url && selectedBg.url !== "blur") {
        localStorage.setItem("seba_precall_bg_url", selectedBg.url);
      } else {
        localStorage.removeItem("seba_precall_bg_url");
      }
    } catch (_) { /* ignore */ }
  }, [selectedBg]);

  useEffect(() => {
    try { localStorage.setItem(LS_FILTER_KEY, selectedFilter.id); } catch (_) { /* ignore */ }
  }, [selectedFilter]);

  useEffect(() => {
    try { localStorage.setItem(LS_BLUR_INTENSITY_KEY, String(blurIntensity)); } catch (_) { /* ignore */ }
  }, [blurIntensity]);
  // ── Enumerate available cameras ──────────────────────────────────────────
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      setAvailableCameras(cams);
      addLog(`Found ${cams.length} camera(s)`);
      return cams;
    } catch (_) {
      addLog("Could not enumerate devices");
      return [];
    }
  }, []);

  // ── Apply stream to video element ───────────────────────────────────────
  const applyStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    const hasVideo = stream.getVideoTracks().length > 0;
    const hasAudio = stream.getAudioTracks().length > 0;
    setCameraStatus(hasVideo ? "ok" : "unavailable");
    setMicStatus(hasAudio ? "ok" : "unavailable");
    if (!hasVideo) setVideoEnabled(false);
    addLog(hasVideo ? "Stream active (video + audio)" : "Stream active (audio only)");
    setResolveStep("idle");
  }, []);

  // ── Attempt stream with fallback constraints ───────────────────────────
  const attemptStream = useCallback(async (cameraId?: string | null): Promise<boolean> => {
    const constraintSets: MediaStreamConstraints[] = [
      // 1. Ideal: HD video + audio on selected/default camera
      { video: cameraId ? { deviceId: { exact: cameraId }, width: 1280, height: 720 } : { width: 1280, height: 720 }, audio: true },
      // 2. Fallback: any video + audio
      { video: cameraId ? { deviceId: { exact: cameraId } } : true, audio: true },
      // 3. Fallback: low-res video + audio
      { video: { width: 640, height: 480 }, audio: true },
      // 4. Fallback: video only (no audio)
      { video: true, audio: false },
      // 5. Last resort: audio only
      { video: false, audio: true },
    ];
    for (let i = 0; i < constraintSets.length; i++) {
      const constraints = constraintSets[i];
      try {
        addLog(`Trying constraint set ${i + 1}/${constraintSets.length}…`);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        applyStream(stream);
        if (i >= 4) setResolveStep("audio_only");
        else if (i >= 2) setResolveStep("resolved");
        return true;
      } catch (err: unknown) {
        const e = err as DOMException;
        addLog(`Set ${i + 1} failed: ${e.name}`);
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          // Permission denied — no point retrying
          setCameraStatus("denied");
          setMicStatus("denied");
          setResolveStep("denied_guide");
          return false;
        }
      }
    }
    // All sets failed
    setCameraStatus("unavailable");
    setMicStatus("unavailable");
    setResolveStep("audio_only");
    return false;
  }, [applyStream]);

  // ── Main autoresolve entry point ────────────────────────────────────────
  const startPreview = useCallback(async () => {
    addLog("Checking permissions…");
    let camPerm: PermState = "unknown";
    let micPerm: PermState = "unknown";

    // Query Permissions API (non-prompting)
    if (navigator.permissions) {
      try {
        const [camResult, micResult] = await Promise.all([
          navigator.permissions.query({ name: "camera" as PermissionName }),
          navigator.permissions.query({ name: "microphone" as PermissionName }),
        ]);
        camPerm = camResult.state as PermState;
        micPerm = micResult.state as PermState;
        addLog(`Camera: ${camPerm} | Mic: ${micPerm}`);
      } catch (_) {
        addLog("Permissions API unavailable, attempting direct access");
      }
    }

    setPermState(camPerm);

    if (camPerm === "denied" || micPerm === "denied") {
      setCameraStatus("denied");
      setMicStatus("denied");
      setResolveStep("denied_guide");
      addLog("Permission denied — showing unlock guide");
      return;
    }

    if (camPerm === "prompt" || camPerm === "unknown") {
      // Ask device type before triggering browser permission prompt
      setResolveStep("ask_device");
      addLog("Permission not yet granted — asking device type");
      return;
    }

    // Permission already granted — go straight to stream
    addLog("Permission granted — starting stream");
    await enumerateCameras();
    await attemptStream(selectedCameraId);
  }, [enumerateCameras, attemptStream, selectedCameraId]);

  // ── Called after user selects device type ──────────────────────────────
  const handleDeviceTypeSelected = useCallback(async (type: NonNullable<DeviceType>) => {
    setDeviceType(type);
    setResolveStep("requesting");
    addLog(`Device type: ${type} — requesting permission…`);
    const cams = await enumerateCameras();
    const ok = await attemptStream(cams[0]?.deviceId ?? null);
    if (ok && cams.length > 1) {
      addLog(`${cams.length} cameras found — selector available`);
    }
  }, [enumerateCameras, attemptStream]);

  // ── Called when user changes camera from selector ──────────────────────
  const handleCameraChange = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setResolveStep("retrying");
    addLog(`Switching to camera: ${deviceId.slice(0, 12)}…`);
    await attemptStream(deviceId);
  }, [attemptStream]);

  useEffect(() => {
    startPreview();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
      const seg = segmentationRef.current as { close?: () => void } | null;
      seg?.close?.();
    };
  }, [startPreview]);
  // ── MediaPipe segmentation blur ────────────────────────────────────────
  const startSegmentation = useCallback(async () => {
    if (segmentationRef.current || !videoRef.current || cameraStatus !== "ok") return;
    setSegmentationLoading(true);
    try {
      const { SelfieSegmentation } = await import("@mediapipe/selfie_segmentation");
      const seg = new SelfieSegmentation({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`,
      });
      seg.setOptions({ modelSelection: 1, selfieMode: true });

      seg.onResults((results: { segmentationMask: CanvasImageSource; image: CanvasImageSource }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const { width, height } = canvas;

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        // Step 1: Draw background layer
        const bgImg = bgImgRef.current;
        const isBlur = !selectedBg.url || selectedBg.url === "blur";
        if (!isBlur && bgImg) {
          // Cover-fit the background image
          const scale = Math.max(width / bgImg.naturalWidth, height / bgImg.naturalHeight);
          const sw = bgImg.naturalWidth * scale;
          const sh = bgImg.naturalHeight * scale;
          const sx = (width - sw) / 2;
          const sy = (height - sh) / 2;
          ctx.drawImage(bgImg, sx, sy, sw, sh);
        } else {
          // Blurred background
          ctx.filter = `blur(${BLUR_RADIUS_MAP[blurIntensity - 1]}px)`;
          ctx.drawImage(results.image, 0, 0, width, height);
          ctx.filter = "none";
        }

        // Step 2: Mask person onto offscreen canvas then composite over background
        const personCanvas = document.createElement("canvas");
        personCanvas.width = width;
        personCanvas.height = height;
        const pCtx = personCanvas.getContext("2d")!;
        pCtx.drawImage(results.image, 0, 0, width, height);
        pCtx.globalCompositeOperation = "destination-in";
        pCtx.drawImage(results.segmentationMask, 0, 0, width, height);
        ctx.drawImage(personCanvas, 0, 0);
        ctx.restore();
      });

      await seg.initialize();
      segmentationRef.current = seg;
      setSegmentationReady(true);
      setSegmentationLoading(false);

      // Render loop
      const sendFrame = async () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          const s = segmentationRef.current as { send?: (opts: { image: HTMLVideoElement }) => Promise<void> } | null;
          await s?.send?.({ image: videoRef.current });
        }
        animFrameRef.current = requestAnimationFrame(sendFrame);
      };
      animFrameRef.current = requestAnimationFrame(sendFrame);
    } catch (e) {
      console.error("Segmentation failed to load:", e);
      setSegmentationLoading(false);
    }
  }, [cameraStatus, selectedBg]);

  const stopSegmentation = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    const seg = segmentationRef.current as { close?: () => void } | null;
    seg?.close?.();
    segmentationRef.current = null;
    setSegmentationReady(false);
  }, []);

  // ── Load background image when bg changes ─────────────────────────────
  useEffect(() => {
    if (selectedBg.url && selectedBg.url !== "blur") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = selectedBg.url;
      img.onload = () => { bgImgRef.current = img; };
    } else {
      bgImgRef.current = null;
    }
  }, [selectedBg]);

  // ── Start/stop segmentation for any non-none background ────────────────
  // Segmentation is needed for both blur AND image backgrounds so the person
  // is composited correctly over the chosen background.
  // We stop first to ensure the new onResults closure (with updated selectedBg)
  // is registered when we restart.
  useEffect(() => {
    if (selectedBg.url && cameraStatus === "ok") {
      stopSegmentation();
      // Small delay to allow the previous instance to fully close
      const t = setTimeout(() => { startSegmentation(); }, 50);
      return () => clearTimeout(t);
    } else {
      stopSegmentation();
    }
  }, [selectedBg, cameraStatus, startSegmentation, stopSegmentation]);

  // ── Toggle camera track ────────────────────────────────────────────────
  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => { t.enabled = !videoEnabled; });
    }
    setVideoEnabled((v) => !v);
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => { t.enabled = !audioEnabled; });
    }
    setAudioEnabled((a) => !a);
  };

  // ── Device status icon ─────────────────────────────────────────────────
  const StatusIcon = ({ status }: { status: DeviceStatus }) => {
    if (status === "checking") return <AlertCircle className="w-4 h-4 text-yellow-400 animate-pulse" />;
    if (status === "ok") return <CheckCircle className="w-4 h-4 text-green-400" />;
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  // ── Mirror mode state (default ON, persisted) ─────────────────────────────
  const [mirrored, setMirrored] = useState<boolean>(getSavedMirror);
  const mirrorStyle: React.CSSProperties = mirrored ? { transform: "scaleX(-1)" } : {};

  useEffect(() => {
    try { localStorage.setItem(LS_MIRROR_KEY, String(mirrored)); } catch (_) { /* ignore */ }
  }, [mirrored]);

  // ── Mic level meter ───────────────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number>(0);
  const [micLevel, setMicLevel] = useState(0); // 0-100

  // Start/stop mic analyser when stream or audioEnabled changes
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || !audioEnabled || micStatus !== "ok") {
      // Tear down
      cancelAnimationFrame(meterRafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      setMicLevel(0);
      return;
    }
    // Build analyser
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(meterRafRef.current);
      ctx.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      setMicLevel(0);
    };
  }, [audioEnabled, micStatus]);

  // ── Preview filter CSS — applied to background layer only ─────────────
  // Filters are composited behind the person so the person appears unfiltered.
  // For raw video (no bg), the filter is applied to a pseudo-background div.
  const bgFilter = selectedFilter.css === "none" ? undefined : selectedFilter.css;

  // Whether to show canvas (segmentation) or raw video
  // Canvas is used for ALL non-none backgrounds (both blur and image replacement)
  const showCanvas = !!selectedBg.url && (segmentationLoading || segmentationReady);

  // ── Join ───────────────────────────────────────────────────────────────
  const handleJoin = () => {
    stopSegmentation();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    // Persist blur intensity so SebaMeet can read it from localStorage
    try { localStorage.setItem(LS_BLUR_INTENSITY_KEY, String(blurIntensity)); } catch (_) { /* ignore */ }
    onJoin({ videoEnabled, audioEnabled, background: selectedBg, filter: selectedFilter });
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <SebaSymbol size={28} color="white" bg="#1a4fa0" className="shrink-0" />
          {sebaLogoUrl && (
            <img src={sebaLogoUrl} alt="SEBA" className="h-6 w-auto object-contain brightness-0 invert" />
          )}
          <div>
            <p className="text-sm font-semibold leading-none">{channelName}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pre-call setup</p>
          </div>
        </div>
        {schoolLogoUrl && (
          <img src={schoolLogoUrl} alt="School" className="h-8 w-auto object-contain opacity-80" />
        )}
      </div>

      {/* ── Main layout ── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left: camera preview */}
        <div className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
          {/* Video preview box */}
          <div
            className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-gray-800 shadow-2xl"
          >
            {/* Background layer with filter applied — sits behind the person */}
            {selectedBg.url && selectedBg.url !== "blur" && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${selectedBg.url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: bgFilter,
                }}
              />
            )}

            {/* MediaPipe segmentation canvas (smart blur) — person sharp, bg blurred */}
            {showCanvas && (
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ ...mirrorStyle }}
              />
            )}

            {/* Raw video (no bg replacement) — person layer, no filter */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                display: videoEnabled && cameraStatus === "ok" && !showCanvas ? "block" : "none",
                ...mirrorStyle,
              }}
            />

            {/* Camera off / no camera state */}
            {(!videoEnabled || cameraStatus !== "ok") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <VideoOff className="w-12 h-12 text-gray-500" />
                <span className="text-xs text-gray-400">
                  {cameraStatus === "denied" ? "Camera access denied" :
                   cameraStatus === "unavailable" ? "No camera found" :
                   "Camera off"}
                </span>
              </div>
            )}

            {/* Segmentation loading spinner */}
            {segmentationLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-xs text-gray-300">Loading smart blur…</span>
              </div>
            )}

            {/* Filter label badge */}
            {selectedFilter.id !== "none" && (
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="text-xs bg-black/60 text-white border-0">
                  {selectedFilter.label}
                </Badge>
              </div>
            )}
          </div>

          {/* Device controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleVideo}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                videoEnabled ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              <span className="text-xs">{videoEnabled ? "Camera on" : "Camera off"}</span>
            </button>
            <button
              onClick={toggleAudio}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                audioEnabled ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              <span className="text-xs">{audioEnabled ? "Mic on" : "Mic off"}</span>
            </button>
            <button
              onClick={() => setMirrored((m) => !m)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                mirrored ? "bg-blue-700 hover:bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
              }`}
              title="Toggle mirror mode"
            >
              <FlipHorizontal2 className="w-5 h-5" />
              <span className="text-xs">{mirrored ? "Mirror on" : "Mirror off"}</span>
            </button>
          </div>

          {/* Mic level meter */}
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">
                {!audioEnabled ? "Microphone off" : micStatus === "denied" ? "Mic access denied" : micStatus === "unavailable" ? "No mic found" : "Microphone level"}
              </span>
              {audioEnabled && micStatus === "ok" && micLevel > 0 && (
                <span className="text-xs text-green-400 ml-auto">Detected ✓</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${audioEnabled && micStatus === "ok" ? micLevel : 0}%`,
                  background: micLevel > 70
                    ? "#22c55e"
                    : micLevel > 35
                    ? "#84cc16"
                    : micLevel > 10
                    ? "#eab308"
                    : "#6b7280",
                }}
              />
            </div>
          </div>

          {/* ── Autoresolve: Device type picker ── */}
          {resolveStep === "ask_device" && (
            <div className="w-full max-w-md rounded-xl bg-blue-950/80 border border-blue-700 p-4">
              <p className="text-sm font-semibold text-blue-200 mb-1">What device are you using?</p>
              <p className="text-xs text-blue-300 mb-3">This helps us request the right camera and microphone for your device.</p>
              <div className="grid grid-cols-2 gap-2">
                {(["laptop", "desktop", "tablet", "phone"] as NonNullable<DeviceType>[]).map((dt) => {
                  const info = DEVICE_TYPE_LABELS[dt];
                  return (
                    <button
                      key={dt}
                      onClick={() => handleDeviceTypeSelected(dt)}
                      className="flex flex-col items-center gap-1 p-3 rounded-lg bg-blue-900/60 hover:bg-blue-800/80 border border-blue-700 transition-colors text-center"
                    >
                      <span className="text-2xl">{info.icon}</span>
                      <span className="text-sm font-medium text-blue-100">{info.label}</span>
                      <span className="text-xs text-blue-400">{info.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Autoresolve: Requesting (spinner) ── */}
          {resolveStep === "requesting" && (
            <div className="w-full max-w-md rounded-xl bg-gray-800/80 border border-gray-700 p-4 flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-200">Requesting access…</p>
                <p className="text-xs text-gray-400">Please allow camera and microphone in the browser prompt.</p>
              </div>
            </div>
          )}

          {/* ── Autoresolve: Retrying ── */}
          {resolveStep === "retrying" && (
            <div className="w-full max-w-md rounded-xl bg-yellow-950/80 border border-yellow-700 p-4 flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-yellow-400 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-200">Switching camera…</p>
                <p className="text-xs text-yellow-400">Reconnecting with new device.</p>
              </div>
            </div>
          )}

          {/* ── Autoresolve: Resolved with fallback ── */}
          {resolveStep === "resolved" && (
            <div className="w-full max-w-md rounded-xl bg-green-950/80 border border-green-700 p-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <p className="text-xs text-green-300">Connected using a lower-quality fallback. You can still join the call.</p>
            </div>
          )}

          {/* ── Autoresolve: Audio-only mode ── */}
          {resolveStep === "audio_only" && (
            <div className="w-full max-w-md rounded-xl bg-orange-950/80 border border-orange-700 p-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">No camera found. You can still join with audio only.</p>
            </div>
          )}

          {/* ── Autoresolve: Denied guide ── */}
          {resolveStep === "denied_guide" && (() => {
            const browser = detectBrowser();
            const guide = BROWSER_GUIDES[browser];
            return (
              <div className="w-full max-w-md rounded-xl bg-red-950/80 border border-red-700 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-sm font-semibold text-red-200">{guide.title}</p>
                </div>
                <ol className="list-decimal list-inside space-y-1.5">
                  {guide.steps.map((step, idx) => (
                    <li key={idx} className="text-xs text-red-300">{step}</li>
                  ))}
                </ol>
                <Button
                  size="sm"
                  className="mt-3 w-full bg-red-700 hover:bg-red-600 text-white text-xs"
                  onClick={() => { setResolveStep("idle"); startPreview(); }}
                >
                  Try again
                </Button>
              </div>
            );
          })()}

          {/* ── Camera selector (multiple cameras) ── */}
          {availableCameras.length > 1 && resolveStep === "idle" && (
            <div className="w-full max-w-md">
              <label className="text-xs text-gray-400 mb-1 block">Camera</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                value={selectedCameraId ?? ""}
                onChange={(e) => handleCameraChange(e.target.value)}
              >
                {availableCameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${availableCameras.indexOf(cam) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Device status */}
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <StatusIcon status={cameraStatus} />
              <span>Camera</span>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusIcon status={micStatus} />
              <span>Microphone</span>
            </div>
            <button
              onClick={() => setShowDiagnostics((d) => !d)}
              className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              {showDiagnostics ? "Hide diagnostics" : "Diagnostics"}
            </button>
          </div>

          {/* Diagnostics log */}
          {showDiagnostics && (
            <div className="w-full max-w-md rounded-lg bg-gray-900 border border-gray-800 p-3">
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Autoresolve log</p>
              {resolveLog.length === 0 ? (
                <p className="text-xs text-gray-600">No events yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {resolveLog.map((entry, i) => (
                    <li key={i} className="text-xs text-gray-400 font-mono">{entry}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-600 mt-1.5">Browser: {detectBrowser()} | Perm: {permState} | Cameras: {availableCameras.length}</p>
            </div>
          )}

          {/* Join / Cancel */}
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={onCancel} className="gap-2 border-gray-600 text-gray-300 hover:bg-gray-800">
              Cancel
            </Button>
            <Button onClick={handleJoin} className="gap-2 bg-green-600 hover:bg-green-500 text-white px-8">
              <Phone className="w-4 h-4" />
              Join call
            </Button>
          </div>
        </div>

        {/* Toggle button — always visible, sits at the boundary */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "Hide panel" : "Show backgrounds & filters"}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-12 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-l-md transition-all"
          style={{ right: panelOpen ? "288px" : "0px" }}
        >
          {panelOpen ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronLeft className="w-3 h-3 text-gray-400" />}
        </button>

        {/* Right: backgrounds + filters panel — slides in/out */}
        <div
          className="flex flex-col border-l border-gray-800 bg-gray-900 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: panelOpen ? "288px" : "0px", minWidth: 0, opacity: panelOpen ? 1 : 0 }}
        >
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 shrink-0">
            <button
              onClick={() => setActiveTab("backgrounds")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === "backgrounds"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Backgrounds
            </button>
            <button
              onClick={() => setActiveTab("filters")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === "filters"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Backgrounds grid */}
          {activeTab === "backgrounds" && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBg(bg)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      selectedBg.id === bg.id
                        ? "border-blue-500 ring-2 ring-blue-500/30"
                        : "border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {bg.url && bg.url !== "blur" ? (
                      <img src={bg.url} alt={bg.label} className="w-full h-full object-cover" loading="lazy" />
                    ) : bg.url === "blur" ? (
                      <div className="w-full h-full bg-gradient-to-br from-blue-900/60 to-gray-700/60 backdrop-blur-md flex items-center justify-center">
                        <Settings className="w-5 h-5 text-blue-300" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <VideoOff className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-xs text-center py-0.5 truncate px-1">
                      {bg.label}
                    </div>
                    {selectedBg.id === bg.id && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {/* Blur intensity slider — only shown when Smart Blur is selected */}
              {selectedBg.id === "blur" && (
                <div className="mt-3 px-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-300 font-medium">Blur Intensity</span>
                    <span className="text-xs text-blue-400 font-semibold">
                      {["Subtle", "Light", "Medium", "Strong", "Heavy"][blurIntensity - 1]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={blurIntensity}
                    onChange={(e) => setBlurIntensity(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Subtle</span>
                    <span>Heavy</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filters list */}
          {activeTab === "filters" && (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {VIDEO_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                    selectedFilter.id === f.id
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-gray-700 hover:border-gray-500 text-gray-300"
                  }`}
                >
                  <span className="text-sm font-medium">{f.label}</span>
                  {selectedFilter.id === f.id && <CheckCircle className="w-4 h-4 text-blue-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-2 bg-gray-900 border-t border-gray-800 text-center text-xs text-gray-600">
        Powered by SEBA
      </div>
    </div>
  );
}
