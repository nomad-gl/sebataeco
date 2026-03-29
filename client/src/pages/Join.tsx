import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, CheckCircle2, Trophy, Users, ArrowRight } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

type Phase = "enter" | "waiting" | "question" | "done";

export default function Join() {
  const { t } = useI18n();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const initialCode = params.get("code") ?? "";

  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState("");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("enter");
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [gameStarting, setGameStarting] = useState(false);

  // Step 1: look up room by code
  const [lookupCode, setLookupCode] = useState("");
  const { data: foundRoom, isLoading: lookupLoading, isError: lookupError } = trpc.challenge.findRoom.useQuery(
    { roomCode: lookupCode },
    { enabled: lookupCode.length === 6, retry: false }
  );
  useEffect(() => { if (foundRoom?.id) setChallengeId(foundRoom.id); }, [foundRoom]);

  // Step 2: join the challenge
  const joinMutation = trpc.challenge.join.useMutation({
    onSuccess: (data) => {
      setParticipantId(data.participantId);
      setPhase("waiting");
    },
  });

  // Poll current question (waiting + question phases)
  const { data: currentQ } = trpc.challenge.currentQuestion.useQuery(
    { challengeId: challengeId ?? 0 },
    {
      enabled: !!challengeId && (phase === "waiting" || phase === "question"),
      refetchInterval: 2000,
    }
  );

  // Poll leaderboard when done
  const { data: leaderboard } = trpc.challenge.leaderboard.useQuery(
    { challengeId: challengeId ?? 0 },
    { enabled: !!challengeId && phase === "done", refetchInterval: false }
  );

  // Submit answer
  const submitMutation = trpc.challenge.submitAnswer.useMutation({
    onSuccess: (data) => {
      setAnswered(true);
      if (data.correct) setLastScore((s) => s + 1);
    },
  });

  // Phase transitions from poll
  useEffect(() => {
    if (!currentQ) return;
    if (currentQ.status === "active" && phase === "waiting") {
      // Brief "game starting" animation before switching to question
      setGameStarting(true);
      setTimeout(() => {
        setGameStarting(false);
        setPhase("question");
        setSelected(null);
        setAnswered(false);
      }, 1200);
    }
    if (currentQ.status === "finished") {
      setPhase("done");
    }
  }, [currentQ, phase]);

  // Reset answer when question index changes
  useEffect(() => {
    setSelected(null);
    setAnswered(false);
  }, [currentQ?.currentIndex]);

  const handleLookup = () => {
    if (code.trim().length === 6) setLookupCode(code.trim().toUpperCase());
  };

  const handleJoin = () => {
    if (!challengeId || !name.trim()) return;
    joinMutation.mutate({ challengeId, nickname: name.trim() });
  };

  const handleAnswer = (idx: number) => {
    if (answered || !participantId || !challengeId || !currentQ) return;
    setSelected(idx);
    submitMutation.mutate({ participantId, challengeId, answerIndex: idx });
  };

  // ── Game Starting Splash ────────────────────────────────────────────────────
  if (gameStarting) {
    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white space-y-6 animate-pulse">
          <div className="w-24 h-24 rounded-full bg-yellow-400/30 border-4 border-yellow-400/60 flex items-center justify-center mx-auto">
            <Zap className="w-12 h-12 text-yellow-300" />
          </div>
          <h2 className="text-4xl font-heading font-black text-yellow-300">Game Starting!</h2>
          <p className="text-white/70">Get ready…</p>
        </div>
      </div>
    );
  }

  // ── Enter code ─────────────────────────────────────────────────────────────
  if (phase === "enter") {
    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        {/* SEBA logo */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
            <Zap className="w-5 h-5 text-yellow-300" />
          </div>
          <span className="text-white font-heading font-bold text-lg">SEBA</span>
        </div>

        <Card className="w-full max-w-sm bg-white/10 border-white/20 text-white shadow-2xl">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-yellow-300" />
            </div>

            <CardTitle className="text-2xl font-heading">{t("join_title")}</CardTitle>
            <p className="text-white/60 text-sm">{t("join_subtitle")}</p>
          </CardHeader>

          <CardContent className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="text-white/80">{t("join_room_code")}</Label>
              <Input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setChallengeId(null); setLookupCode(""); }}
                placeholder="e.g. ABC123"
                maxLength={6}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-center text-3xl font-mono tracking-widest uppercase h-14"
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              />
            </div>

            {!challengeId ? (
              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold h-11"
                disabled={code.length < 6 || lookupLoading}
                onClick={handleLookup}
              >
                {lookupLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching…</>
                  : <>{t("join_find_room")} <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            ) : (
              <>
                <div className="bg-green-400/20 border border-green-400/40 rounded-xl p-3 text-center text-green-300 text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t("join_room_found")}: <strong>{foundRoom?.title}</strong></span>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">{t("join_your_name")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("join_name_placeholder")}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    autoFocus
                    maxLength={24}
                  />
                  <p className="text-white/40 text-xs">This is the name your classmates will see on the leaderboard.</p>
                </div>

                <Button
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold h-11"
                  disabled={!name.trim() || joinMutation.isPending}
                  onClick={handleJoin}
                >
                  {joinMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Joining…</>
                    : <><Zap className="w-4 h-4 mr-2" />{t("join_join_now")}</>}
                </Button>
              </>
            )}

            {(lookupError || joinMutation.isError) && (
              <p className="text-red-300 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-lg p-2">
                {lookupError ? t("join_not_found") : t("join_error")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Waiting ────────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        {/* SEBA logo */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
            <Zap className="w-5 h-5 text-yellow-300" />
          </div>
          <span className="text-white font-heading font-bold text-lg">SEBA</span>
        </div>

        <div className="text-center text-white space-y-6 max-w-sm w-full">
          {/* Animated waiting icon */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-yellow-400/10 border-2 border-yellow-400/20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center">
              <Users className="w-10 h-10 text-yellow-300" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-heading font-bold">{t("join_youre_in")}</h2>
            <p className="text-white/60 text-sm">{t("join_waiting")}</p>
          </div>

          {/* Name badge */}
          <div className="bg-white/10 rounded-xl border border-white/20 p-4 space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-widest">Your name</p>
            <p className="text-2xl font-bold text-white">{name}</p>
          </div>

          {/* Room code */}
          <div className="bg-black/20 rounded-xl border border-white/10 p-4 space-y-1">
            <p className="text-white/50 text-xs uppercase tracking-widest">{t("join_room")}</p>
            <p className="text-3xl font-mono font-bold tracking-widest text-yellow-300">{code}</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("join_checking")}
          </div>
        </div>
      </div>
    );
  }

  // ── Active question ────────────────────────────────────────────────────────
  if (phase === "question" && currentQ) {
    const letters = ["A", "B", "C", "D"];
    const optionColors = [
      "from-red-500/80 to-red-600/80 border-red-400/60",
      "from-blue-500/80 to-blue-600/80 border-blue-400/60",
      "from-yellow-500/80 to-yellow-600/80 border-yellow-400/60",
      "from-green-500/80 to-green-600/80 border-green-400/60",
    ];
    const optionColorsSelected = [
      "from-red-400 to-red-500 border-red-300 ring-2 ring-red-300",
      "from-blue-400 to-blue-500 border-blue-300 ring-2 ring-blue-300",
      "from-yellow-400 to-yellow-500 border-yellow-300 ring-2 ring-yellow-300",
      "from-green-400 to-green-500 border-green-300 ring-2 ring-green-300",
    ];

    return (
      <div className="challenge-bg min-h-screen flex flex-col p-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-300" />
            </div>
            <span className="text-white font-heading font-bold">SEBA</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/40">
              Q{(currentQ.currentIndex ?? 0) + 1}
            </Badge>
            {answered && (
              <Badge className="bg-green-400/20 text-green-300 border-green-400/40">
                <CheckCircle2 className="w-3 h-3 mr-1" /> {t("join_answered")}
              </Badge>
            )}
          </div>
        </div>

        {/* Question card */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-lg mx-auto w-full">
          <Card className="w-full bg-white/10 border-white/20 text-white">
            <CardContent className="p-5">
              <p className="text-lg sm:text-xl font-medium leading-snug">{currentQ.question}</p>
            </CardContent>
          </Card>

          {/* Answer options — coloured blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {(currentQ.options ?? []).map((opt: string, i: number) => {
              const isSelected = selected === i;
              const isCorrect = currentQ.answerRevealed && i === currentQ.correctIndex;
              const isWrong = currentQ.answerRevealed && isSelected && i !== currentQ.correctIndex;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={answered || !!currentQ.answerRevealed}
                  className={`rounded-2xl border bg-gradient-to-br p-4 text-left font-medium transition-all flex items-start gap-3 shadow-lg ${
                    isCorrect
                      ? "from-green-400 to-green-500 border-green-300 ring-2 ring-green-300 scale-[1.02]"
                      : isWrong
                      ? "from-red-600/60 to-red-700/60 border-red-400/40 opacity-70"
                      : isSelected
                      ? optionColorsSelected[i % 4]
                      : answered
                      ? `${optionColors[i % 4]} opacity-40 cursor-not-allowed`
                      : `${optionColors[i % 4]} hover:scale-[1.02] active:scale-[0.98]`
                  }`}
                >
                  <span className="font-black text-white/90 shrink-0 text-lg leading-none">{letters[i]}</span>
                  <span className="text-white text-sm leading-snug flex-1">{opt}</span>
                  {isCorrect && <span className="text-white font-black text-lg">✓</span>}
                  {isWrong && <span className="text-white/70 font-black text-lg">✗</span>}
                </button>
              );
            })}
          </div>

          {currentQ.answerRevealed && currentQ.explanation && (
            <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-3 text-green-200 text-sm w-full">
              <span className="font-semibold text-green-300">💡 </span>{currentQ.explanation}
            </div>
          )}

          {answered && !currentQ.answerRevealed && (
            <p className="text-center text-white/60 text-sm animate-pulse mt-2">
              {t("challenge_waiting_reveal")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === "done") {
    const sorted = [...(leaderboard ?? [])].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((p) => p.id === participantId) + 1;

    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white space-y-6 max-w-sm w-full">
          {/* Trophy */}
          <div className="w-24 h-24 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center mx-auto">
            <Trophy className="w-12 h-12 text-yellow-300" />
          </div>

          <div>
            <h2 className="text-3xl font-heading font-bold">{t("join_challenge_over")}</h2>
            {rank > 0 && (
              <p className="text-white/60 mt-1">
                {t("join_finished")} <span className="text-yellow-300 font-bold text-xl">#{rank}</span>
              </p>
            )}
          </div>

          {/* Score */}
          <div className="bg-white/10 rounded-2xl border border-white/20 p-5 space-y-1">
            <p className="text-white/60 text-sm">{t("join_your_score")}</p>
            <p className="text-5xl font-black text-yellow-300">{lastScore}</p>
          </div>

          {/* Leaderboard */}
          {sorted.length > 0 && (
            <div className="space-y-2 text-left">
              <p className="text-white/60 text-xs uppercase tracking-wide font-semibold">{t("join_leaderboard")}</p>
              {sorted.slice(0, 5).map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl p-3 ${
                    p.id === participantId
                      ? "bg-yellow-400/20 border border-yellow-400/40"
                      : "bg-white/5"
                  }`}
                >
                  <span className="text-xl w-7 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span className="flex-1 text-sm font-medium">{p.nickname}</span>
                  <span className="font-bold text-yellow-300">{p.score}</span>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold"
            onClick={() => {
              setPhase("enter");
              setChallengeId(null);
              setParticipantId(null);
              setCode("");
              setName("");
              setLastScore(0);
              setLookupCode("");
            }}
          >
            {t("join_play_again")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
