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
} from "lucide-react";
import SebaSymbol from "@/components/SebaSymbol";

// ─── localStorage keys ─────────────────────────────────────────────────────
const LS_BG_KEY = "seba_precall_bg";
const LS_FILTER_KEY = "seba_precall_filter";

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

  const [activeTab, setActiveTab] = useState<"backgrounds" | "filters">("backgrounds");
  const [selectedBg, setSelectedBg] = useState<VideoBackground>(getSavedBg);
  const [selectedFilter, setSelectedFilter] = useState<VideoFilter>(getSavedFilter);
  const [segmentationLoading, setSegmentationLoading] = useState(false);
  const [segmentationReady, setSegmentationReady] = useState(false);

  // ── Persist selections ─────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(LS_BG_KEY, selectedBg.id); } catch (_) { /* ignore */ }
  }, [selectedBg]);

  useEffect(() => {
    try { localStorage.setItem(LS_FILTER_KEY, selectedFilter.id); } catch (_) { /* ignore */ }
  }, [selectedFilter]);

  // ── Start camera preview ───────────────────────────────────────────────
  const startPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus("ok");
      setMicStatus("ok");
    } catch (err: unknown) {
      const error = err as DOMException;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraStatus("denied");
        setMicStatus("denied");
      } else {
        setCameraStatus("unavailable");
        setMicStatus("unavailable");
      }
    }
  }, []);

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

        // Draw segmentation mask to get person pixels
        ctx.save();
        ctx.clearRect(0, 0, width, height);

        // Draw background
        if (selectedBg.url && selectedBg.url !== "blur" && bgImgRef.current) {
          ctx.drawImage(bgImgRef.current, 0, 0, width, height);
        } else {
          // Blurred background: draw video blurred
          ctx.filter = "blur(16px)";
          ctx.drawImage(results.image, 0, 0, width, height);
          ctx.filter = "none";
        }

        // Composite: keep only person pixels from live video
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(results.segmentationMask, 0, 0, width, height);
        ctx.globalCompositeOperation = "destination-over";
        if (selectedBg.url && selectedBg.url !== "blur" && bgImgRef.current) {
          ctx.drawImage(bgImgRef.current, 0, 0, width, height);
        } else {
          ctx.filter = "blur(16px)";
          ctx.drawImage(results.image, 0, 0, width, height);
          ctx.filter = "none";
        }
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

  // ── Start/stop segmentation when blur bg is selected ──────────────────
  useEffect(() => {
    if (selectedBg.url === "blur" && cameraStatus === "ok") {
      startSegmentation();
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

  // ── Mirror mode state (default ON) ──────────────────────────────────────
  const [mirrored, setMirrored] = useState(true);
  const mirrorStyle: React.CSSProperties = mirrored ? { transform: "scaleX(-1)" } : {};

  // ── Preview filter CSS — applied to background layer only ─────────────
  // Filters are composited behind the person so the person appears unfiltered.
  // For raw video (no bg), the filter is applied to a pseudo-background div.
  const bgFilter = selectedFilter.css === "none" ? undefined : selectedFilter.css;

  // Whether to show canvas (segmentation) or raw video
  const showCanvas = selectedBg.url === "blur" && (segmentationLoading || segmentationReady);

  // ── Join ───────────────────────────────────────────────────────────────
  const handleJoin = () => {
    stopSegmentation();
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
      <div className="flex flex-1 overflow-hidden">
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
          </div>

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

        {/* Right: backgrounds + filters panel */}
        <div className="w-72 flex flex-col border-l border-gray-800 bg-gray-900">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800">
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
