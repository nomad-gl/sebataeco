import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NavBar from "@/components/NavBar";
import {
  Loader2, Presentation as PresentationIcon, ChevronLeft, ChevronRight,
  Download, Printer, BookOpen, Lightbulb, Pencil, Check, X, FileQuestion, AlignLeft,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { exportPDF, exportWord, exportPNG } from "@/lib/exportUtils";
import { useLocation } from "wouter";
import { toast } from "sonner";

const COMPETENCIES = ["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"];
const YEAR_GROUPS = [
  { value: "junior", label: "Junior (Years 3–4)" },
  { value: "primary", label: "Primary (Years 5–6)" },
  { value: "secondary", label: "Secondary (Years 7–10)" },
];
const SUBJECTS = ["English","Spanish","Mathematics","Science","History","Geography","Art","Music","Physical Education","Technology","Social Studies"];

type Slide = {
  title: string;
  content: string;
  speakerNotes?: string;
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

// Inline editable field component
function EditableField({
  value, onChange, multiline, className,
}: { value: string; onChange: (v: string) => void; multiline?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 w-full">
        {multiline ? (
          <Textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            className={`bg-white/10 border-blue-400/60 text-white resize-none text-sm ${className ?? ""}`}
          />
        ) : (
          <Input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className={`bg-white/10 border-blue-400/60 text-white text-sm ${className ?? ""}`}
          />
        )}
        <div className="flex gap-1.5">
          <Button size="sm" className="h-6 px-2 text-xs bg-blue-500 hover:bg-blue-400" onClick={commit}><Check className="w-3 h-3 mr-1" />Save</Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-white/60 hover:text-white" onClick={cancel}><X className="w-3 h-3 mr-1" />Cancel</Button>
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

export default function Presentation() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [topic, setTopic] = useState("");
  const [heading, setHeading] = useState("");
  const [subject, setSubject] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [competency, setCompetency] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [generated, setGenerated] = useState<PresentationData | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const exportId = "presentation-export-area";

  const createMutation = trpc.materials.create.useMutation({
    onSuccess: (data) => {
      try {
        const content = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
        const pres = content as PresentationData;
        setGenerated(pres);
        setSlides(pres.slides ?? []);
        setCurrentSlide(0);
        toast.success("Presentation generated!");
      } catch {
        toast.error("Failed to parse presentation content");
      }
    },
    onError: () => toast.error("Generation failed — please try again"),
  });

  // Derive activity mutation (creates a quiz or fill-in-the-blank from slide text)
  const deriveMutation = trpc.materials.create.useMutation({
    onSuccess: (data) => {
      toast.success("Activity created! Opening in viewer…");
      navigate(`/materials/${data.id}`);
    },
    onError: () => toast.error("Failed to create derived activity"),
  });

  const handleGenerate = () => {
    if (!topic || !subject || !yearGroup) return;
    createMutation.mutate({
      type: "slides",
      topic: heading ? `${heading}: ${topic}` : topic,
      competency: (competency || undefined) as "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC" | undefined,
      yearGroup: yearGroup as "junior" | "primary" | "secondary",
    });
  };

  const handleDerive = (type: "quiz" | "missing_words") => {
    if (!generated || slides.length === 0) return;
    const slideSummary = slides.map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.content}`).join("\n\n");
    deriveMutation.mutate({
      type,
      topic: `Based on the following presentation:\n\n${slideSummary}`,
      competency: (generated.competency || undefined) as "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC" | undefined,
      yearGroup: generated.yearGroup as "junior" | "primary" | "secondary",
    });
  };

  // Slide field editors
  const updateSlideField = (idx: number, field: keyof Slide, value: string) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  if (loading) return <div className="presentation-bg min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>;

  if (!isAuthenticated) {
    return (
      <div className="presentation-bg min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full bg-white/10 border-white/20 text-white text-center p-6 space-y-4">
            <PresentationIcon className="w-12 h-12 mx-auto text-blue-300" />
            <h2 className="text-xl font-heading font-bold">Sign in to create presentations</h2>
            <Button className="w-full bg-blue-500 hover:bg-blue-400" onClick={() => window.location.href = getLoginUrl()}>Sign In</Button>
          </Card>
        </div>
      </div>
    );
  }

  const slide = slides[currentSlide];

  return (
    <div className="presentation-bg min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 container py-6 sm:py-8 space-y-6">
        <div className="text-white">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold flex items-center gap-2">
            <PresentationIcon className="w-7 h-7 text-blue-300" /> Create a Presentation
          </h1>
          <p className="text-white/60 mt-1 text-sm">AI-generated slide decks aligned to LOMLOE competencies. Click any slide text to edit it.</p>
        </div>

        {/* Generator form */}
        <Card className="bg-white/10 border-white/20 text-white">
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-white/80">Presentation Heading <span className="text-white/40">(optional)</span></Label>
              <Input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="e.g. Introduction to Photosynthesis" className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-white/80">Topic / Learning Objective <span className="text-red-400">*</span></Label>
              <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How plants convert sunlight into energy through photosynthesis" rows={2} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Subject <span className="text-red-400">*</span></Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Year Group <span className="text-red-400">*</span></Label>
              <Select value={yearGroup} onValueChange={setYearGroup}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Select year group" /></SelectTrigger>
                <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">LOMLOE Competency <span className="text-white/40">(optional)</span></Label>
              <Select value={competency} onValueChange={setCompetency}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Any competency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any competency</SelectItem>
                  {COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold"
                disabled={!topic || !subject || !yearGroup || createMutation.isPending}
                onClick={handleGenerate}
              >
                {createMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating…</>
                  : <><PresentationIcon className="w-4 h-4 mr-2" /> Generate Slides</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Slide viewer */}
        {generated && slides.length > 0 && (
          <div className="space-y-4">
            {/* Export + derive toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/60 text-sm">{slides.length} slides · click any text to edit</span>
              <div className="ml-auto flex flex-wrap gap-2">
                {/* Derive activity buttons */}
                <Button
                  size="sm"
                  className="bg-amber-500/80 hover:bg-amber-500 text-white text-xs"
                  disabled={deriveMutation.isPending}
                  onClick={() => handleDerive("quiz")}
                >
                  {deriveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileQuestion className="w-3 h-3 mr-1" />}
                  Generate Quiz
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-500/80 hover:bg-purple-500 text-white text-xs"
                  disabled={deriveMutation.isPending}
                  onClick={() => handleDerive("missing_words")}
                >
                  {deriveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <AlignLeft className="w-3 h-3 mr-1" />}
                  Fill-in-the-blank
                </Button>
                {/* Export buttons */}
                <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-xs" onClick={() => window.print()}>
                  <Printer className="w-3 h-3 mr-1" /> Print
                </Button>
                <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-xs" onClick={() => exportPDF(exportId, generated.title || "presentation")}>
                  <Download className="w-3 h-3 mr-1" /> PDF
                </Button>
                <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-xs" onClick={() => exportPNG(exportId, generated.title || "presentation")}>
                  <Download className="w-3 h-3 mr-1" /> PNG
                </Button>
                <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-xs" onClick={() => {
                  const wordContent = { title: generated.title, slides: slides.map((s, i) => ({ slideNumber: i + 1, title: s.title, content: s.content, speakerNotes: s.speakerNotes, keyVocabulary: s.keyVocabulary })) };
                  exportWord("slides", wordContent as unknown as import("@/lib/exportUtils").MaterialContent, generated.title || "presentation");
                }}>
                  <Download className="w-3 h-3 mr-1" /> Word
                </Button>
              </div>
            </div>

            {/* Slide navigation */}
            <div className="flex items-center gap-3 justify-center">
              <Button size="icon" variant="outline" className="border-white/30 text-white hover:bg-white/10" disabled={currentSlide === 0} onClick={() => setCurrentSlide(s => s - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-white/70 text-sm font-medium">{currentSlide + 1} / {slides.length}</span>
              <Button size="icon" variant="outline" className="border-white/30 text-white hover:bg-white/10" disabled={currentSlide === slides.length - 1} onClick={() => setCurrentSlide(s => s + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Editable slide card */}
            {slide && (
              <div id={exportId}>
                <Card className="bg-gradient-to-br from-blue-900/80 to-indigo-900/80 border-blue-400/30 text-white min-h-[320px]">
                  <CardHeader className="border-b border-blue-400/20 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-xl sm:text-2xl font-heading leading-snug flex-1">
                        <EditableField
                          value={slide.title}
                          onChange={v => updateSlideField(currentSlide, "title", v)}
                          className="font-heading text-xl sm:text-2xl font-bold"
                        />
                      </CardTitle>
                      {slide.competencyTag && <Badge className="bg-blue-400/20 text-blue-200 border-blue-400/40 shrink-0 text-xs">{slide.competencyTag}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="text-white/90 leading-relaxed text-sm sm:text-base">
                      <EditableField
                        value={slide.content}
                        onChange={v => updateSlideField(currentSlide, "content", v)}
                        multiline
                        className="whitespace-pre-line"
                      />
                    </div>

                    {slide.keyVocabulary && slide.keyVocabulary.length > 0 && (
                      <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-3 space-y-1.5">
                        <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Key Vocabulary</p>
                        <div className="flex flex-wrap gap-1.5">
                          {slide.keyVocabulary.map((v, i) => <Badge key={i} className="bg-blue-500/30 text-blue-100 border-blue-400/30 text-xs">{v}</Badge>)}
                        </div>
                      </div>
                    )}

                    {slide.imagePrompt && (
                      <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
                        <p className="text-yellow-200 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 mb-1"><Lightbulb className="w-3 h-3" /> Image Suggestion</p>
                        <p className="text-yellow-100/80 text-xs italic">{slide.imagePrompt}</p>
                      </div>
                    )}

                    {slide.speakerNotes !== undefined && (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">Speaker Notes</p>
                        <EditableField
                          value={slide.speakerNotes ?? ""}
                          onChange={v => updateSlideField(currentSlide, "speakerNotes", v)}
                          multiline
                          className="text-white/70 text-xs leading-relaxed"
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
                  className={`shrink-0 w-28 rounded-lg border p-2 text-left transition-all ${i === currentSlide ? "border-blue-400 bg-blue-400/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                >
                  <p className="text-white text-xs font-medium truncate">{i + 1}. {s.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
