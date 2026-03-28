import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, CheckCircle2, Trophy, Users } from "lucide-react";
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

  // Poll current question
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
      setPhase("question");
      setSelected(null);
      setAnswered(false);
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

  // ── Enter code ─────────────────────────────────────────────────────────────
  if (phase === "enter") {
    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-white/10 border-white/20 text-white shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center mx-auto">
              <Zap className="w-7 h-7 text-yellow-300" />
            </div>
            <CardTitle className="text-2xl font-heading">{t("join_title")}</CardTitle>
            <p className="text-white/60 text-sm">{t("join_subtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/80">{t("join_room_code")}</Label>
              <Input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setChallengeId(null); }}
                placeholder="e.g. ABC123"
                maxLength={6}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-center text-2xl font-mono tracking-widest uppercase"
              />
            </div>

            {!challengeId ? (
              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold"
                disabled={code.length < 6 || lookupLoading}
                onClick={handleLookup}
              >
                {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("join_find_room")}
              </Button>
            ) : (
              <>
                <div className="bg-green-400/20 border border-green-400/40 rounded-lg p-3 text-center text-green-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" /> {t("join_room_found")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/80">{t("join_your_name")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("join_name_placeholder")}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    autoFocus
                  />
                </div>
                <Button
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold"
                  disabled={!name.trim() || joinMutation.isPending}
                  onClick={handleJoin}
                >
                  {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  {t("join_join_now")}
                </Button>
              </>
            )}

            {(lookupError || joinMutation.isError) && (
              <p className="text-red-300 text-sm text-center">
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
        <div className="text-center text-white space-y-6 max-w-sm">
          <div className="w-20 h-20 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center mx-auto animate-pulse">
            <Users className="w-10 h-10 text-yellow-300" />
          </div>
          <div>
            <h2 className="text-2xl font-heading font-bold">{t("join_youre_in")}</h2>            <p className="text-white/60 text-sm">{t("join_waiting")}</p>         </div>
          <div className="bg-white/10 rounded-xl border border-white/20 p-4">
            <p className="text-white/60 text-sm">{t("join_room")}</p>
            <p className="text-3xl font-mono font-bold tracking-widest text-yellow-300">{code}</p>
          </div>
            <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("join_checking")}
          </div>
        </div>
      </div>
    );
  }

  // ── Active question ────────────────────────────────────────────────────────
  if (phase === "question" && currentQ) {
    return (
      <div className="challenge-bg min-h-screen flex flex-col items-center justify-center p-4 gap-6">
        <div className="w-full max-w-lg space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/40">
              Q{(currentQ.currentIndex ?? 0) + 1}
            </Badge>
            {answered && (
              <Badge className="bg-green-400/20 text-green-300 border-green-400/40">
                <CheckCircle2 className="w-3 h-3 mr-1" /> {t("join_answered")}
              </Badge>
            )}
          </div>

          <Card className="bg-white/10 border-white/20 text-white">
            <CardContent className="p-5">
              <p className="text-lg sm:text-xl font-medium leading-snug">{currentQ.question}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(currentQ.options ?? []).map((opt: string, i: number) => {
              const letters = ["A", "B", "C", "D"];
              const isSelected = selected === i;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={answered}
                  className={`rounded-xl border p-4 text-left text-sm font-medium transition-all flex items-start gap-3 ${
                    isSelected
                      ? "bg-yellow-400/30 border-yellow-400 text-white"
                      : answered
                      ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40"
                  }`}
                >
                  <span className={`font-bold shrink-0 ${isSelected ? "text-yellow-300" : "text-white/50"}`}>{letters[i]}.</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {answered && (
            <p className="text-center text-white/60 text-sm animate-pulse">
              {t("join_waiting_next")}
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
          <div className="w-20 h-20 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center mx-auto">
            <Trophy className="w-10 h-10 text-yellow-300" />
          </div>
          <div>
            <h2 className="text-3xl font-heading font-bold">{t("join_challenge_over")}</h2>
            {rank > 0 && <p className="text-white/60 mt-1">{t("join_finished")} <span className="text-yellow-300 font-bold">#{rank}</span></p>}
          </div>
          <div className="bg-white/10 rounded-xl border border-white/20 p-4 space-y-1">
            <p className="text-white/60 text-sm">{t("join_your_score")}</p>
            <p className="text-4xl font-bold text-yellow-300">{lastScore}</p>
          </div>
          {sorted.length > 0 && (
            <div className="space-y-2 text-left">
              <p className="text-white/60 text-xs uppercase tracking-wide font-semibold">{t("join_leaderboard")}</p>
              {sorted.slice(0, 5).map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 rounded-lg p-2.5 ${p.id === participantId ? "bg-yellow-400/20 border border-yellow-400/40" : "bg-white/5"}`}>
                  <span className="text-white/50 font-bold w-5 text-sm">#{i + 1}</span>
                  <span className="flex-1 text-sm font-medium">{p.nickname}</span>
                  <span className="font-bold text-yellow-300">{p.score}</span>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => { setPhase("enter"); setChallengeId(null); setParticipantId(null); setCode(""); setName(""); setLastScore(0); }}
          >
            {t("join_play_again")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
