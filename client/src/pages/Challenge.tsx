import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap, Users, Trophy, ChevronRight, ChevronLeft,
  Copy, Play, SkipForward, StopCircle, Plus, Loader2,
} from "lucide-react";
import CompetencySelector from "@/components/CompetencySelector";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const COMP_COLORS: Record<CompetencyCode, string> = {
  CCL: "bg-blue-100 text-blue-800", CP: "bg-purple-100 text-purple-800",
  STEM: "bg-green-100 text-green-800", CD: "bg-cyan-100 text-cyan-800",
  CPSAA: "bg-orange-100 text-orange-800", CC: "bg-red-100 text-red-800",
  CE: "bg-yellow-100 text-yellow-800", CCEC: "bg-pink-100 text-pink-800",
};

export default function Challenge() {
  const { user, loading, isAuthenticated } = useAuth();
  const [view, setView] = useState<"home" | "create" | "lobby" | "live" | "results">("home");
  const [roomId, setRoomId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [questionCount, setQuestionCount] = useState(10);
  const [pollInterval, setPollInterval] = useState<number | false>(false);

  const createMutation = trpc.challenge.create.useMutation({
    onSuccess: (data) => {
      setRoomId(data.id);
      setView("lobby");
      toast.success(`Room created! Code: ${data.roomCode}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const controlMutation = trpc.challenge.control.useMutation({
    onSuccess: () => roomQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const roomQuery = trpc.challenge.getRoom.useQuery(
    { id: roomId! },
    { enabled: roomId !== null, refetchInterval: pollInterval }
  );

  const myRooms = trpc.challenge.myRooms.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (view === "lobby" || view === "live") setPollInterval(2000);
    else setPollInterval(false);
  }, [view]);

  useEffect(() => {
    if (roomQuery.data?.status === "active" && view === "lobby") setView("live");
    if (roomQuery.data?.status === "finished" && view === "live") setView("results");
  }, [roomQuery.data?.status, view]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center challenge-bg">
      <Loader2 className="w-8 h-8 animate-spin text-white" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen challenge-bg">
      <NavBar />
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
        <Zap className="w-16 h-16 text-yellow-300" />
        <h1 className="text-3xl font-bold text-white">Host a Class Challenge</h1>
        <p className="text-white/80 max-w-md">Sign in to create live quiz sessions for your students.</p>
        <Button asChild size="lg" className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold">
          <a href={getLoginUrl()}>Sign In to Continue</a>
        </Button>
      </div>
    </div>
  );

  const room = roomQuery.data;

  return (
    <div className="min-h-screen challenge-bg">
      <NavBar />

      <div className="container py-6 sm:py-10 max-w-4xl">

        {/* ── Home view ── */}
        {view === "home" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 rounded-full px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
                <Zap className="w-4 h-4" /> Live Quiz Mode
              </div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white">Host a Class Challenge</h1>
              <p className="text-white/70 max-w-xl mx-auto">Create a live LOMLOE-aligned quiz. Students join on their phones with a room code and compete in real time.</p>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => setView("create")}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold gap-2 text-base px-8"
              >
                <Plus className="w-5 h-5" /> Create New Challenge
              </Button>
            </div>

            {/* Past rooms */}
            {myRooms.data && myRooms.data.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white/90">Your Recent Rooms</h2>
                <div className="grid gap-3">
                  {myRooms.data.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-colors"
                      onClick={() => { setRoomId(r.id); setView(r.status === "finished" ? "results" : "lobby"); }}
                    >
                      <div>
                        <p className="font-semibold text-white">{r.title}</p>
                        <p className="text-sm text-white/60">Code: <span className="font-mono font-bold text-yellow-300">{r.roomCode}</span></p>
                      </div>
                      <Badge className={r.status === "finished" ? "bg-gray-500" : r.status === "active" ? "bg-green-500" : "bg-yellow-500"}>
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Create view ── */}
        {view === "create" && (
          <div className="max-w-lg mx-auto space-y-6">
            <button onClick={() => setView("home")} className="flex items-center gap-1 text-white/70 hover:text-white text-sm transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-5">
              <h2 className="text-xl font-bold text-white">New Challenge</h2>

              <div className="space-y-2">
                <Label className="text-white/80">Challenge Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Year 5 STEM Review"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Competency &amp; Year Group (optional)</Label>
                <CompetencySelector
                  selectedCompetency={competency}
                  selectedYearGroup={yearGroup}
                  onCompetencyChange={(v) => setCompetency(v)}
                  onYearGroupChange={(v) => setYearGroup(v)}
                  compact
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Number of Questions: {questionCount}</Label>
                <input
                  type="range" min={5} max={20} value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-yellow-400"
                />
                <div className="flex justify-between text-xs text-white/50"><span>5</span><span>20</span></div>
              </div>

              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold"
                disabled={!title.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ title: title.trim(), competency, yearGroup, questionCount })}
              >
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</> : "Create Challenge Room"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Lobby view ── */}
        {view === "lobby" && room && (
          <div className="max-w-lg mx-auto space-y-6 text-center">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 space-y-4">
              <h2 className="text-xl font-bold text-white">{room.title}</h2>
              <p className="text-white/70">Share this code with your students:</p>
              <div className="bg-black/30 rounded-xl p-6">
                <p className="text-5xl font-mono font-black text-yellow-300 tracking-widest">{room.roomCode}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => { navigator.clipboard.writeText(room.roomCode); toast.success("Room code copied!"); }}
              >
                <Copy className="w-4 h-4 mr-2" /> Copy Code
              </Button>

              <div className="flex items-center justify-center gap-2 text-white/70">
                <Users className="w-4 h-4" />
                <span>{room.participants.length} student{room.participants.length !== 1 ? "s" : ""} joined</span>
              </div>

              {room.participants.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {room.participants.map((p) => (
                    <span key={p.id} className="bg-white/20 text-white text-sm px-3 py-1 rounded-full">{p.nickname}</span>
                  ))}
                </div>
              )}

              <Button
                size="lg"
                className="w-full bg-green-500 hover:bg-green-400 text-white font-bold gap-2"
                disabled={room.participants.length === 0 || controlMutation.isPending}
                onClick={() => controlMutation.mutate({ id: room.id, action: "start" })}
              >
                <Play className="w-5 h-5" /> Start Challenge
              </Button>
            </div>
          </div>
        )}

        {/* ── Live view ── */}
        {view === "live" && room && (() => {
          const q = room.questions[room.currentQuestion];
          return (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Question {room.currentQuestion + 1} / {room.questions.length}</span>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Users className="w-4 h-4" />
                  {room.participants.length} students
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full transition-all"
                  style={{ width: `${((room.currentQuestion + 1) / room.questions.length) * 100}%` }}
                />
              </div>

              {q && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4">
                  {q.competency && (
                    <Badge className={COMP_COLORS[q.competency as CompetencyCode] ?? "bg-gray-100 text-gray-800"}>
                      {q.competency}
                    </Badge>
                  )}
                  <p className="text-xl font-semibold text-white">{q.question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, i) => (
                      <div key={i} className="bg-white/10 border border-white/20 rounded-xl p-3 text-white text-sm">
                        <span className="font-bold text-yellow-300 mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live leaderboard */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 space-y-2">
                <h3 className="text-white font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-300" /> Live Leaderboard</h3>
                {room.participants.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-white/80 text-sm">{i + 1}. {p.nickname}</span>
                    <span className="text-yellow-300 font-bold text-sm">{p.score} pts</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold gap-2"
                  disabled={controlMutation.isPending}
                  onClick={() => controlMutation.mutate({ id: room.id, action: "next" })}
                >
                  <SkipForward className="w-4 h-4" />
                  {room.currentQuestion + 1 >= room.questions.length ? "Finish" : "Next Question"}
                </Button>
                <Button
                  variant="outline"
                  className="border-red-400/50 text-red-300 hover:bg-red-500/10"
                  disabled={controlMutation.isPending}
                  onClick={() => controlMutation.mutate({ id: room.id, action: "finish" })}
                >
                  <StopCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* ── Results view ── */}
        {view === "results" && room && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center space-y-2">
              <Trophy className="w-16 h-16 text-yellow-300 mx-auto" />
              <h2 className="text-2xl font-bold text-white">Challenge Complete!</h2>
              <p className="text-white/70">{room.title}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-white">Final Leaderboard</h3>
              {room.participants.length === 0 && <p className="text-white/50 text-sm">No participants.</p>}
              {room.participants.map((p, i) => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? "bg-yellow-400/20 border border-yellow-400/30" : "bg-white/5"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                    <span className="text-white font-medium">{p.nickname}</span>
                  </div>
                  <span className="text-yellow-300 font-bold">{p.score} / {room.questions.length}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold"
                onClick={() => { setView("create"); setTitle(""); setRoomId(null); }}
              >
                <Plus className="w-4 h-4 mr-2" /> New Challenge
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => setView("home")}
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
