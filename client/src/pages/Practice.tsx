import { useState, useCallback } from "react";
import { CheckCircle2, XCircle, ChevronRight, Trophy, RotateCcw, Lightbulb, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import ParallaxSection from "@/components/ParallaxSection";
import CompetencySelector from "@/components/CompetencySelector";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


const HERO_BG =
  "/manus-storage/hero-bg_a767782c.jpg";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "infantil" | "junior" | "primary" | "secondary";

export default function Practice() {
  const { t, lang } = useI18n();
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] ?? "");
  const initialCompetency = (urlParams.get("competency") as CompetencyCode) || undefined;

  const [competency, setCompetency] = useState<CompetencyCode | undefined>(initialCompetency);
  useDocumentTitle("Pràctica LOMLOE · Competències Clau");
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
  const saveAnswer = trpc.lomloe.saveAnswer.useMutation();

  const { data: question, refetch: fetchNext, isFetching } = trpc.lomloe.getRandomQuestion.useQuery(
    { competency, yearGroup, excludeIds: answeredIds, locale: (lang as "en" | "es" | "ca") },
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
    setTotal((prev) => prev + 1);
    // Fire-and-forget: record this answer for per-question analytics
    saveAnswer.mutate({
      questionId: question.id,
      competency: question.competency,
      yearGroup: question.yearGroup ?? "secondary",
      isCorrect: correct,
    });
  };

  const handleNext = useCallback(async () => {
    if (!question) return;
    const newAnswered = [...answeredIds, question.id];
    setAnsweredIds(newAnswered);
    setSelectedOption(null);
    setRevealed(false);

    if (newAnswered.length >= SESSION_SIZE) {
      setSessionDone(true);
      const finalScore = score + (selectedOption === question?.correctIndex ? 1 : 0);
      saveSession.mutate({ competency, yearGroup, score: finalScore, total: SESSION_SIZE });
      return;
    }
    await fetchNext();
  }, [question, answeredIds, fetchNext, score, selectedOption, competency, yearGroup, saveSession]);

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
  const progressPct = total > 0 ? (total / SESSION_SIZE) * 100 : 0;

  return (
    <div className="practice-bg flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-8 max-w-2xl mx-auto w-full flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-1">
          <BackButton variant="ghost" label={t("btn_back")} />
          <h1 className="text-2xl font-bold text-white">{t("practice_title")}</h1>
          <p className="text-sm text-white/70">{t("practice_subtitle")}</p>
        </div>

        {/* Setup screen */}
        {!sessionStarted && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
              <CompetencySelector
                selectedCompetency={competency}
                selectedYearGroup={yearGroup}
                onCompetencyChange={setCompetency}
                onYearGroupChange={setYearGroup}
              />
              <div className="border-t border-border pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-sm text-white/70">
                  {SESSION_SIZE} {t("practice_questions_per")}
                </p>
                <Button onClick={handleStart} size="lg" className="gap-2 w-full sm:w-auto">
                  {t("practice_start")} <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session done */}
        {sessionDone && (
          <Card className="text-center bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 sm:gap-5">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{t("practice_done_title")}</h2>
                <p className="text-white/75">
                  {t("practice_scored")}{" "}
                  <span className="font-bold text-white">
                    {score} / {total}
                  </span>{" "}
                  ({Math.round((score / total) * 100)}%)
                </p>
              </div>
              <div className="w-full max-w-xs">
                <Progress value={(score / total) * 100} className="h-3" />
              </div>
              <p className="text-sm text-white/75">
                {score === total
                  ? t("practice_perfect")
                  : score >= total * 0.7
                  ? t("practice_great")
                  : t("practice_good_effort")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button onClick={handleRestart} variant="outline" className="gap-2 w-full sm:w-auto">
                  <RotateCcw className="w-4 h-4" /> {t("practice_new_session")}
                </Button>
                <Button onClick={handleStart} className="gap-2 w-full sm:w-auto">
                  {t("practice_retry")} <ChevronRight className="w-4 h-4" />
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
              <span className="text-sm text-white/70 whitespace-nowrap">
                {total} / {SESSION_SIZE}
              </span>
              <span className="text-sm font-semibold text-blue-300 whitespace-nowrap">
                {score} ✓
              </span>
            </div>

            {isFetching || !question ? (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-8 flex items-center justify-center">
                  <div className="text-center text-white/75">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    {t("practice_loading_q")}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
                  {/* Competency badge */}
                  <div className="flex items-center gap-2">
                    <span className={cn("badge-" + question.competency)}>
                      {question.competency}
                    </span>
                    <span className="text-xs text-white/60">
                      {{ infantil: "Educació Infantil", junior: t("admin_junior"), primary: t("admin_primary"), secondary: t("admin_secondary") }[question.yearGroup ?? ""] ?? question.yearGroup ?? ""}
                    </span>
                  </div>

                  {/* Question */}
                  <p className="text-base sm:text-lg font-semibold text-white leading-snug">
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
                          ? "border-blue-400 bg-blue-500/20 text-white"
                          : "border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/20 text-white";
                      } else if (isCorrectOpt) {
                        optClass += "border-green-400 bg-green-500/20 text-green-200";
                      } else if (isSelected && !isCorrectOpt) {
                        optClass += "border-red-400 bg-red-500/20 text-red-200";
                      } else {
                        optClass += "border-white/10 bg-white/5 text-white/40 opacity-60";
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
                        isCorrect ? "bg-green-500/20 border border-green-400/40" : "bg-amber-500/20 border border-amber-400/40"
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
                            isCorrect ? "text-green-200" : "text-amber-200"
                          )}
                        >
                          {isCorrect ? t("practice_correct_well") : t("practice_not_quite")}
                        </p>
                        {!isCorrect && (
                          <p className="text-sm text-amber-300 font-medium">
                            {question.options[question.correctIndex]}
                          </p>
                        )}
                        {question.explanation && (
                          <p className={cn(
                            "text-sm mt-1 leading-relaxed",
                            isCorrect ? "text-green-300" : "text-amber-300"
                          )}>
                            💡 {question.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                    {!revealed ? (
                      <Button
                        onClick={handleReveal}
                        disabled={selectedOption === null}
                        className="gap-2"
                      >
                        {t("practice_check_answer")}
                      </Button>
                    ) : (
                      <Button onClick={handleNext} className="gap-2">
                        {t("practice_next")} <ChevronRight className="w-4 h-4" />
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
