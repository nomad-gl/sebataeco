import { useState, useCallback } from "react";
import { CheckCircle2, XCircle, ChevronRight, Trophy, RotateCcw, Lightbulb, Baby } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type EixCode = "EIX1" | "EIX2" | "EIX3" | "EIX4";
type InfantilCycle = "0-3" | "3-6";

const EIX_COLORS: Record<EixCode, string> = {
  EIX1: "oklch(0.72 0.18 340)",  // pink-rose
  EIX2: "oklch(0.68 0.18 200)",  // teal
  EIX3: "oklch(0.72 0.18 130)",  // green
  EIX4: "oklch(0.68 0.18 260)",  // purple
};

export default function InfantilPractice() {
  const { t } = useI18n();
  useDocumentTitle("Pràctica Educació Infantil · Decree 21/2023");

  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] ?? "");
  const initialEix = (urlParams.get("eix") as EixCode) || undefined;

  const [eix, setEix] = useState<EixCode | undefined>(initialEix);
  const [cycle, setCycle] = useState<InfantilCycle | undefined>();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const SESSION_SIZE = 10;

  const { data: eixos } = trpc.lomloe.getEixMeta.useQuery();

  const { data: questions, refetch: refetchQuestions } = trpc.lomloe.getInfantilQuestions.useQuery(
    { eix, cycle, shuffle: true, limit: SESSION_SIZE + 5 },
    { enabled: sessionStarted, staleTime: 0 }
  );

  const currentQuestion = questions?.[currentIdx];

  const handleStart = () => {
    setAnsweredIds([]);
    setCurrentIdx(0);
    setSelectedOption(null);
    setRevealed(false);
    setScore(0);
    setTotal(0);
    setSessionDone(false);
    setSessionStarted(true);
    refetchQuestions();
  };

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelectedOption(idx);
  };

  const handleReveal = () => {
    if (selectedOption === null || !currentQuestion) return;
    setRevealed(true);
    const correct = selectedOption === currentQuestion.correctIndex;
    if (correct) setScore((s) => s + 1);
    setTotal((prev) => prev + 1);
  };

  const handleNext = useCallback(() => {
    if (!currentQuestion) return;
    const newAnswered = [...answeredIds, currentQuestion.id];
    setAnsweredIds(newAnswered);
    setSelectedOption(null);
    setRevealed(false);

    if (newAnswered.length >= SESSION_SIZE || currentIdx + 1 >= (questions?.length ?? 0)) {
      setSessionDone(true);
      return;
    }
    setCurrentIdx((i) => i + 1);
  }, [currentQuestion, answeredIds, currentIdx, questions]);

  const handleRestart = () => {
    setSessionStarted(false);
    setSessionDone(false);
    setAnsweredIds([]);
    setCurrentIdx(0);
    setSelectedOption(null);
    setRevealed(false);
    setScore(0);
    setTotal(0);
  };

  const isCorrect = revealed && selectedOption === currentQuestion?.correctIndex;
  const progressPct = total > 0 ? (total / SESSION_SIZE) * 100 : 0;

  const CYCLES: { value: InfantilCycle; label: string }[] = [
    { value: "0-3", label: t("infantil_cycle_03") },
    { value: "3-6", label: t("infantil_cycle_36") },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, oklch(0.18 0.04 300) 0%, oklch(0.22 0.06 340) 100%)" }}>
      <NavBar />

      <div className="container py-4 sm:py-8 max-w-2xl mx-auto w-full flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-1">
          <BackButton variant="ghost" label={t("btn_back")} />
          <div className="flex items-center gap-2">
            <Baby className="w-6 h-6 text-pink-300" />
            <h1 className="text-2xl font-bold text-white">{t("infantil_practice_title")}</h1>
          </div>
          <p className="text-sm text-white/70">{t("infantil_practice_subtitle")}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-500/20 text-pink-200 border border-pink-400/30">Decret 21/2023</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">LOMLOE</span>
          </div>
        </div>

        {/* Setup screen */}
        {!sessionStarted && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4 sm:p-6 flex flex-col gap-5">

              {/* Cycle selector */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60 mb-2">
                  {t("infantil_cycle_label")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCycle(undefined)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium border transition-all",
                      !cycle
                        ? "bg-pink-500 text-white border-pink-500"
                        : "bg-white/10 text-white/80 border-white/20 hover:border-pink-400 hover:text-pink-200"
                    )}
                  >
                    {t("comp_all")}
                  </button>
                  {CYCLES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setCycle(cycle === value ? undefined : value)}
                      className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium border transition-all",
                        cycle === value
                          ? "bg-pink-500 text-white border-pink-500"
                          : "bg-white/10 text-white/80 border-white/20 hover:border-pink-400 hover:text-pink-200"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eix selector */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60 mb-2">
                  {t("infantil_eix_label")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setEix(undefined)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium border transition-all",
                      !eix
                        ? "bg-pink-500 text-white border-pink-500"
                        : "bg-white/10 text-white/80 border-white/20 hover:border-pink-400 hover:text-pink-200"
                    )}
                  >
                    {t("comp_all")}
                  </button>
                  {eixos?.map((e) => (
                    <button
                      key={e.code}
                      onClick={() => setEix(eix === (e.code as EixCode) ? undefined : (e.code as EixCode))}
                      className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium border transition-all flex items-center gap-1",
                        eix === e.code
                          ? "bg-pink-500 text-white border-pink-500"
                          : "bg-white/10 text-white/80 border-white/20 hover:border-pink-400 hover:text-pink-200"
                      )}
                    >
                      <span>{e.emoji}</span>
                      <span>{e.code}</span>
                    </button>
                  ))}
                </div>
                {eix && eixos && (
                  <p className="text-xs text-white/50 mt-2 italic">
                    {eixos.find((e) => e.code === eix)?.catalan}
                  </p>
                )}
              </div>

              <div className="border-t border-white/20 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-sm text-white/70">
                  {SESSION_SIZE} {t("practice_questions_per")}
                </p>
                <Button onClick={handleStart} size="lg" className="gap-2 w-full sm:w-auto bg-pink-500 hover:bg-pink-600">
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
              <div className="w-20 h-20 rounded-full bg-pink-500/20 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-pink-300" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{t("practice_done_title")}</h2>
                <p className="text-white/75">
                  {t("practice_scored")}{" "}
                  <span className="font-bold text-white">
                    {score} / {total}
                  </span>{" "}
                  ({total > 0 ? Math.round((score / total) * 100) : 0}%)
                </p>
              </div>
              <div className="w-full max-w-xs">
                <Progress value={total > 0 ? (score / total) * 100 : 0} className="h-3" />
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
                <Button onClick={handleStart} className="gap-2 w-full sm:w-auto bg-pink-500 hover:bg-pink-600">
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
              <span className="text-sm font-semibold text-pink-300 whitespace-nowrap">
                {score} ✓
              </span>
            </div>

            {!currentQuestion ? (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-8 flex items-center justify-center">
                  <div className="text-center text-white/75">
                    <div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    {t("practice_loading_q")}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
                  {/* Eix badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{eixos?.find((e) => e.code === currentQuestion.eix)?.emoji ?? "🎓"}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-pink-500/20 text-pink-200 border border-pink-400/30">
                      {currentQuestion.eix}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/60 border border-white/20">
                      {currentQuestion.cycle === "0-3" ? t("infantil_cycle_03") : t("infantil_cycle_36")}
                    </span>
                  </div>

                  {/* Question */}
                  <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                    {currentQuestion.question}
                  </p>

                  {/* Options */}
                  <div className="flex flex-col gap-2">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrectOpt = idx === currentQuestion.correctIndex;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelect(idx)}
                          disabled={revealed}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all",
                            !revealed && !isSelected && "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-pink-400",
                            !revealed && isSelected && "bg-pink-500/30 text-white border-pink-400",
                            revealed && isCorrectOpt && "bg-green-500/30 text-green-100 border-green-400",
                            revealed && isSelected && !isCorrectOpt && "bg-red-500/30 text-red-100 border-red-400",
                            revealed && !isSelected && !isCorrectOpt && "bg-white/5 text-white/40 border-white/10"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {revealed && isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                            {revealed && isSelected && !isCorrectOpt && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {revealed && (
                    <div className={cn(
                      "rounded-lg p-4 flex gap-3 text-sm",
                      isCorrect ? "bg-green-500/20 border border-green-400/30" : "bg-red-500/20 border border-red-400/30"
                    )}>
                      <Lightbulb className={cn("w-4 h-4 mt-0.5 shrink-0", isCorrect ? "text-green-300" : "text-red-300")} />
                      <p className={cn("leading-relaxed", isCorrect ? "text-green-100" : "text-red-100")}>
                        {currentQuestion.explanation}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-between items-center pt-1">
                    {!revealed ? (
                      <Button
                        onClick={handleReveal}
                        disabled={selectedOption === null}
                        className="ml-auto bg-pink-500 hover:bg-pink-600"
                      >
                        {t("practice_check")}
                      </Button>
                    ) : (
                      <Button onClick={handleNext} className="ml-auto gap-2 bg-pink-500 hover:bg-pink-600">
                        {total >= SESSION_SIZE ? t("practice_finish") : t("practice_next")}
                        <ChevronRight className="w-4 h-4" />
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
