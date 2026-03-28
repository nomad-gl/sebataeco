import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NavBar from "@/components/NavBar";
import CompetencySelector from "@/components/CompetencySelector";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  BookOpen, Presentation, Grid3X3, AlignLeft, Search, CreditCard,
  Loader2, ChevronRight, Lock, Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";
type MaterialType = "quiz" | "slides" | "crossword" | "missing_words" | "wordsearch" | "flashcards";

const ACTIVITY_TYPES: {
  type: MaterialType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { type: "quiz",          label: "Quiz",              description: "8 MCQ questions with answers & explanations", icon: BookOpen,      color: "from-blue-500 to-blue-600" },
  { type: "slides",        label: "Slide Presentation",description: "6–8 slides with headings, bullets & speaker notes", icon: Presentation, color: "from-purple-500 to-purple-600" },
  { type: "crossword",     label: "Crossword Puzzle",  description: "8-word interactive crossword with clues",      icon: Grid3X3,      color: "from-green-500 to-green-600" },
  { type: "missing_words", label: "Missing Words",     description: "Fill-in-the-blank passage with hints",         icon: AlignLeft,    color: "from-amber-500 to-amber-600" },
  { type: "wordsearch",    label: "Word Search",       description: "10-keyword grid with topic vocabulary",        icon: Search,       color: "from-rose-500 to-rose-600" },
  { type: "flashcards",    label: "Flashcards",        description: "10 term/definition pairs for revision",        icon: CreditCard,   color: "from-teal-500 to-teal-600" },
];

export default function Create() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [topic, setTopic] = useState("");
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();

  const createMutation = trpc.materials.create.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.title} created!`);
      navigate(`/materials/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate material. Please try again.");
    },
  });

  const handleGenerate = () => {
    if (!selectedType || !topic.trim()) return;
    createMutation.mutate({ type: selectedType, topic: topic.trim(), competency, yearGroup });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">Sign in to Create</h2>
              <p className="text-sm text-muted-foreground">
                You need to sign in to create and save teaching materials.
              </p>
              <Button asChild className="w-full">
                <a href={getLoginUrl()}>Sign in</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-8 max-w-3xl mx-auto flex flex-col gap-6 sm:gap-8">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Create Teaching Materials</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated, LOMLOE-aligned activities — saved to your library instantly.
          </p>
        </div>

        {/* Step 1: Choose activity type */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            1 · Choose Activity Type
          </h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTIVITY_TYPES.map(({ type, label, description, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all",
                  selectedType === type
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-secondary/30"
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{description}</p>
                </div>
                {selectedType === type && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Topic */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            2 · Enter Topic
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topic" className="text-sm">
              Topic or subject area
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The Water Cycle, Spanish Civil War, Fractions…"
              className="text-base"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Be specific for better results — include key concepts or vocabulary if relevant.
            </p>
          </div>
        </div>

        {/* Step 3: Competency & Year Group */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            3 · LOMLOE Context <span className="text-muted-foreground normal-case font-normal">(optional)</span>
          </h2>
          <Card>
            <CardContent className="p-4">
              <CompetencySelector
                selectedCompetency={competency}
                selectedYearGroup={yearGroup}
                onCompetencyChange={setCompetency}
                onYearGroupChange={setYearGroup}
                compact
              />
            </CardContent>
          </Card>
        </div>

        {/* Generate button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border pt-6 gap-3">
          <div className="text-sm text-muted-foreground">
            {selectedType && topic.trim()
              ? `Ready to generate: ${ACTIVITY_TYPES.find(a => a.type === selectedType)?.label} on "${topic}"`
              : "Select an activity type and enter a topic to continue."}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!selectedType || !topic.trim() || createMutation.isPending}
            size="lg"
            className="gap-2 w-full sm:w-auto sm:min-w-[160px]"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>

        {/* Powered by SEBA */}
        <p className="text-xs text-muted-foreground text-center pb-4">Powered by SEBA</p>
      </div>
    </div>
  );
}
