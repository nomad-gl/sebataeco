import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Music, Upload, Trash2, Play, Pause, Plus, X, ChevronDown, ChevronUp,
  Volume2, FileAudio,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

// ─── Audio Player ─────────────────────────────────────────────────────────────

function AudioPlayer({ url, label }: { url: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => toast.error("Could not play audio"));
      setPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      title={playing ? `Pause "${label}"` : `Play "${label}"`}
      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
    >
      {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
    </button>
  );
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getAudioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(audio.duration));
    };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminAudioResponses() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.audioResponses.list.useQuery();

  const uploadMutation = trpc.audioResponses.upload.useMutation({
    onSuccess: () => {
      utils.audioResponses.list.invalidate();
      utils.audioResponses.listActive.invalidate();
      setLabel("");
      setTriggerInput("");
      setFile(null);
      toast.success(t("audio_uploaded"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.audioResponses.delete.useMutation({
    onSuccess: () => {
      utils.audioResponses.list.invalidate();
      utils.audioResponses.listActive.invalidate();
      toast.success(t("audio_deleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.audioResponses.toggleActive.useMutation({
    onSuccess: () => {
      utils.audioResponses.list.invalidate();
      utils.audioResponses.listActive.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.audioResponses.update.useMutation({
    onSuccess: () => {
      utils.audioResponses.list.invalidate();
      utils.audioResponses.listActive.invalidate();
      toast.success(t("audio_triggers_saved"));
    },
    onError: (e) => toast.error(e.message),
  });

  const [label, setLabel] = useState("");
  const [triggerInput, setTriggerInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editTriggers, setEditTriggers] = useState<Record<number, string>>({});
  const [editLabels, setEditLabels] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (f: File) => {
    if (!f.type.startsWith("audio/")) {
      toast.error(t("audio_invalid_type"));
      return;
    }
    if (f.size > 16 * 1024 * 1024) {
      toast.error(t("audio_too_large"));
      return;
    }
    setFile(f);
    if (!label) setLabel(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const handleUpload = async () => {
    if (!file || !label.trim()) return;
    const base64Data = await toBase64(file);
    const durationSecs = await getAudioDuration(file);
    const triggers = triggerInput
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    uploadMutation.mutate({
      label: label.trim(),
      triggerPhrases: triggers,
      fileName: file.name,
      mimeType: file.type,
      base64Data,
      durationSecs,
    });
  };

  const handleSaveItem = (id: number) => {
    const triggers = (editTriggers[id] ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    const lbl = (editLabels[id] ?? "").trim();
    updateMutation.mutate({ id, triggerPhrases: triggers, ...(lbl ? { label: lbl } : {}) });
  };

  const formatDuration = (secs?: number | null) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <BackButton label={t("btn_back")} />
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Music className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t("audio_responses_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("audio_responses_desc")}</p>
        </div>
      </div>

      {/* Upload card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("audio_upload_title")}</CardTitle>
          <CardDescription>{t("audio_upload_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-blue-500 bg-blue-500/5"
                : "border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileAudio className="w-5 h-5 text-blue-500" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("audio_drop_hint")}</p>
                <p className="text-xs text-muted-foreground">{t("audio_formats_hint")}</p>
              </div>
            )}
          </div>

          {/* Label */}
          <Input
            placeholder={t("audio_label_placeholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />

          {/* Trigger phrases */}
          <div className="space-y-1">
            <Input
              placeholder={t("audio_triggers_placeholder")}
              value={triggerInput}
              onChange={(e) => setTriggerInput(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">{t("audio_triggers_hint")}</p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || !label.trim() || uploadMutation.isPending}
            className="w-full gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploadMutation.isPending ? t("sp_upload_uploading") : t("audio_upload_btn")}
          </Button>
        </CardContent>
      </Card>

      {/* File list */}
      <div className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">{t("loading")}</p>
        )}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">{t("audio_empty")}</p>
        )}
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const editTrigVal = editTriggers[item.id] ?? item.triggerPhrases.join(", ");
          const editLabelVal = editLabels[item.id] ?? item.label;

          return (
            <Card key={item.id} className={cn("transition-all", !item.isActive && "opacity-50")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Play button */}
                  <AudioPlayer url={item.fileUrl} label={item.label} />

                  {/* Label + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {item.triggerPhrases.length > 0 ? (
                        item.triggerPhrases.slice(0, 3).map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs font-mono">{p}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{t("audio_no_triggers")}</span>
                      )}
                      {item.triggerPhrases.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{item.triggerPhrases.length - 3}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  {formatDuration(item.durationSecs) && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      <Volume2 className="w-3 h-3 inline mr-0.5" />
                      {formatDuration(item.durationSecs)}
                    </span>
                  )}

                  {/* Expand */}
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : item.id);
                      if (!isExpanded) {
                        setEditTriggers((p) => ({ ...p, [item.id]: item.triggerPhrases.join(", ") }));
                        setEditLabels((p) => ({ ...p, [item.id]: item.label }));
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Active toggle */}
                  <Switch
                    checked={item.isActive}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, isActive: v })}
                    title={item.isActive ? t("audio_disable") : t("audio_enable")}
                  />

                  {/* Delete */}
                  <button
                    onClick={() => deleteMutation.mutate({ id: item.id })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title={t("audio_delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">{t("audio_edit_label")}</p>
                      <Input
                        value={editLabelVal}
                        onChange={(e) => setEditLabels((p) => ({ ...p, [item.id]: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">{t("audio_edit_triggers")}</p>
                      <Input
                        value={editTrigVal}
                        onChange={(e) => setEditTriggers((p) => ({ ...p, [item.id]: e.target.value }))}
                        className="text-sm font-mono"
                        placeholder="hello, welcome, hola"
                      />
                      <p className="text-xs text-muted-foreground">{t("audio_triggers_hint")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveItem(item.id)}
                        disabled={updateMutation.isPending}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {t("save")}
                      </Button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info box */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p><Volume2 className="w-3 h-3 inline mr-1" />{t("audio_info_triggers")}</p>
          <p>{t("audio_info_active")}</p>
          <p>{t("audio_info_limit")}</p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
