import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import {
  Loader2, Presentation as PresentationIcon, ChevronLeft, ChevronRight,
  Download, Printer, BookOpen, Lightbulb, Pencil, Check, X, FileQuestion,
  AlignLeft, ImagePlus, ArrowLeft, Save, Layers, Maximize2, ChevronDown, MessageSquare,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { exportPDF, exportWord, exportPNG, exportToCsv, exportToXml } from "@/lib/exportUtils";
import ExportDropdown, { PrintIcon, PdfIcon, WordIcon, PngIcon, CsvIcon, XmlIcon } from "@/components/ExportDropdown";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useRef, useEffect } from "react";

const COMPETENCIES = ["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"];
const YEAR_GROUP_VALUES = [
  { value: "lower_primary", labelKey: "comp_lower_primary" as const },
  { value: "junior", labelKey: "comp_junior" as const },
  { value: "primary", labelKey: "comp_primary" as const },
  { value: "secondary", labelKey: "comp_secondary" as const },
];
const SUBJECT_KEYS = [
  "subject_english", "subject_spanish", "subject_mathematics", "subject_science",
  "subject_history", "subject_geography", "subject_art", "subject_music",
  "subject_pe", "subject_technology", "subject_social",
] as const;
const SUBJECT_VALUES = ["English","Spanish","Mathematics","Science","History","Geography","Art","Music","Physical Education","Technology","Social Studies"];

type Slide = {
  title: string;
  content: string;
  speakerNotes?: string;
  talkingPoints?: string[];
  keyVocabulary?: string[];
  competencyTag?: string;
  imagePrompt?: string;
};

type PresentationData = {
  title: string;
  subject: string;
  yearGroup: string;
  competency: string;
  slides: Slide[];
};

// ── Inline editable field ────────────────────────────────────────────────────
function EditableField({
  value, onChange, multiline, className,
}: { value: string; onChange: (v: string) => void; multiline?: boolean; className?: string }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 w-full">
        {multiline ? (
          <Textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={4}
            className="bg-white/10 border-blue-400/60 text-white resize-none text-sm" />
        ) : (
          <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            className="bg-white/10 border-blue-400/60 text-white text-sm" />
        )}
        <div className="flex gap-1.5">
          <Button size="sm" className="h-6 px-2 text-xs bg-blue-500 hover:bg-blue-400" onClick={commit}>
            <Check className="w-3 h-3 mr-1" />{t("save")}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-white/60 hover:text-white" onClick={cancel}>
            <X className="w-3 h-3 mr-1" />{t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative cursor-pointer ${className ?? ""}`} onClick={() => { setDraft(value); setEditing(true); }}>
      <span className="block">{value}</span>
      <Pencil className="w-3 h-3 absolute top-0 right-0 opacity-0 group-hover:opacity-60 text-blue-300 transition-opacity" />
    </div>
  );
}

// ── Full-slide preview modal ─────────────────────────────────────────────────
function SlidePreviewModal({
  slides,
  initialIndex,
  onClose,
  slideImages,
  generatingImageFor,
  onGenerateImage,
}: {
  slides: Slide[];
  initialIndex: number;
  onClose: () => void;
  slideImages?: Record<number, string>;
  generatingImageFor?: number | null;
  onGenerateImage?: (idx: number, prompt: string) => void;
}) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(initialIndex);
  const slide = slides[idx];
  if (!slide) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-br from-[#0d1f4a] to-[#1a1060] border border-blue-400/30 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/20">
          <span className="text-white/60 text-sm font-medium">
            Slide {idx + 1} / {slides.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8"
              disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8"
              disabled={idx === slides.length - 1} onClick={() => setIdx(i => i + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Slide content */}
        <div className="px-6 py-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white leading-snug flex-1">
              {slide.title}
            </h2>
            {slide.competencyTag && (
              <Badge className="bg-blue-400/20 text-blue-200 border-blue-400/40 shrink-0">{slide.competencyTag}</Badge>
            )}
          </div>

          <p className="text-white/90 leading-relaxed text-base whitespace-pre-line">{slide.content}</p>

          {slide.keyVocabulary && slide.keyVocabulary.length > 0 && (
            <div className="bg-blue-400/10 border border-blue-400/20 rounded-xl p-4 space-y-2">
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> {t("material_key_vocab")}
              </p>
              <div className="flex flex-wrap gap-2">
                {slide.keyVocabulary.map((v, i) => (
                  <Badge key={i} className="bg-blue-500/30 text-blue-100 border-blue-400/30">{v}</Badge>
                ))}
              </div>
            </div>
          )}

          {(slideImages?.[idx] || slide.imagePrompt) && (
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 space-y-3">
              {/* Image (if generated) */}
              {slideImages?.[idx] && (
                <img
                  src={slideImages[idx]}
                  alt={slide.imagePrompt ?? "Slide image"}
                  className="w-full rounded-xl object-cover max-h-72 border border-yellow-400/20"
                  crossOrigin="anonymous"
                />
              )}
              {slide.imagePrompt && (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-yellow-200 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 mb-1">
                      <Lightbulb className="w-3.5 h-3.5" /> {t("pres_image_suggestion")}
                    </p>
                    <p className="text-yellow-100/80 text-sm italic">{slide.imagePrompt}</p>
                  </div>
                  {onGenerateImage && (
                    <Button
                      size="sm"
                      className="shrink-0 bg-yellow-500/80 hover:bg-yellow-500 text-white text-xs px-2 py-1 h-auto gap-1"
                      disabled={generatingImageFor === idx}
                      onClick={() => onGenerateImage(idx, slide.imagePrompt!)}
                    >
                      {generatingImageFor === idx
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><ImagePlus className="w-3 h-3" /> {slideImages?.[idx] ? "Regenerate" : t("pres_generate_image_btn")}</>}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {slide.talkingPoints && slide.talkingPoints.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-400/25 rounded-xl p-4">
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Discussion Talking Points
              </p>
              <ol className="flex flex-col gap-1.5 list-decimal list-inside">
                {slide.talkingPoints.map((tp, i) => (
                  <li key={i} className="text-blue-100/80 text-sm leading-relaxed">{tp}</li>
                ))}
              </ol>
            </div>
          )}

          {slide.speakerNotes && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">{t("pres_speaker_notes")}</p>
              <p className="text-white/75 text-sm leading-relaxed whitespace-pre-line">{slide.speakerNotes}</p>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        <div className="px-6 pb-5 flex gap-2 overflow-x-auto">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`shrink-0 w-24 rounded-lg border p-2 text-left transition-all ${
                i === idx ? "border-blue-400 bg-blue-400/20" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <p className="text-white text-[10px] font-medium truncate">{i + 1}. {s.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Presentation() {
  const { t } = useI18n();
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();

  // Single generate form state
  const [topic, setTopic] = useState("");
  const [heading, setHeading] = useState("");
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState<string | undefined>(undefined);
  const [yearGroup, setYearGroup] = useState<string | undefined>(undefined);
  const [competency, setCompetency] = useState<string | undefined>(undefined);
  const [slideCount, setSlideCount] = useState(6);
  const [includeTalkingPoints, setIncludeTalkingPoints] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [generated, setGenerated] = useState<PresentationData | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [slideImages, setSlideImages] = useState<Record<number, string>>({});
  const [generatingImageFor, setGeneratingImageFor] = useState<number | null>(null);
  const [bulkGeneratingImages, setBulkGeneratingImages] = useState(false);
  const [bulkImageProgress, setBulkImageProgress] = useState<{ done: number; total: number } | null>(null);
  const [editablePrompts, setEditablePrompts] = useState<Record<number, string>>({});
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const exportId = "presentation-export-area";

  // Load saved material when navigated from My Materials with ?id=<materialId>
  const materialIdParam = new URLSearchParams(window.location.search).get("id");
  const loadMaterialId = materialIdParam ? parseInt(materialIdParam, 10) : null;
  const { data: loadedMaterial } = trpc.materials.get.useQuery(
    { id: loadMaterialId! },
    { enabled: !!loadMaterialId && !isNaN(loadMaterialId!) }
  );
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedMaterial || loadedRef.current) return;
    loadedRef.current = true;
    try {
      const content = typeof loadedMaterial.content === "string"
        ? JSON.parse(loadedMaterial.content as string)
        : (loadedMaterial.content as Record<string, unknown>);
      const pres = content as PresentationData;
      setGenerated(pres);
      setSlides(pres.slides ?? []);
      setTopic(loadedMaterial.topic ?? "");
      setSubject(pres.subject || undefined);
      setYearGroup(pres.yearGroup || undefined);
      setCompetency(pres.competency || undefined);
      setCurrentSlide(0);
      setSaved(true); // already saved
      toast.success("Presentation loaded — ready to edit");
    } catch {
      toast.error("Could not load presentation");
    }
  }, [loadedMaterial]);

  // Bulk generate state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkTopics, setBulkTopics] = useState("");
  const [bulkSubject, setBulkSubject] = useState<string | undefined>(undefined);
  const [bulkYearGroup, setBulkYearGroup] = useState<string | undefined>(undefined);
  const [bulkCompetency, setBulkCompetency] = useState<string | undefined>(undefined);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [bulkSchool, setBulkSchool] = useState("");
  const bulkAbortRef = useRef(false);

  // ── mutations ──────────────────────────────────────────────────────────────
  const createMutation = trpc.materials.create.useMutation({
    onSuccess: (data) => {
      try {
        const content = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
        const pres = content as PresentationData;
        setGenerated(pres);
        // Pre-fill teacher name and school on the front page (slide 1).
        // The raw LLM response uses heading/bullets; cast to access them safely.
        const teacherName = user?.name ?? user?.email ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawSlides = (pres.slides ?? []) as any[];
        const hydratedSlides: typeof pres.slides = rawSlides.map((s, idx) => {
          if (idx === 0 && Array.isArray(s.bullets)) {
            let bullets = s.bullets as string[];
            // Replace teacher name placeholder
            if (teacherName) {
              bullets = bullets.map((b: string) =>
                /teacher|Teacher:|Prepared by|teacher name/i.test(b)
                  ? b.replace(/teacher name placeholder|teacher name|Teacher:|Prepared by[^,]*/i, `Prepared by: ${teacherName}`)
                  : b
              );
            }
            // Append school name if provided
            if (school.trim()) {
              // Replace any existing school placeholder or append
              const hasSchool = bullets.some(b => /school|institution|centre/i.test(b));
              if (hasSchool) {
                bullets = bullets.map((b: string) =>
                  /school|institution|centre/i.test(b)
                    ? `${school.trim()}`
                    : b
                );
              } else {
                bullets = [...bullets, school.trim()];
              }
            }
            return { ...s, bullets };
          }
          return s;
        });
        setSlides(hydratedSlides);
        setCurrentSlide(0);
        setSaved(false);
        toast.success(t("presentation_generated"));
      } catch {
        toast.error(t("presentation_parse_error"));
      }
    },
    onError: () => toast.error(t("presentation_gen_failed")),
  });

  const saveMutation = trpc.materials.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success(t("lp_saved_toast"));
    },
    onError: () => toast.error(t("presentation_gen_failed")),
  });

  const exportPdfMut = trpc.presentations.exportPdf.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `${generated?.title ?? "presentation"}.pdf`;
      a.target = "_blank";
      a.click();
      toast.success(t("presentation_export_pdf_ready"));
    },
    onError: () => toast.error(t("presentation_export_pdf_failed")),
  });

  const generateSlideImageMut = trpc.presentations.generateSlideImage.useMutation({
    onSuccess: (data, _vars, context) => {
      const idx = context as number;
      if (!data.url) {
        console.error("[Presentation] Image generation returned no URL");
        toast.error(t("pres_image_gen_failed"));
        setGeneratingImageFor(null);
        return;
      }
      setSlideImages(prev => ({ ...prev, [idx]: data.url }));
      setGeneratingImageFor(null);
      toast.success(t("pres_image_generated"));
    },
    onError: (error) => {
      setGeneratingImageFor(null);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[Presentation] Image generation error:", errorMsg);
      toast.error(`${t("pres_image_gen_failed")}: ${errorMsg}`);
    },
  });

  const deriveMutation = trpc.materials.create.useMutation({
    onSuccess: (data) => {
      toast.success(t("presentation_activity_created"));
      navigate(`/materials/${data.id}`);
    },
    onError: () => toast.error(t("presentation_activity_failed")),
  });

  // tRPC utils for bulk (calls createMutation directly via mutateAsync)
  const utils = trpc.useUtils();

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!topic || !subject || !yearGroup) return;
    createMutation.mutate({
      type: "slides",
      topic: heading ? `${heading}: ${topic}` : topic,
      competency: (competency && competency !== "any" ? competency : undefined) as "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC" | undefined,
      yearGroup: yearGroup as "lower_primary" | "junior" | "primary" | "secondary",
      slideCount,
      includeTalkingPoints,
    });
  };

  const handleSave = () => {
    if (!generated) return;
    saveMutation.mutate({
      type: "slides",
      topic: topic || generated.title,
      competency: (generated.competency || undefined) as "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC" | undefined,
      yearGroup: (generated.yearGroup || undefined) as "junior" | "primary" | "secondary" | undefined,
      title: generated.title,
      content: JSON.stringify({
        ...generated,
        slides: slides.map((s, i) => ({
          ...s,
          // Persist edited image prompt if changed
          ...(editablePrompts[i] !== undefined ? { imagePrompt: editablePrompts[i] } : {}),
          // Persist generated image URL so it appears when reopened from My Materials
          ...(slideImages[i] ? { imageUrl: slideImages[i] } : {}),
        })),
      }),
    });
  };

  const handleExportPdf = () => {
    if (!generated) return;
    exportPdfMut.mutate({
      title: generated.title,
      subject: generated.subject,
      yearGroup: generated.yearGroup,
      competency: generated.competency,
      slides: slides.map(s => ({
        title: s.title,
        content: s.content,
        speakerNotes: s.speakerNotes,
        keyVocabulary: s.keyVocabulary,
        competencyTag: s.competencyTag,
      })),
    });
  };

  const getPrompt = (idx: number, fallback: string) => editablePrompts[idx] ?? fallback;

  const handleGenerateImage = (idx: number, prompt: string) => {
    setGeneratingImageFor(idx);
    generateSlideImageMut.mutate({ prompt }, { onSettled: () => setGeneratingImageFor(null) });
  };

  const handleBulkGenerateImages = async () => {
    const targets = slides
      .map((s, i) => ({ i, prompt: getPrompt(i, s.imagePrompt ?? "") }))
      .filter(x => x.prompt.trim() !== "");
    if (targets.length === 0) return;
    setBulkGeneratingImages(true);
    setBulkImageProgress({ done: 0, total: targets.length });
    for (let t = 0; t < targets.length; t++) {
      const { i, prompt } = targets[t]!;
      try {
        const result = await generateSlideImageMut.mutateAsync({ prompt });
        setSlideImages(prev => ({ ...prev, [i]: result.url ?? "" }));
      } catch {
        // continue to next slide even if one fails
      }
      setBulkImageProgress({ done: t + 1, total: targets.length });
    }
    setBulkGeneratingImages(false);
    setBulkImageProgress(null);
    toast.success("All images generated");
  };

  const handleDerive = (type: "quiz" | "missing_words") => {
    if (!generated || slides.length === 0) return;
    const slideSummary = slides.map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.content}`).join("\n\n");
    deriveMutation.mutate({
      type,
      topic: `Based on the following presentation:\n\n${slideSummary}`,
      competency: (generated.competency || undefined) as "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC" | undefined,
      yearGroup: generated.yearGroup as "lower_primary" | "junior" | "primary" | "secondary",
    });
  };

  const updateSlideField = (idx: number, field: keyof Slide, value: string | string[]) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // Bulk generate: iterate topics sequentially, save each
  const handleBulkGenerate = async () => {
    const topicList = bulkTopics.split("\n").map(t => t.trim()).filter(Boolean);
    if (topicList.length === 0 || !bulkSubject || !bulkYearGroup) return;
    bulkAbortRef.current = false;
    setBulkProgress({ done: 0, total: topicList.length, current: topicList[0]! });

    for (let i = 0; i < topicList.length; i++) {
      if (bulkAbortRef.current) break;
      const t = topicList[i]!;
      setBulkProgress({ done: i, total: topicList.length, current: t });
      try {
        await utils.client.materials.create.mutate({
          type: "slides",
          topic: t,
          school: bulkSchool.trim() || undefined,
          competency: (bulkCompetency && bulkCompetency !== "any" ? bulkCompetency : undefined) as "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC" | undefined,
          yearGroup: bulkYearGroup as "junior" | "primary" | "secondary",
        });
      } catch {
        toast.error(`Failed: ${t}`);
      }
    }

    setBulkProgress(null);
    if (!bulkAbortRef.current) {
      toast.success(`${topicList.length} presentations saved to My Materials`);
      utils.materials.list.invalidate();
    }
  };

  const slide = slides[currentSlide];

  if (loading) return (
    <div className="presentation-bg min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-white" />
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="presentation-bg min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full bg-[#0d1f4a]/90 border-white/20 text-white text-center p-6 space-y-4">
            <PresentationIcon className="w-12 h-12 mx-auto text-blue-300" />
            <h2 className="text-xl font-heading font-bold">{t("pres_signin_title")}</h2>
            <Button className="w-full bg-blue-500 hover:bg-blue-400"
              onClick={() => window.location.href = getLoginUrl(window.location.pathname + window.location.search)}>
              {t("nav_sign_in")}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="presentation-bg min-h-screen flex flex-col">
      <NavBar />

      {/* Full-slide preview modal */}
      {previewIndex !== null && (
        <SlidePreviewModal
          slides={slides}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          slideImages={slideImages}
          generatingImageFor={generatingImageFor}
          onGenerateImage={handleGenerateImage}
        />
      )}

      <main className="flex-1 container py-6 sm:py-8 space-y-6">
        {/* Page header */}
        <div className="text-white flex flex-col gap-1">
          <BackButton variant="ghost" label={t("btn_back")} />
          <h1 className="text-2xl sm:text-3xl font-heading font-bold flex items-center gap-2">
            <PresentationIcon className="w-7 h-7 text-blue-300" /> {t("pres_title")}
          </h1>
          <p className="text-white/70 mt-1 text-sm">{t("pres_subtitle")}</p>
        </div>

        {/* ── Generator form ─────────────────────────────────────────────────── */}
        <Card className="bg-[#0d1f4a]/90 border-blue-400/30 text-white shadow-xl">
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-white/90 font-medium">
                {t("pres_heading_label")} <span className="text-white/50 font-normal">({t("optional")})</span>
              </Label>
              <Input value={heading} onChange={(e) => setHeading(e.target.value)}
                placeholder={t("pres_heading_placeholder")}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/40 focus:border-blue-400" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/90 font-medium">
                School / Institution <span className="text-white/50 font-normal">({t("optional")})</span>
              </Label>
              <Input value={school} onChange={(e) => setSchool(e.target.value)}
                placeholder="e.g. Institut Escola Aina"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/40 focus:border-blue-400" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-white/90 font-medium">
                {t("pres_topic_label")} <span className="text-red-400">*</span>
              </Label>
              <Textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder={t("pres_topic_placeholder")} rows={2}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/40 resize-none focus:border-blue-400" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/90 font-medium">
                {t("pres_subject_label")} <span className="text-red-400">*</span>
              </Label>
              <Select value={subject ?? undefined} onValueChange={setSubject}>
                <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400">
                  <SelectValue placeholder={t("pres_select_subject")} />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_KEYS.map((k, i) => <SelectItem key={k} value={SUBJECT_VALUES[i]!}>{t(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/90 font-medium">
                {t("comp_year_group_label")} <span className="text-red-400">*</span>
              </Label>
              <Select value={yearGroup ?? undefined} onValueChange={setYearGroup}>
                <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400">
                  <SelectValue placeholder={t("pres_select_year")} />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_GROUP_VALUES.map(y => <SelectItem key={y.value} value={y.value}>{t(y.labelKey)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/90 font-medium">
                {t("pres_competency_label")} <span className="text-white/50 font-normal">({t("optional")})</span>
              </Label>
              <Select value={competency ?? undefined} onValueChange={setCompetency}>
                <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400">
                  <SelectValue placeholder={t("presentation_any_competency")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("presentation_any_competency")}</SelectItem>
                  {COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/90 font-medium">
                {t("pres_num_slides" as any)} <span className="text-white/50 font-normal">(3–12)</span>
              </Label>
              <Input
                type="number" min={3} max={12} value={slideCount}
                onChange={(e) => setSlideCount(Math.min(12, Math.max(3, parseInt(e.target.value) || 6)))}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/40 focus:border-blue-400"
              />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label className="text-white/90 font-medium">{t("pres_options" as any)}</Label>
              <label className="flex items-center gap-2 cursor-pointer select-none h-10 px-3 rounded-md bg-white/10 border border-white/30 hover:bg-white/15 transition-colors">
                <input
                  type="checkbox"
                  checked={includeTalkingPoints}
                  onChange={e => setIncludeTalkingPoints(e.target.checked)}
                  className="w-4 h-4 accent-blue-400"
                />
                <span className="text-white/90 text-sm">{t("pres_discussion_points" as any)}</span>
              </label>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold shadow-md"
                disabled={!topic || !subject || !yearGroup || createMutation.isPending}
                onClick={handleGenerate}
              >
                {createMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("pres_generating")}</>
                  : <><PresentationIcon className="w-4 h-4 mr-2" /> {t("pres_generate_btn")}</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Slide viewer ───────────────────────────────────────────────────── */}
        {generated && slides.length > 0 && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/70 text-sm">{slides.length} {t("pres_slides_hint")}</span>
              <div className="ml-auto flex flex-wrap gap-2">
                {/* Save button */}
                <Button
                  size="sm"
                  className={saved
                    ? "bg-green-600/80 hover:bg-green-600 text-white text-xs"
                    : "bg-[#003082] hover:bg-[#002060] text-white text-xs"}
                  disabled={saveMutation.isPending || saved}
                  onClick={handleSave}
                >
                  {saveMutation.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    : <Save className="w-3 h-3 mr-1" />}
                  {saved ? t("sa_saved") : t("btn_save")}
                </Button>
                {/* Derive activity buttons */}
                <Button size="sm" className="bg-amber-500/80 hover:bg-amber-500 text-white text-xs"
                  disabled={deriveMutation.isPending} onClick={() => handleDerive("quiz")}>
                  {deriveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileQuestion className="w-3 h-3 mr-1" />}
                  {t("pres_gen_quiz")}
                </Button>
                <Button size="sm" className="bg-purple-500/80 hover:bg-purple-500 text-white text-xs"
                  disabled={deriveMutation.isPending} onClick={() => handleDerive("missing_words")}>
                  {deriveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <AlignLeft className="w-3 h-3 mr-1" />}
                  {t("pres_fill_blank")}
                </Button>
                {/* Export dropdown */}
                <ExportDropdown
                  size="sm"
                  className="border-white/30 text-white hover:bg-white/10 bg-transparent"
                  options={[
                    { key: "print", icon: <PrintIcon />, label: t("material_print"), onClick: () => window.print() },
                    { key: "pdf", icon: <PdfIcon />, label: "PDF", onClick: handleExportPdf },
                    { key: "png", icon: <PngIcon />, label: "PNG", onClick: () => exportPNG(exportId, generated.title || "presentation") },
                    { key: "word", icon: <WordIcon />, label: "Word", onClick: () => {
                      const wordContent = { title: generated.title, slides: slides.map((s, i) => ({ slideNumber: i + 1, title: s.title, content: s.content, speakerNotes: s.speakerNotes, keyVocabulary: s.keyVocabulary })) };
                      exportWord("slides", wordContent as unknown as import("@/lib/exportUtils").MaterialContent, generated.title || "presentation");
                    }},
                    { key: "csv", icon: <CsvIcon />, label: t("export_csv"), separator: true, onClick: () => {
                      const rows = slides.map((s, i) => ({ slide: i + 1, title: s.title, content: s.content, speaker_notes: s.speakerNotes ?? "", key_vocabulary: (s.keyVocabulary ?? []).join("; "), competency: s.competencyTag ?? "" }));
                      exportToCsv(generated.title || "presentation", rows);
                    }},
                    { key: "xml", icon: <XmlIcon />, label: t("export_xml"), onClick: () => {
                      const rows = slides.map((s, i) => ({ slide: i + 1, title: s.title, content: s.content, speaker_notes: s.speakerNotes ?? "", key_vocabulary: (s.keyVocabulary ?? []).join("; "), competency: s.competencyTag ?? "" }));
                      exportToXml(generated.title || "presentation", "presentation", rows, "slide");
                    }},
                  ]}
                />
              </div>
            </div>

            {/* Slide navigation */}
            <div className="flex items-center gap-3 justify-center">
              <Button size="icon" variant="outline" className="border-white/30 text-white hover:bg-white/10"
                disabled={currentSlide === 0} onClick={() => setCurrentSlide(s => s - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-white/80 text-sm font-medium">{currentSlide + 1} / {slides.length}</span>
              <Button size="icon" variant="outline" className="border-white/30 text-white hover:bg-white/10"
                disabled={currentSlide === slides.length - 1} onClick={() => setCurrentSlide(s => s + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline"
                className="border-white/30 text-white hover:bg-white/10 gap-1.5 ml-2"
                onClick={() => setPreviewIndex(currentSlide)}
              >
                <Maximize2 className="w-3.5 h-3.5" /> Full Preview
              </Button>
            </div>

            {/* Editable slide card */}
            {slide && (
              <div id={exportId}>
                <Card className="bg-[#0d1f4a]/95 border-blue-400/40 text-white min-h-[320px] shadow-xl">
                  <CardHeader className="border-b border-blue-400/20 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-xl sm:text-2xl font-heading leading-snug flex-1">
                        <EditableField
                          value={slide.title}
                          onChange={v => updateSlideField(currentSlide, "title", v)}
                          className="font-heading text-xl sm:text-2xl font-bold"
                        />
                      </CardTitle>
                      {slide.competencyTag && (
                        <Badge className="bg-blue-400/20 text-blue-200 border-blue-400/40 shrink-0 text-xs">
                          {slide.competencyTag}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="text-white/95 leading-relaxed text-sm sm:text-base">
                      <EditableField
                        value={slide.content}
                        onChange={v => updateSlideField(currentSlide, "content", v)}
                        multiline
                        className="whitespace-pre-line"
                      />
                    </div>

                    {slide.keyVocabulary && slide.keyVocabulary.length > 0 && (
                      <div className="bg-blue-400/15 border border-blue-400/25 rounded-lg p-3 space-y-1.5">
                        <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                          <BookOpen className="w-3 h-3" /> {t("material_key_vocab")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {slide.keyVocabulary.map((v, i) => (
                            <Badge key={i} className="bg-blue-500/40 text-blue-100 border-blue-400/30 text-xs">{v}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {slide.imagePrompt && (
                      <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3 space-y-2">
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-yellow-200 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                            <Lightbulb className="w-3 h-3" /> {t("pres_image_suggestion")}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Bulk generate button — only shown when there are slides with prompts */}
                            {slides.filter(s => s.imagePrompt).length > 1 && (
                              <Button size="sm"
                                className="bg-orange-500/80 hover:bg-orange-500 text-white text-xs px-2 py-1 h-auto gap-1"
                                disabled={bulkGeneratingImages || generatingImageFor !== null}
                                onClick={handleBulkGenerateImages}>
                                {bulkGeneratingImages
                                  ? <><Loader2 className="w-3 h-3 animate-spin" />
                                      {bulkImageProgress ? ` ${bulkImageProgress.done}/${bulkImageProgress.total}` : ""}
                                    </>
                                  : <><Layers className="w-3 h-3" /> Generate All Images</>}
                              </Button>
                            )}
                            {/* Single slide generate button */}
                            <Button size="sm"
                              className="shrink-0 bg-yellow-500/80 hover:bg-yellow-500 text-white text-xs px-2 py-1 h-auto"
                              disabled={generatingImageFor === currentSlide || bulkGeneratingImages}
                              onClick={() => handleGenerateImage(currentSlide, getPrompt(currentSlide, slide.imagePrompt!))}>
                              {generatingImageFor === currentSlide
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <><ImagePlus className="w-3 h-3 mr-1" /> {t("pres_generate_image_btn")}</>}
                            </Button>
                          </div>
                        </div>
                        {/* Editable prompt text */}
                        <Textarea
                          value={editablePrompts[currentSlide] ?? slide.imagePrompt}
                          onChange={e => setEditablePrompts(prev => ({ ...prev, [currentSlide]: e.target.value }))}
                          rows={2}
                          className="text-yellow-100/90 text-xs italic bg-yellow-400/5 border-yellow-400/30 focus:border-yellow-400 resize-none placeholder:text-yellow-200/40"
                          placeholder="Describe the image to generate…"
                        />
                        {/* Bulk progress bar */}
                        {bulkGeneratingImages && bulkImageProgress && (
                          <div className="space-y-1">
                            <Progress
                              value={(bulkImageProgress.done / bulkImageProgress.total) * 100}
                              className="h-1.5 bg-yellow-400/20"
                            />
                            <p className="text-yellow-200/60 text-xs text-right">
                              {bulkImageProgress.done} / {bulkImageProgress.total} generated
                            </p>
                          </div>
                        )}
                        {/* Generated image preview */}
                        {slideImages[currentSlide] && (
                          <img src={slideImages[currentSlide]} alt={getPrompt(currentSlide, slide.imagePrompt)}
                            className="w-full rounded-lg object-cover max-h-48 border border-yellow-400/20"
                            crossOrigin="anonymous" />
                        )}
                      </div>
                    )}

                    {slide.talkingPoints && slide.talkingPoints.length > 0 && (
                      <div className="bg-blue-500/10 border border-blue-400/25 rounded-lg p-3">
                        <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> Discussion Talking Points
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {slide.talkingPoints.map((tp, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-blue-300 text-xs mt-1.5 shrink-0">{i + 1}.</span>
                              <Input
                                value={tp}
                                onChange={e => {
                                  const updated = [...slide.talkingPoints!];
                                  updated[i] = e.target.value;
                                  updateSlideField(currentSlide, "talkingPoints", updated);
                                }}
                                className="flex-1 h-7 text-xs bg-blue-500/10 border-blue-400/30 text-blue-100 placeholder:text-blue-300/40 focus:border-blue-400"
                              />
                              <Button size="icon" variant="ghost"
                                className="h-7 w-7 text-blue-300/60 hover:text-red-400 shrink-0"
                                onClick={() => {
                                  const updated = slide.talkingPoints!.filter((_, bi) => bi !== i);
                                  updateSlideField(currentSlide, "talkingPoints", updated);
                                }}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button size="sm" variant="ghost"
                            className="self-start text-xs text-blue-300 hover:text-blue-200 h-6 px-2 gap-1 mt-0.5"
                            onClick={() => updateSlideField(currentSlide, "talkingPoints", [...(slide.talkingPoints ?? []), ""])}>
                            + Add talking point
                          </Button>
                        </div>
                      </div>
                    )}

                    {slide.speakerNotes !== undefined && (
                      <div className="bg-white/8 border border-white/15 rounded-lg p-3">
                        <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">
                          {t("pres_speaker_notes")}
                        </p>
                        <EditableField
                          value={slide.speakerNotes ?? ""}
                          onChange={v => updateSlideField(currentSlide, "speakerNotes", v)}
                          multiline
                          className="text-white/80 text-xs leading-relaxed"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Slide thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`shrink-0 w-28 rounded-lg border p-2 text-left transition-all ${
                    i === currentSlide
                      ? "border-blue-400 bg-blue-400/25"
                      : "border-white/15 bg-white/8 hover:bg-white/15"
                  }`}
                >
                  <p className="text-white text-xs font-medium truncate">{i + 1}. {s.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Bulk Generate section ──────────────────────────────────────────── */}
        <Card className="bg-[#0d1f4a]/90 border-blue-400/30 text-white shadow-xl">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            onClick={() => setShowBulk(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-300" />
              <span className="font-semibold text-white">{t("pres_bulk_generate" as any)}</span>
              <Badge className="bg-blue-400/20 text-blue-200 border-blue-400/30 text-xs ml-1">New</Badge>
            </div>
            <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${showBulk ? "rotate-180" : ""}`} />
          </button>

          {showBulk && (
            <CardContent className="px-5 pb-5 pt-0 space-y-4 border-t border-blue-400/20">
              <p className="text-white/70 text-sm">
                {t("pres_bulk_desc" as any)}
              </p>
              <Textarea
                value={bulkTopics}
                onChange={e => setBulkTopics(e.target.value)}
                placeholder={t("pres_bulk_placeholder" as any)}
                rows={6}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/30 resize-none focus:border-blue-400 font-mono text-sm"
              />
              {/* School / Institution */}
              <div className="space-y-1.5">
                <Label className="text-white/90 font-medium text-sm">{t("pres_bulk_school_label" as any)} <span className="text-white/40 font-normal">({t("pres_bulk_school_optional" as any)})</span></Label>
                <Input
                  value={bulkSchool}
                  onChange={e => setBulkSchool(e.target.value)}
                  placeholder="e.g. Escola Pia de Mataró"
                  className="bg-white/10 border-white/30 text-white placeholder:text-white/30 focus:border-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-white/90 font-medium text-sm">{t("pres_bulk_subject" as any)} <span className="text-red-400">*</span></Label>
                  <Select value={bulkSubject} onValueChange={setBulkSubject}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400">
                      <SelectValue placeholder={t("pres_bulk_select_subject" as any)} />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECT_KEYS.map((k, i) => <SelectItem key={k} value={SUBJECT_VALUES[i]!}>{t(k)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/90 font-medium text-sm">{t("pres_bulk_year_group" as any)} <span className="text-red-400">*</span></Label>
                  <Select value={bulkYearGroup} onValueChange={setBulkYearGroup}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400">
                      <SelectValue placeholder={t("pres_bulk_select_year" as any)} />
                    </SelectTrigger>
                    <SelectContent>
                      {YEAR_GROUP_VALUES.map(y => <SelectItem key={y.value} value={y.value}>{t(y.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/90 font-medium text-sm">{t("pres_bulk_competency" as any)}</Label>
                  <Select value={bulkCompetency} onValueChange={setBulkCompetency}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400">
                      <SelectValue placeholder={t("pres_bulk_any" as any)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">{t("pres_bulk_any" as any)}</SelectItem>
                      {COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {bulkProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>{t("pres_bulk_generating" as any)} <span className="text-white font-medium">{bulkProgress.current}</span></span>
                    <span>{bulkProgress.done} / {bulkProgress.total}</span>
                  </div>
                  <Progress value={(bulkProgress.done / bulkProgress.total) * 100} className="h-2 bg-white/10" />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="bg-blue-500 hover:bg-blue-400 text-white font-bold shadow-md flex-1"
                  disabled={
                    !bulkTopics.trim() || !bulkSubject || !bulkYearGroup || bulkProgress !== null
                  }
                  onClick={handleBulkGenerate}
                >
                  {bulkProgress
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("pres_bulk_generating_ellipsis" as any)}</>
                    : <><Layers className="w-4 h-4 mr-2" /> {t("pres_bulk_generate_save" as any)}</>}
                </Button>
                {bulkProgress && (
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10"
                    onClick={() => { bulkAbortRef.current = true; }}>
                    {t("pres_bulk_cancel" as any)}
                  </Button>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}
