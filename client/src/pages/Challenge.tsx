import { useState, useEffect, useMemo, useCallback } from "react";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Zap, Users, Trophy, ChevronRight, ChevronLeft,
  Copy, Play, SkipForward, StopCircle, Plus, Loader2,
  BookOpen, Library, CheckCircle2, QrCode, Link2, Printer, Eye, ArrowLeft,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import CompetencySelector from "@/components/CompetencySelector";
import { useI18n } from "@/contexts/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const COMP_COLORS: Record<CompetencyCode, string> = {
  CCL: "bg-blue-100 text-blue-800", CP: "bg-purple-100 text-purple-800",
  STEM: "bg-green-100 text-green-800", CD: "bg-cyan-100 text-cyan-800",
  CPSAA: "bg-orange-100 text-orange-800", CC: "bg-red-100 text-red-800",
  CE: "bg-yellow-100 text-yellow-800", CCEC: "bg-pink-100 text-pink-800",
};

const TYPE_ICONS: Record<string, string> = {
  quiz: "📝", slides: "📊", crossword: "🔤", missing_words: "✏️",
  wordsearch: "🔍", flashcards: "🃏",
};

export default function Challenge() {
  const { t } = useI18n();
  const { user, loading, isAuthenticated } = useAuth();

  // Read query params for deep-linking from MyMaterials / MaterialView
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlMaterialId = urlParams.get("materialId") ? parseInt(urlParams.get("materialId")!, 10) : null;
  const urlMaterialTitle = urlParams.get("materialTitle") ? decodeURIComponent(urlParams.get("materialTitle")!) : "";

  const [view, setView] = useState<"home" | "create" | "lobby" | "live" | "results">(urlMaterialId ? "create" : "home");
  const [roomId, setRoomId] = useState<number | null>(null);
  const [title, setTitle] = useState(urlMaterialTitle);
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();
  const [questionCount, setQuestionCount] = useState(10);
  const [pollInterval, setPollInterval] = useState<number | false>(false);

  // Material picker state — pre-select if navigated from MyMaterials
  const [createTab, setCreateTab] = useState<"bank" | "material">(urlMaterialId ? "material" : "bank");
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(urlMaterialId);

  // Track previously seen participant IDs for join animation
  const [prevParticipantIds, setPrevParticipantIds] = useState<Set<number>>(new Set());
  const [newlyJoined, setNewlyJoined] = useState<Set<number>>(new Set());

  const createMutation = trpc.challenge.create.useMutation({
    onSuccess: (data) => {
      setRoomId(data.id);
      setView("lobby");
      toast.success(`${t("challenge_room_code")}: ${data.roomCode}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const createFromMaterialMutation = trpc.challenge.createFromMaterial.useMutation({
    onSuccess: (data) => {
      setRoomId(data.id);
      setView("lobby");
      toast.success(`${t("challenge_room_code")}: ${data.roomCode}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const controlMutation = trpc.challenge.control.useMutation({
    onSuccess: () => roomQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });

  // Enable polling immediately when roomId is set so the lobby never shows blank
  const isInRoomView = view === "lobby" || view === "live";
  const roomQuery = trpc.challenge.getRoom.useQuery(
    { id: roomId! },
    { enabled: roomId !== null, refetchInterval: isInRoomView ? 2000 : false }
  );

  const myRooms = trpc.challenge.myRooms.useQuery(undefined, { enabled: isAuthenticated });
  const myMaterials = trpc.materials.list.useQuery(undefined, { enabled: isAuthenticated && view === "create" });

  // Save-to-group dialog state (declared after roomQuery)
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveGroupId, setSaveGroupId] = useState<string>("none");
  const myGroups = trpc.groups.list.useQuery(undefined, { enabled: isAuthenticated && showSaveDialog });
  const saveMutation = trpc.progress.saveChallengeToGroup.useMutation({
    onSuccess: (data) => {
      toast.success(`${t("challenge_save_group_success")} (${data.matched}/${data.total} matched)`);
      setShowSaveDialog(false);
    },
    onError: () => toast.error(t("challenge_save_group_error")),
  });
  const handleSaveToGroup = useCallback(() => {
    const r = roomQuery.data;
    if (!r || !roomId || saveGroupId === "none") return;
    saveMutation.mutate({
      groupId: parseInt(saveGroupId, 10),
      challengeId: roomId,
      challengeTitle: r.title,
      competency: r.competency ?? undefined,
      participants: r.participants.map((p) => ({
        nickname: p.nickname,
        score: p.score,
        total: r.questions.length,
      })),
    });
  }, [roomQuery.data, roomId, saveGroupId, saveMutation]);

  // pollInterval kept for backwards compat but roomQuery now uses isInRoomView directly
  useEffect(() => {
    if (view === "lobby" || view === "live") setPollInterval(2000);
    else setPollInterval(false);
  }, [view]);

  useEffect(() => {
    if (roomQuery.data?.status === "active" && view === "lobby") setView("live");
    if (roomQuery.data?.status === "finished" && view === "live") setView("results");
  }, [roomQuery.data?.status, view]);

  // Detect newly joined participants for animation
  useEffect(() => {
    if (!roomQuery.data?.participants) return;
    const currentIds = new Set(roomQuery.data.participants.map((p) => p.id));
    const fresh = new Set<number>();
    currentIds.forEach((id) => { if (!prevParticipantIds.has(id)) fresh.add(id); });
    if (fresh.size > 0) {
      setNewlyJoined(fresh);
      setTimeout(() => setNewlyJoined(new Set()), 1500);
    }
    setPrevParticipantIds(currentIds);
  }, [roomQuery.data?.participants]);

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
        <h1 className="text-3xl font-bold text-white">{t("challenge_title")}</h1>
        <p className="text-white/80 max-w-md">{t("challenge_subtitle")}</p>
        <Button asChild size="lg" className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold">
          <a href={getLoginUrl(window.location.pathname + window.location.search)}>{t("nav_sign_in")}</a>
        </Button>
      </div>
    </div>
  );

  const room = roomQuery.data;
  const allMaterials = myMaterials.data ?? [];
  const isPending = createMutation.isPending || createFromMaterialMutation.isPending;

  const handleCreate = () => {
    if (createTab === "bank") {
      createMutation.mutate({ title: title.trim(), competency, yearGroup, questionCount });
    } else {
      if (!selectedMaterialId) return;
      createFromMaterialMutation.mutate({ title: title.trim(), materialId: selectedMaterialId });
    }
  };

  const canCreate = title.trim().length >= 2 && !isPending &&
    (createTab === "bank" || (createTab === "material" && selectedMaterialId !== null));

  // Build the student join URL
  const joinUrl = room
    ? `${window.location.origin}/join?code=${room.roomCode}`
    : "";

  return (
    <div className="min-h-screen challenge-bg">
      <NavBar />

      <div className="container py-6 sm:py-10 max-w-4xl">

        {/* ── Home view ── */}
        {view === "home" && (
          <div className="space-y-6">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="size-4" />{t("btn_back")}
            </Button>
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 rounded-full px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
                <Zap className="w-4 h-4" /> {t("challenge_title")}
              </div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white">{t("challenge_title")}</h1>
              <p className="text-white/70 max-w-xl mx-auto">{t("challenge_subtitle")}</p>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => setView("create")}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold gap-2 text-base px-8"
              >
                <Plus className="w-5 h-5" /> {t("challenge_start")}
              </Button>
            </div>

            {/* Past rooms */}
            {myRooms.data && myRooms.data.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white/90">{t("challenge_leaderboard")}</h2>
                <div className="grid gap-3">
                  {myRooms.data.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-colors"
                      onClick={() => { setRoomId(r.id); setView(r.status === "finished" ? "results" : "lobby"); }}
                    >
                      <div>
                        <p className="font-semibold text-white">{r.title}</p>
                        <p className="text-sm text-white/60">{t("challenge_room_code")}: <span className="font-mono font-bold text-yellow-300">{r.roomCode}</span></p>
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
          <div className="max-w-2xl mx-auto space-y-6">
            <button onClick={() => setView("home")} className="flex items-center gap-1 text-white/70 hover:text-white text-sm transition-colors">
              <ChevronLeft className="w-4 h-4" /> {t("cancel")}
            </button>

            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-5">
              <h2 className="text-xl font-bold text-white">{t("challenge_start")}</h2>

              {/* Challenge title */}
              <div className="space-y-2">
                <Label className="text-white/80">{t("challenge_title")}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("challenge_title")}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              {/* Source tabs */}
              <div className="flex rounded-xl overflow-hidden border border-white/20">
                {[
                  { key: "bank", label: t("challenge_source_bank"), icon: BookOpen },
                  { key: "material", label: t("challenge_source_materials"), icon: Library },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setCreateTab(key as "bank" | "material")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                      createTab === key ? "bg-yellow-400/30 text-yellow-200" : "text-white/60 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              {/* Knowledge Bank options */}
              {createTab === "bank" && (
                <>
                  <CompetencySelector
                    selectedCompetency={competency}
                    selectedYearGroup={yearGroup}
                    onCompetencyChange={(c) => setCompetency(c as CompetencyCode | undefined)}
                    onYearGroupChange={(y) => setYearGroup(y as YearGroup | undefined)}
                  />
                  <div className="space-y-2">
                    <Label className="text-white/80">{t("challenge_question_count")}: <span className="text-yellow-300 font-bold">{questionCount}</span></Label>
                    <input
                      type="range" min={5} max={20} step={1}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full accent-yellow-400"
                    />
                    <div className="flex justify-between text-xs text-white/50"><span>5</span><span>20</span></div>
                  </div>
                </>
              )}

              {/* My Materials picker */}
              {createTab === "material" && (
                <div className="space-y-3">
                  {myMaterials.isLoading ? (
                    <div className="flex items-center gap-2 text-white/60 text-sm py-4 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" /> {t("challenge_loading_materials")}
                    </div>
                  ) : allMaterials.length === 0 ? (
                    <div className="text-center py-6 text-white/50 text-sm">
                      <Library className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>{t("challenge_no_materials")}</p>
                      <p className="text-xs mt-1">{t("challenge_no_materials_hint")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-white/50">{t("challenge_materials_hint")}</p>
                      {allMaterials.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMaterialId(m.id)}
                          className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                            selectedMaterialId === m.id
                              ? "bg-yellow-400/20 border-yellow-400/60"
                              : "bg-white/5 border-white/20 hover:bg-white/10"
                          }`}
                        >
                          <span className="text-xl">{TYPE_ICONS[m.type] ?? "📄"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{m.title}</p>
                            <p className="text-xs text-white/50 capitalize">{m.type.replace("_", " ")}</p>
                          </div>
                          {selectedMaterialId === m.id && (
                            <CheckCircle2 className="w-5 h-5 text-yellow-300 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold"
                disabled={!canCreate}
                onClick={handleCreate}
              >
                {isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("create_generating")}</>
                  : t("challenge_start")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Lobby view ── */}
        {view === "lobby" && !room && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            {roomQuery.isError || (roomQuery.isFetched && roomQuery.data === null) ? (
              <>
                <p className="text-white/70 text-sm">{t("error")}: Could not load room.</p>
                <Button variant="ghost" className="text-white/70 hover:text-white" onClick={() => { setRoomId(null); setView("home"); }}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-yellow-300" />
                <p className="text-white/70 text-sm">Loading room…</p>
              </>
            )}
          </div>
        )}
        {view === "lobby" && room && (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 bg-green-400/20 text-green-300 border border-green-400/30 rounded-full px-4 py-1.5 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                Waiting for students to join
              </div>
              <h2 className="text-2xl font-bold text-white">{room.title}</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Room code + QR */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex flex-col items-center gap-4">
                <div className="space-y-1 text-center">
                  <p className="text-white/60 text-xs uppercase tracking-widest font-semibold">Room Code</p>
                  <p className="text-5xl font-mono font-black text-yellow-300 tracking-widest">{room.roomCode}</p>
                </div>

                {/* QR Code */}
                <div className="bg-white rounded-xl p-3">
                  <QRCodeSVG value={joinUrl} size={140} />
                </div>

                <p className="text-white/50 text-xs text-center">Scan to join or visit</p>
                <p className="text-yellow-200 text-xs font-mono break-all text-center">{window.location.origin}/join</p>

                {/* Copy buttons */}
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 border-white/30 text-white hover:bg-white/10 gap-1.5 text-xs"
                    onClick={() => { navigator.clipboard.writeText(room.roomCode); toast.success(t("challenge_room_copied")); }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Code
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 border-white/30 text-white hover:bg-white/10 gap-1.5 text-xs"
                    onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success(t("challenge_link_copied")); }}
                  >
                    <Link2 className="w-3.5 h-3.5" /> Link
                  </Button>
                </div>
              </div>

              {/* Participants panel */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Users className="w-5 h-5 text-yellow-300" />
                    <span className="font-semibold">{t("challenge_students_joined")}</span>
                  </div>
                  <span className="text-2xl font-bold text-yellow-300">{room.participants.length}</span>
                </div>

                <div className="flex-1 min-h-[120px] max-h-[200px] overflow-y-auto">
                  {room.participants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40">
                      <Users className="w-8 h-8 opacity-40" />
                      <p className="text-sm">{t("challenge_waiting_students")}</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {room.participants.map((p) => (
                        <span
                          key={p.id}
                          className={`text-sm px-3 py-1 rounded-full font-medium transition-all duration-500 ${
                            newlyJoined.has(p.id)
                              ? "bg-yellow-400 text-black scale-110"
                              : "bg-white/20 text-white"
                          }`}
                        >
                          {p.nickname}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  size="lg"
                  className={`w-full font-bold gap-2 transition-all ${
                    room.participants.length > 0
                      ? "bg-green-500 hover:bg-green-400 text-white"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                  disabled={room.participants.length === 0 || controlMutation.isPending}
                  onClick={() => controlMutation.mutate({ id: room.id, action: "start" })}
                >
                  {controlMutation.isPending
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Play className="w-5 h-5" />}
                  {room.participants.length === 0 ? t("challenge_waiting_students") : `${t("challenge_start_game")} (${room.participants.length} joined)`}
                </Button>
              </div>
            </div>

            {/* Instructions card */}
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 text-sm text-yellow-200 space-y-1">
              <p className="font-semibold">{t("challenge_how_join")}</p>
              <ol className="list-decimal list-inside space-y-0.5 text-yellow-200/80">
                <li>{t("challenge_join_step1")} <span className="font-mono">{window.location.origin}/join</span></li>
                <li>{t("challenge_join_step2")} <span className="font-mono font-bold text-yellow-300">{room.roomCode}</span></li>
                <li>{t("challenge_join_step3")}</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Live view ── */}
        {view === "live" && room && (() => {
          const q = room.questions[room.currentQuestion];
          return (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* AINA logo — enlarged for gaming mode */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-yellow-300" />
                  </div>
                  <span className="text-white font-heading font-bold text-lg">AINA</span>
                </div>
                <span className="text-white/70 text-sm">{t("practice_question")} {room.currentQuestion + 1} / {room.questions.length}</span>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Users className="w-4 h-4" />
                  {room.participants.length} {t("challenge_join")}
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
                    {q.options.map((opt, i) => {
                      const isCorrect = room.answerRevealed && i === q.correctIndex;
                      return (
                        <div key={i} className={`border rounded-xl p-3 text-sm transition-all ${
                          isCorrect
                            ? "bg-green-500/30 border-green-400/60 ring-2 ring-green-400/50"
                            : "bg-white/10 border-white/20"
                        } text-white`}>
                          <span className="font-bold text-yellow-300 mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                          {isCorrect && <span className="ml-2 text-green-300 font-bold text-xs">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                  {room.answerRevealed && q.explanation && (
                    <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-3 text-green-200 text-sm">
                      <span className="font-semibold text-green-300">{t("practice_explanation")}: </span>{q.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Live leaderboard */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 space-y-2">
                <h3 className="text-white font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-300" /> {t("challenge_leaderboard")}</h3>
                {room.participants.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-white/80 text-sm">{i + 1}. {p.nickname}</span>
                    <span className="text-yellow-300 font-bold text-sm">{p.score} pts</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                {!room.answerRevealed ? (
                  <Button
                    variant="outline"
                    className="flex-1 border-green-400/50 text-green-300 hover:bg-green-500/10 gap-2 font-semibold"
                    disabled={controlMutation.isPending}
                    onClick={() => controlMutation.mutate({ id: room.id, action: "reveal" })}
                  >
                    <Eye className="w-4 h-4" />
                    {t("challenge_reveal_answer")}
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold gap-2"
                    disabled={controlMutation.isPending}
                    onClick={() => controlMutation.mutate({ id: room.id, action: "next" })}
                  >
                    <SkipForward className="w-4 h-4" />
                    {room.currentQuestion + 1 >= room.questions.length ? t("practice_finish") : t("practice_next")}
                  </Button>
                )}
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
        {view === "results" && !room && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            {roomQuery.isError || (roomQuery.isFetched && roomQuery.data === null) ? (
              <>
                <p className="text-white/70 text-sm">{t("error")}: Could not load results.</p>
                <Button variant="ghost" className="text-white/70 hover:text-white" onClick={() => { setRoomId(null); setView("home"); }}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-yellow-300" />
                <p className="text-white/70 text-sm">Loading results…</p>
              </>
            )}
          </div>
        )}
        {view === "results" && room && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center space-y-2">
              <Trophy className="w-16 h-16 text-yellow-300 mx-auto" />
              <h2 className="text-2xl font-bold text-white">{t("practice_done_title")}</h2>
              <p className="text-white/70">{room.title}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{t("challenge_leaderboard")}</h3>
                <Button
                  variant="outline" size="sm"
                  className="border-white/30 text-white hover:bg-white/10 gap-1.5 text-xs"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5" /> Print Results
                </Button>
              </div>
              {room.participants.length === 0 && <p className="text-white/50 text-sm">{t("my_materials_empty")}</p>}
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

            {/* Questions summary for teacher */}
            <details className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden">
              <summary className="p-4 cursor-pointer text-white font-semibold flex items-center gap-2 hover:bg-white/5">
                <BookOpen className="w-4 h-4 text-yellow-300" /> View All Questions ({room.questions.length})
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {room.questions.map((q, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 space-y-1">
                    <p className="text-white text-sm font-medium">{i + 1}. {q.question}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {q.options.map((opt: string, j: number) => (
                        <p key={j} className={`text-xs px-2 py-1 rounded ${j === q.correctIndex ? "bg-green-400/20 text-green-300" : "text-white/50"}`}>
                          {String.fromCharCode(65 + j)}. {opt}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <div className="flex gap-3 flex-wrap">
              <Button
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold"
                onClick={() => { setView("create"); setTitle(""); setRoomId(null); setSelectedMaterialId(null); }}
              >
                <Plus className="w-4 h-4 mr-2" /> {t("challenge_start")}
              </Button>
              <Button
                variant="outline"
                className="border-teal-400/50 text-teal-300 hover:bg-teal-600/20 bg-transparent"
                onClick={() => setShowSaveDialog(true)}
              >
                <Users className="w-4 h-4 mr-2" /> {t("challenge_save_to_group")}
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 bg-transparent"
                onClick={() => setView("home")}
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> {t("cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Save to Group Dialog ── */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="bg-slate-900 border-white/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">{t("challenge_save_group_dialog_title")}</DialogTitle>
            </DialogHeader>
            <p className="text-white/60 text-sm">{t("challenge_save_group_dialog_desc")}</p>
            {myGroups.isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>
            ) : (myGroups.data?.length ?? 0) === 0 ? (
              <p className="text-white/50 text-sm text-center py-4">{t("challenge_save_group_no_groups")}</p>
            ) : (
              <Select value={saveGroupId} onValueChange={setSaveGroupId}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder={t("challenge_save_group_select")} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/20">
                  <SelectItem value="none" className="text-white/50">{t("challenge_save_group_select")}</SelectItem>
                  {myGroups.data?.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)} className="text-white">
                      {g.className} — {g.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setShowSaveDialog(false)} className="text-white/60 hover:text-white">
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSaveToGroup}
                disabled={saveGroupId === "none" || saveMutation.isPending}
                className="bg-teal-600 hover:bg-teal-500 text-white"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("challenge_save_group_confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
