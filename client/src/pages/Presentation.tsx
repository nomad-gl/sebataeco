import { useState } from "react";
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
import { Loader2, Presentation as PresentationIcon, ChevronLeft, ChevronRight, Download, Printer, BookOpen, Lightbulb } from "lucide-react";
import { getLoginUrl } from "@/const";
import { exportPDF, exportWord, exportPNG } from "@/lib/exportUtils";

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

export default function Presentation() {
  const { isAuthenticated, loading } = useAuth();
  const [topic, setTopic] = useState("");
  const [heading, setHeading] = useState("");
  const [subject, setSubject] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [competency, setCompetency] = useState("");
  const [slideCount, setSlideCount] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [generated, setGenerated] = useState<PresentationData | null>(null);
  const [exportId, setExportId] = useState("presentation-content");

  const createMutation = trpc.materials.create.useMutation({
    onSuccess: (data) => {
      try {
        const content = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
        setGenerated(content as PresentationData);
        setCurrentSlide(0);
        setSlideCount((content as PresentationData).slides?.length ?? 0);
      } catch {
        console.error("Failed to parse presentation content");
      }
    },
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

  const slides = generated?.slides ?? [];
  const slide = slides[currentSlide];

  return (
    <div className="presentation-bg min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 container py-8 space-y-6">
        <div className="text-white">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold flex items-center gap-2">
            <PresentationIcon className="w-7 h-7 text-blue-300" /> Create a Presentation
          </h1>
          <p className="text-white/60 mt-1 text-sm">AI-generated slide decks aligned to LOMLOE competencies</p>
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
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating…</> : <><PresentationIcon className="w-4 h-4 mr-2" /> Generate Slides</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Slide viewer */}
        {generated && slides.length > 0 && (
          <div className="space-y-4" id={exportId}>
            {/* Export toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/60 text-sm">{slides.length} slides generated</span>
              <div className="ml-auto flex flex-wrap gap-2">
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
                  const lines: string[] = [generated.title, "", `Subject: ${generated.subject}`, `Year Group: ${generated.yearGroup}`, `Competency: ${generated.competency}`, ""];
                  slides.forEach((s, i) => {
                    lines.push(`--- Slide ${i + 1}: ${s.title} ---`);
                    lines.push(s.content);
                    if (s.keyVocabulary?.length) lines.push(`\nKey Vocabulary: ${s.keyVocabulary.join(", ")}`);
                    if (s.speakerNotes) lines.push(`\nSpeaker Notes: ${s.speakerNotes}`);
                    lines.push("");
                  });
                  // Build a minimal slides-compatible content object for exportWord
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

            {/* Slide card */}
            {slide && (
              <Card className="bg-gradient-to-br from-blue-900/80 to-indigo-900/80 border-blue-400/30 text-white min-h-[320px]">
                <CardHeader className="border-b border-blue-400/20 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-xl sm:text-2xl font-heading leading-snug">{slide.title}</CardTitle>
                    {slide.competencyTag && <Badge className="bg-blue-400/20 text-blue-200 border-blue-400/40 shrink-0 text-xs">{slide.competencyTag}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <p className="text-white/90 leading-relaxed whitespace-pre-line text-sm sm:text-base">{slide.content}</p>

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

                  {slide.speakerNotes && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">Speaker Notes</p>
                      <p className="text-white/70 text-xs leading-relaxed">{slide.speakerNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
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
