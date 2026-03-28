import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, XCircle, ChevronRight, Trophy, RotateCcw, Lightbulb } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import NavBar from "@/components/NavBar";
import CompetencySelector from "@/components/CompetencySelector";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const YEAR_GROUP_LABELS: Record<YearGroup, string> = {
  junior: "Junior (Yr 3–4)",
  primary: "Primary (Yr 5–6)",
  secondary: "Secondary (Yr 7–10)",
};

export default function Practice() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] ?? "");
  const initialCompetency = (urlParams.get("competency") as CompetencyCode) || undefined;

  const [competency, setCompetency] = useState<CompetencyCode | undefined>(initialCompetency);
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const SESSION_SIZE = 10;

  const saveSession = trpc.materials.saveSession.useMutation();

  const { data: question, refetch: fetchNext, isFetching } = trpc.lomloe.getRandomQuestion.useQuery(
    { competency, yearGroup, excludeIds: answeredIds },
    { enabled: sessionStarted && !sessionDone, staleTime: 0 }
  );

  const handleStart = () => {
    setAnsweredIds([]);
    setSelectedOption(null);
    setRevealed(false);
    setScore(0);
    setTotal(0);
    setSessionDone(false);
    setSessionStarted(true);
  };

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelectedOption(idx);
  };

  const handleReveal = () => {
    if (selectedOption === null || !question) return;
    setRevealed(true);
    const correct = selectedOption === question.correctIndex;
    if (correct) setScore((s) => s + 1);
    setTotal((t) => t + 1);
  };

  const handleNext = useCallback(async () => {
    if (!question) return;
    const newAnswered = [...answeredIds, question.id];
    setAnsweredIds(newAnswered);
    setSelectedOption(null);
    setRevealed(false);

    if (newAnswered.length >= SESSION_SIZE) {
      setSessionDone(true);
      // Save session to progress tracker (fire-and-forget, best effort)
      const finalScore = newAnswered.filter((_, i) => i < SESSION_SIZE).length > 0 ? score + (selectedOption === question?.correctIndex ? 1 : 0) : score;
      saveSession.mutate({ competency, yearGroup, score: finalScore, total: SESSION_SIZE });
      return;
    }
    await fetchNext();
  }, [question, answeredIds, fetchNext]);

  const handleRestart = () => {
    setSessionStarted(false);
    setSessionDone(false);
    setAnsweredIds([]);
    setSelectedOption(null);
    setRevealed(false);
    setScore(0);
    setTotal(0);
  };

  const isCorrect = revealed && selectedOption === question?.correctIndex;
  const isWrong = revealed && selectedOption !== question?.correctIndex;
  const progressPct = total > 0 ? (total / SESSION_SIZE) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-8 max-w-2xl mx-auto w-full flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Practice Mode</h1>
          <p className="text-sm text-muted-foreground">
            Test your LOMLOE knowledge with curriculum-aligned questions
          </p>
        </div>

        {/* Setup screen */}
        {!sessionStarted && (
          <Card>
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
              <CompetencySelector
                selectedCompetency={competency}
                selectedYearGroup={yearGroup}
                onCompetencyChange={setCompetency}
                onYearGroupChange={setYearGroup}
              />
              <div className="border-t border-border pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {SESSION_SIZE} questions per session
                </p>
                <Button onClick={handleStart} size="lg" className="gap-2 w-full sm:w-auto">
                  Start Practice <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session done */}
        {sessionDone && (
          <Card className="text-center">
            <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 sm:gap-5">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Session Complete!</h2>
                <p className="text-muted-foreground">
                  You scored{" "}
                  <span className="font-bold text-foreground">
                    {score} / {total}
                  </span>{" "}
                  ({Math.round((score / total) * 100)}%)
                </p>
              </div>
              <div className="w-full max-w-xs">
                <Progress value={(score / total) * 100} className="h-3" />
              </div>
              <p className="text-sm text-muted-foreground">
                {score === total
                  ? "Perfect score! Excellent work! 🎉"
                  : score >= total * 0.7
                  ? "Great job! Keep practising to improve further."
                  : "Good effort! Review the topics and try again."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button onClick={handleRestart} variant="outline" className="gap-2 w-full sm:w-auto">
                  <RotateCcw className="w-4 h-4" /> New Session
                </Button>
                <Button onClick={handleStart} className="gap-2 w-full sm:w-auto">
                  Retry Same Filters <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active question */}
        {sessionStarted && !sessionDone && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-3">
              <Progress value={progressPct} className="flex-1 h-2" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {total} / {SESSION_SIZE}
              </span>
              <span className="text-sm font-semibold text-primary whitespace-nowrap">
                {score} ✓
              </span>
            </div>

            {isFetching || !question ? (
              <Card>
                <CardContent className="p-8 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    Loading question…
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
                  {/* Competency badge */}
                  <div className="flex items-center gap-2">
                    <span className={cn("badge-" + question.competency)}>
                      {question.competency}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {question.yearGroup
                        ? YEAR_GROUP_LABELS[question.yearGroup as YearGroup]
                        : ""}
                    </span>
                  </div>

                  {/* Question */}
                  <p className="text-base sm:text-lg font-semibold text-foreground leading-snug">
                    {question.question}
                  </p>

                  {/* Options */}
                  <div className="flex flex-col gap-2">
                    {question.options.map((opt, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrectOpt = idx === question.correctIndex;

                      let optClass =
                        "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ";

                      if (!revealed) {
                        optClass += isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-white hover:border-primary hover:bg-secondary text-foreground";
                      } else if (isCorrectOpt) {
                        optClass += "border-green-500 bg-green-50 text-green-800";
                      } else if (isSelected && !isCorrectOpt) {
                        optClass += "border-red-400 bg-red-50 text-red-700";
                      } else {
                        optClass += "border-border bg-white text-muted-foreground opacity-60";
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelect(idx)}
                          disabled={revealed}
                          className={optClass}
                        >
                          <span className="flex items-center gap-2">
                            {revealed && isCorrectOpt && (
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                            {revealed && isSelected && !isCorrectOpt && (
                              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            )}
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback */}
                  {revealed && (
                    <div
                      className={cn(
                        "rounded-xl p-4 flex gap-3 items-start",
                        isCorrect ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"
                      )}
                    >
                      <Lightbulb
                        className={cn(
                          "w-5 h-5 flex-shrink-0 mt-0.5",
                          isCorrect ? "text-green-600" : "text-amber-600"
                        )}
                      />
                      <div className="flex flex-col gap-1.5">
                        <p
                          className={cn(
                            "font-semibold text-sm",
                            isCorrect ? "text-green-800" : "text-amber-800"
                          )}
                        >
                          {isCorrect ? "Correct! Well done." : "Not quite — the correct answer is:"}
                        </p>
                        {!isCorrect && (
                          <p className="text-sm text-amber-700 font-medium">
                            {question.options[question.correctIndex]}
                          </p>
                        )}
                        {question.explanation && (
                          <p className={cn(
                            "text-sm mt-1 leading-relaxed",
                            isCorrect ? "text-green-700" : "text-amber-700"
                          )}>
                            💡 {question.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    {!revealed ? (
                      <Button
                        onClick={handleReveal}
                        disabled={selectedOption === null}
                        className="gap-2"
                      >
                        Check Answer
                      </Button>
                    ) : (
                      <Button onClick={handleNext} className="gap-2">
                        Next Question <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
