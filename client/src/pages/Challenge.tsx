import { useState, useEffect, useMemo, useCallback } from "react";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
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
  BarChart2, Check, X as XIcon, History, ChevronDown, ChevronUp, Medal, Search, CalendarRange, FilterX, Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import CompetencySelector from "@/components/CompetencySelector";
import { useI18n } from "@/contexts/I18nContext";
import { exportToCsv, exportToXml } from "@/lib/exportUtils";
import ExportDropdown, { PrintIcon, CsvIcon, XmlIcon } from "@/components/ExportDropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


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
  useDocumentTitle("Repte LOMLOE · SEBA AI");

  const { user, loading, isAuthenticated } = useAuth();

  // Read query params for deep-linking from MyMaterials / MaterialView
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlMaterialId = urlParams.get("materialId") ? parseInt(urlParams.get("materialId")!, 10) : null;
  const urlMaterialTitle = urlParams.get("materialTitle") ? decodeURIComponent(urlParams.get("materialTitle")!) : "";

  const [view, setView] = useState<"home" | "create" | "lobby" | "live" | "results">(urlMaterialId ? "create" : "home");
  const [homeTab, setHomeTab] = useState<"sessions" | "history">("sessions");
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyGroupFilter, setHistoryGroupFilter] = useState("all");
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

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const deleteRoomMutation = trpc.challenge.deleteRoom.useMutation({
    onSuccess: () => {
      myRooms.refetch();
      toast.success(t("challenge_room_deleted"));
      setDeleteConfirmId(null);
    },
    onError: (e) => { toast.error(e.message); setDeleteConfirmId(null); },
  });

  // Enable polling immediately when roomId is set so the lobby never shows blank
  const isInRoomView = view === "lobby" || view === "live";
  const roomQuery = trpc.challenge.getRoom.useQuery(
    { id: roomId ?? 0 },
    { enabled: roomId !== null && roomId > 0, refetchInterval: isInRoomView ? 2000 : false }
  );

  const myRooms = trpc.challenge.myRooms.useQuery(undefined, { enabled: isAuthenticated });
  const sessionHistory = trpc.challenge.getSessionHistory.useQuery(undefined, { enabled: isAuthenticated && homeTab === "history" });
  const myMaterials = trpc.materials.list.useQuery(undefined, { enabled: isAuthenticated && view === "create" });

  // Client-side filtering for the History tab
  const uniqueYearGroups = useMemo(() => {
    if (!sessionHistory.data) return [];
    const seen = new Set<string>();
    sessionHistory.data.forEach((s) => { if (s.yearGroup) seen.add(s.yearGroup); });
    return Array.from(seen).sort();
  }, [sessionHistory.data]);

  const filteredHistory = useMemo(() => {
    if (!sessionHistory.data) return [];
    const q = historySearch.trim().toLowerCase();
    const from = historyDateFrom ? new Date(historyDateFrom).getTime() : null;
    const to = historyDateTo ? new Date(historyDateTo + "T23:59:59").getTime() : null;
    return sessionHistory.data.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q) && !(s.competency ?? "").toLowerCase().includes(q)) return false;
      const ts = new Date(s.createdAt).getTime();
      if (from && ts < from) return false;
      if (to && ts > to) return false;
      if (historyGroupFilter !== "all" && s.yearGroup !== historyGroupFilter) return false;
      return true;
    });
  }, [sessionHistory.data, historySearch, historyDateFrom, historyDateTo, historyGroupFilter]);

  const hasHistoryFilter = historySearch !== "" || historyDateFrom !== "" || historyDateTo !== "" || historyGroupFilter !== "all";

  // Detect if this is a PARAULA live room
  const isParaulaRoom = !!(roomQuery.data && (() => {
    try {
      const q = roomQuery.data.questions as unknown as Array<{ type?: string }>;
      return Array.isArray(q) && q[0]?.type === "paraula_live";
    } catch { return false; }
  })());

  const paraulaRoomQuery = trpc.challenge.getParaulaRoom.useQuery(
    { challengeId: roomId ?? 0 },
    { enabled: !!roomId && isParaulaRoom && (view === "lobby" || view === "live"), refetchInterval: 3000 }
  );

  const finishParaulaRoomMutation = trpc.challenge.finishParaulaRoom.useMutation({
    onSuccess: () => { roomQuery.refetch(); setView("results"); },
    onError: (e) => toast.error(e.message),
  });

  // Multi-round: next word picker state
  const [showNextWordDialog, setShowNextWordDialog] = useState(false);
  const [nextWordIdx, setNextWordIdx] = useState(0);
  const [nextWordSearch, setNextWordSearch] = useState("");
  const nextParaulaRoundMutation = trpc.challenge.nextParaulaRound.useMutation({
    onSuccess: (data) => {
      toast.success(`${t("challenge_round")} ${data.round}: ${data.word}`);
      setShowNextWordDialog(false);
      roomQuery.refetch();
      paraulaRoomQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

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
  const deleteParticipantMut = trpc.challenge.deleteParticipant.useMutation({
    onSuccess: () => { roomQuery.refetch(); toast.success("Participant removed"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveToGroup = useCallback(() => {
    const r = roomQuery.data;
    if (!r || !roomId || saveGroupId === "none") return;
    // Detect PARAULA room
    const isParaulaForSave = (() => {
      try {
        const q = r.questions as unknown as Array<{ type?: string }>;
        return Array.isArray(q) && q[0]?.type === "paraula_live";
      } catch { return false; }
    })();
    saveMutation.mutate({
      groupId: parseInt(saveGroupId, 10),
      challengeId: roomId,
      challengeTitle: r.title,
      competency: r.competency ?? undefined,
      participants: r.participants.map((p) => ({
        nickname: p.nickname,
        // For PARAULA: score = guesses used (lower = better). Invert so higher = better for % calc.
        // score 1 guess → 5/6 = 83%, 6 guesses → 0/6 = 0%, 0 (failed) → 0
        score: isParaulaForSave ? (p.score > 0 ? Math.max(0, 7 - p.score) : 0) : p.score,
        total: isParaulaForSave ? 6 : r.questions.length,
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
            <BackButton variant="ghost" label={t("btn_back")} />
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

            {/* Tab switcher: Sessions / History */}
            <div className="flex rounded-xl overflow-hidden border border-white/20 max-w-sm mx-auto">
              {([
                { key: "sessions", label: t("challenge_tab_sessions"), icon: Zap },
                { key: "history", label: t("challenge_tab_history"), icon: History },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setHomeTab(key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                    homeTab === key ? "bg-yellow-400/30 text-yellow-200" : "text-white/60 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            {/* ── Sessions sub-tab ── */}
            {homeTab === "sessions" && (
              <>
                    {myRooms.data && myRooms.data.length > 0 ? (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-white/90">{t("challenge_leaderboard")}</h2>
                    <div className="grid gap-3">
                      {myRooms.data.slice(0, 6).map((r) => (
                        <div
                          key={r.id}
                          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-colors"
                          onClick={() => { setRoomId(r.id); setView(r.status === "finished" ? "results" : "lobby"); }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white truncate">{r.title}</p>
                            <p className="text-sm text-white/60">{t("challenge_room_code")}: <span className="font-mono font-bold text-yellow-300">{r.roomCode}</span></p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            <Badge className={r.status === "finished" ? "bg-gray-500" : r.status === "active" ? "bg-green-500" : "bg-yellow-500"}>
                              {r.status}
                            </Badge>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(r.id); }}
                              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                              title={t("challenge_delete_room")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-white/50">
                    <Zap className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>{t("challenge_no_sessions")}</p>
                  </div>
                )}
              </>
            )}

            {/* ── History sub-tab ── */}
            {homeTab === "history" && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white/90">{t("challenge_tab_history")}</h2>

                {/* Search + date-range filter bar */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                    <Input
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder={t("challenge_history_search_ph")}
                      className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-yellow-400/60"
                    />
                  </div>
                  {/* Group filter */}
                  {uniqueYearGroups.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-white/40 flex-shrink-0" />
                      <Select value={historyGroupFilter} onValueChange={setHistoryGroupFilter}>
                        <SelectTrigger className="flex-1 bg-white/10 border-white/20 text-white/80 focus:border-yellow-400/60 h-9">
                          <SelectValue placeholder={t("challenge_history_all_groups")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("challenge_history_all_groups")}</SelectItem>
                          {uniqueYearGroups.map((yg) => (
                            <SelectItem key={yg} value={yg}>{yg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <CalendarRange className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <input
                      type="date"
                      value={historyDateFrom}
                      onChange={(e) => setHistoryDateFrom(e.target.value)}
                      className="flex-1 min-w-[130px] bg-white/10 border border-white/20 rounded-md px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-yellow-400/60"
                    />
                    <span className="text-white/40 text-sm">{t("challenge_history_date_to")}</span>
                    <input
                      type="date"
                      value={historyDateTo}
                      onChange={(e) => setHistoryDateTo(e.target.value)}
                      className="flex-1 min-w-[130px] bg-white/10 border border-white/20 rounded-md px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-yellow-400/60"
                    />
                    {hasHistoryFilter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setHistorySearch(""); setHistoryDateFrom(""); setHistoryDateTo(""); setHistoryGroupFilter("all"); }}
                        className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5 flex-shrink-0"
                      >
                        <FilterX className="w-3.5 h-3.5" /> {t("challenge_history_clear")}
                      </Button>
                    )}
                  </div>
                </div>

                {sessionHistory.isLoading && (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-yellow-300" />
                  </div>
                )}
                {!sessionHistory.isLoading && (!sessionHistory.data || sessionHistory.data.length === 0) && (
                  <div className="text-center py-10 text-white/50">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>{t("challenge_history_empty")}</p>
                  </div>
                )}
                {!sessionHistory.isLoading && sessionHistory.data && sessionHistory.data.length > 0 && filteredHistory.length === 0 && (
                  <div className="text-center py-10 text-white/50">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>{t("challenge_history_no_results")}</p>
                  </div>
                )}
                {filteredHistory.length > 0 && (
                  <>
                    <p className="text-xs text-white/40">{filteredHistory.length} {t("challenge_history_result_count")}</p>
                    <div className="grid gap-3">
                    {filteredHistory.map((session) => {
                      const isExpanded = expandedSession === session.id;
                      const top3 = session.participants.slice(0, 3);
                      const medalColors = ["text-yellow-300", "text-gray-300", "text-amber-600"];
                      return (
                        <div key={session.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden">
                          {/* Session header row */}
                          <button
                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                            onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white truncate">{session.title}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                <span className="text-xs text-white/50 font-mono">{session.roomCode}</span>
                                <span className="text-xs text-white/50">{new Date(session.createdAt).toLocaleDateString()}</span>
                                <span className="text-xs text-white/50">{session.questionCount} {t("challenge_questions_label")}</span>
                                <span className="text-xs text-white/50">{session.participants.length} {t("challenge_participants_label")}</span>
                                {session.competency && (
                                  <Badge className="text-xs bg-yellow-400/20 text-yellow-300 border-yellow-400/30">{session.competency}</Badge>
                                )}
                              </div>
                              {/* Top 3 mini-leaderboard preview */}
                              {top3.length > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                  {top3.map((p, i) => (
                                    <span key={p.id} className={`text-xs font-medium flex items-center gap-1 ${medalColors[i]}`}>
                                      <Medal className="w-3 h-3" />{p.nickname} ({p.score}/{session.questionCount})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="ml-3 flex-shrink-0 text-white/50">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </button>

                          {/* Expanded full leaderboard */}
                          {isExpanded && (
                            <div className="border-t border-white/10 px-4 pb-4">
                              <div className="flex items-center justify-between mt-3 mb-2">
                                <h3 className="text-sm font-semibold text-white/80">{t("challenge_leaderboard")}</h3>
                                {session.participants.length > 0 && (
                                  <button
                                    onClick={() => {
                                      const rows = session.participants.map((p, i) => ({
                                        [t("challenge_history_rank")]: i + 1,
                                        [t("challenge_history_student")]: p.nickname,
                                        [t("challenge_history_score")]: p.score,
                                        [t("challenge_history_correct")]: p.score,
                                        [t("challenge_history_total")]: session.questionCount,
                                      }));
                                      const header = Object.keys(rows[0]).join(",");
                                      const body = rows.map(r => Object.values(r).join(",")).join("\n");
                                      const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `seba-classroom-${session.roomCode}-${new Date(session.createdAt).toISOString().slice(0, 10)}.csv`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="flex items-center gap-1.5 text-xs text-yellow-300 hover:text-yellow-200 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 rounded-lg px-2.5 py-1.5 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    {t("challenge_history_export_csv")}
                                  </button>
                                )}
                              </div>
                              {session.participants.length === 0 ? (
                                <p className="text-sm text-white/40">{t("challenge_no_participants")}</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {session.participants.map((p, i) => (
                                    <div key={p.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                                      <span className={`text-sm font-bold w-5 text-center ${i < 3 ? medalColors[i] : "text-white/40"}`}>{i + 1}</span>
                                      <span className="flex-1 text-sm text-white font-medium truncate">{p.nickname}</span>
                                      <span className="text-sm font-bold text-yellow-300">{p.score}<span className="text-white/40 font-normal">/{session.questionCount}</span></span>
                                      <div className="w-20 bg-white/10 rounded-full h-1.5">
                                        <div
                                          className="bg-yellow-400 h-1.5 rounded-full transition-all"
                                          style={{ width: `${session.questionCount > 0 ? Math.round((p.score / session.questionCount) * 100) : 0}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Create view ── */}
        {view === "create" && (
          <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-24">
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

            </div>

            {/* Sticky submit button — always visible */}
            <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3 bg-gradient-to-t from-black/60 to-transparent">
              <div className="max-w-2xl mx-auto">
                <Button
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-base py-3 h-auto"
                  disabled={!canCreate}
                  onClick={handleCreate}
                  type="button"
                >
                  {isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("create_generating")}</>
                    : t("challenge_start")}
                </Button>
              </div>
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
        {view === "lobby" && room && isParaulaRoom && (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={() => { setRoomId(null); setView("home"); }} className="flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="size-4" />{t("btn_back")}
            </Button>
            {/* PARAULA Live Lobby Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 bg-orange-400/20 text-orange-300 border border-orange-400/30 rounded-full px-4 py-1.5 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse inline-block" />
                <span className="font-black tracking-widest">PARAULA</span> Live — Waiting for students
              </div>
              <h2 className="text-2xl font-bold text-white">{room.title}</h2>
              {paraulaRoomQuery.data?.clue && (
                <p className="text-white/60 text-sm">Word clue: <span className="text-orange-300 font-semibold">{paraulaRoomQuery.data.clue}</span></p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Room code + QR */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex flex-col items-center gap-4">
                <div className="space-y-1 text-center">
                  <p className="text-white/60 text-xs uppercase tracking-widest font-semibold">Room Code</p>
                  <p className="text-5xl font-mono font-black text-orange-300 tracking-widest">{room.roomCode}</p>
                </div>
                <div className="bg-white rounded-xl p-3">
                  <QRCodeSVG value={joinUrl} size={140} />
                </div>
                <p className="text-white/50 text-xs text-center">Scan to join or visit</p>
                <p className="text-orange-200 text-xs font-mono break-all text-center">{window.location.origin}/join</p>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" size="sm" className="flex-1 border-white/30 text-white hover:bg-white/10 gap-1.5 text-xs"
                    onClick={() => { navigator.clipboard.writeText(room.roomCode); toast.success(t("challenge_room_copied")); }}>
                    <Copy className="w-3.5 h-3.5" /> Code
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 border-white/30 text-white hover:bg-white/10 gap-1.5 text-xs"
                    onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success(t("challenge_link_copied")); }}>
                    <Link2 className="w-3.5 h-3.5" /> Link
                  </Button>
                </div>
              </div>

              {/* Participants panel */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Users className="w-5 h-5 text-orange-300" />
                    <span className="font-semibold">{t("challenge_students_joined")}</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-300">{room.participants.length}</span>
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
                        <span key={p.id} className={`text-sm px-3 py-1 rounded-full font-medium transition-all duration-500 ${
                          newlyJoined.has(p.id) ? "bg-orange-400 text-black scale-110" : "bg-white/20 text-white"
                        }`}>{p.nickname}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="lg"
                  className={`w-full font-bold gap-2 transition-all ${
                    room.participants.length > 0 ? "bg-orange-500 hover:bg-orange-400 text-white" : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                  disabled={room.participants.length === 0 || controlMutation.isPending}
                  onClick={() => controlMutation.mutate({ id: room.id, action: "start" })}
                >
                  {controlMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  {room.participants.length === 0 ? t("challenge_waiting_students") : `${t("challenge_start_game")} (${room.participants.length} ${t("challenge_joined_count")})`}
                </Button>
              </div>
            </div>

            <div className="bg-orange-400/10 border border-orange-400/20 rounded-xl p-4 text-sm text-orange-200 space-y-1">
              <p className="font-semibold">{t("challenge_how_to_join")}</p>
              <ol className="list-decimal list-inside space-y-0.5 text-orange-200/80">
                <li>{t("challenge_go_to")} <span className="font-mono">{window.location.origin}/join</span></li>
                <li>{t("challenge_enter_code")} <span className="font-mono font-bold text-orange-300">{room.roomCode}</span></li>
                <li>{t("challenge_enter_name_wait")}</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── PARAULA Live view (teacher sees live leaderboard) ── */}
        {view === "live" && room && isParaulaRoom && (() => {
          const pr = paraulaRoomQuery.data;
          const sorted = [...room.participants].sort((a, b) => {
            // Sort by guesses ascending (fewer = better), unsolved last
            const aGuesses = a.score > 0 ? a.score : 999;
            const bGuesses = b.score > 0 ? b.score : 999;
            return aGuesses - bGuesses;
          });
          const finished = sorted.filter((p) => p.score > 0).length;
          return (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 bg-orange-400/20 text-orange-300 border border-orange-400/30 rounded-full px-4 py-1.5 text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse inline-block" />
                  <span className="font-black tracking-widest">PARAULA</span> Live — Game in progress
                </div>
                <h2 className="text-2xl font-bold text-white">{room.title}</h2>
                {pr?.clue && <p className="text-white/60 text-sm">Clue: <span className="text-orange-300 font-semibold">{pr.clue}</span></p>}
              </div>

              {/* Progress */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Trophy className="w-5 h-5 text-orange-300" />
                    <span className="font-semibold">Live Leaderboard</span>
                  </div>
                  <span className="text-sm text-white/60">{finished} / {room.participants.length} finished</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="bg-orange-400 h-2 rounded-full transition-all" style={{ width: `${room.participants.length > 0 ? (finished / room.participants.length) * 100 : 0}%` }} />
                </div>
                <div className="space-y-2">
                  {sorted.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-3 rounded-xl p-3 ${
                      i === 0 && p.score > 0 ? "bg-orange-400/20 border border-orange-400/30" : "bg-white/5"
                    }`}>
                      <span className="text-xl w-7 text-center">
                        {i === 0 && p.score > 0 ? "🥇" : i === 1 && p.score > 0 ? "🥈" : i === 2 && p.score > 0 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span className="flex-1 text-white font-medium">{p.nickname}</span>
                      {p.score > 0 ? (
                        <span className="text-orange-300 font-bold text-sm">{p.score} guess{p.score !== 1 ? "es" : ""}</span>
                      ) : (
                        <span className="text-white/30 text-sm">playing…</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2"
                  onClick={() => setShowNextWordDialog(true)}
                >
                  <Play className="w-4 h-4" /> Next Word
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold gap-2"
                  disabled={finishParaulaRoomMutation.isPending}
                  onClick={() => finishParaulaRoomMutation.mutate({ challengeId: room.id })}
                >
                  {finishParaulaRoomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                  End Game
                </Button>
              </div>

              {/* Round indicator */}
              {pr?.round && pr.round > 1 && (
                <div className="text-center">
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-400/40">Round {pr.round}</Badge>
                </div>
              )}

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-white/50 text-xs">Room code: <span className="font-mono font-bold text-orange-300">{room.roomCode}</span></p>
              </div>
            </div>
          );
        })()}

        {/* ── Lobby view (MCQ rooms) ── */}
        {view === "lobby" && room && !isParaulaRoom && (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={() => { setRoomId(null); setView("home"); }} className="flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="size-4" />{t("btn_back")}
            </Button>
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
                  {room.participants.length === 0 ? t("challenge_waiting_students") : `${t("challenge_start_game")} (${room.participants.length} ${t("challenge_joined_count")})`}
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

        {/* ── Live view (MCQ rooms only) ── */}
        {view === "live" && room && !isParaulaRoom && (() => {
          const q = room.questions[room.currentQuestion];
          return (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Back button */}
              <Button variant="ghost" size="sm" onClick={() => { setRoomId(null); setView("home"); }} className="flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
                <ArrowLeft className="size-4" />{t("btn_back")}
              </Button>
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
        {view === "results" && room && (() => {
          const isParaulaResults = isParaulaRoom;
          const sortedParticipants = isParaulaResults
            ? [...room.participants].sort((a, b) => {
                const aG = a.score > 0 ? a.score : 999;
                const bG = b.score > 0 ? b.score : 999;
                return aG - bG;
              })
            : [...room.participants].sort((a, b) => b.score - a.score);
          return (
          <div className="max-w-lg mx-auto space-y-6">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={() => { setRoomId(null); setView("home"); }} className="flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="size-4" />{t("btn_back")}
            </Button>
            <div className="text-center space-y-2">
              <Trophy className={`w-16 h-16 mx-auto ${isParaulaResults ? "text-orange-300" : "text-yellow-300"}`} />
              {isParaulaResults && <p className="font-black tracking-widest text-orange-300 text-xl">PARAULA</p>}
              <h2 className="text-2xl font-bold text-white">{t("practice_done_title")}</h2>
              <p className="text-white/70">{room.title}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{t("challenge_leaderboard")}</h3>
                <ExportDropdown
                  size="sm"
                  className="border-white/30 text-white hover:bg-white/10 bg-transparent"
                  options={[
                    {
                      key: "print",
                      icon: <PrintIcon />,
                      label: t("material_print"),
                      onClick: () => window.print(),
                    },
                    {
                      key: "csv",
                      icon: <CsvIcon />,
                      label: t("export_csv"),
                      separator: true,
                      onClick: () => {
                        const rows = sortedParticipants.map((p, i) => ({
                          rank: i + 1,
                          name: p.nickname,
                          score: p.score,
                        }));
                        exportToCsv(room.title || "results", rows);
                      },
                    },
                    {
                      key: "xml",
                      icon: <XmlIcon />,
                      label: t("export_xml"),
                      onClick: () => {
                        const rows = sortedParticipants.map((p, i) => ({
                          rank: i + 1,
                          name: p.nickname,
                          score: p.score,
                        }));
                        exportToXml(room.title || "results", "results", rows, "participant");
                      },
                    },
                  ]}
                />
              </div>
              {sortedParticipants.length === 0 && <p className="text-white/50 text-sm">{t("my_materials_empty")}</p>}
              {sortedParticipants.map((p, i) => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? (isParaulaResults ? "bg-orange-400/20 border border-orange-400/30" : "bg-yellow-400/20 border border-yellow-400/30") : "bg-white/5"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                    <span className="text-white font-medium">{p.nickname}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isParaulaResults ? (
                      <span className="text-orange-300 font-bold">{p.score > 0 ? `${p.score} guess${p.score !== 1 ? "es" : ""}` : "—"}</span>
                    ) : (
                      <span className="text-yellow-300 font-bold">{p.score} / {room.questions.length}</span>
                    )}
                    <button
                      title="Remove from leaderboard"
                      className="ml-1 p-1 rounded hover:bg-red-500/30 text-white/40 hover:text-red-300 transition-colors"
                      onClick={() => {
                        if (confirm(`Remove "${p.nickname}" from the leaderboard?`)) {
                          deleteParticipantMut.mutate({ participantId: p.id, challengeId: room.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

            {/* Per-question breakdown — only for quiz challenges with participant answer data */}
            {!isParaulaResults && room.participants.some(p => p.answers) && (() => {
              // Build per-question stats: for each question, how many got it right and each student's answer
              const breakdown = room.questions.map((q, qi) => {
                const studentRows = sortedParticipants.map(p => {
                  const answers: number[] = (() => { try { return JSON.parse(p.answers ?? "[]"); } catch { return []; } })();
                  const chosen = answers[qi] ?? null;
                  const correct = chosen !== null && chosen === q.correctIndex;
                  return { name: p.nickname, chosen, correct };
                });
                const correctCount = studentRows.filter(r => r.correct).length;
                return { question: q.question, correctAnswer: q.options[q.correctIndex] ?? "", correctIndex: q.correctIndex, options: q.options, correctCount, total: sortedParticipants.length, studentRows };
              });

              const handleBreakdownCsv = () => {
                // Header row: Question, Correct Answer, then one column per student
                const headers = ["Question", "Correct Answer", ...sortedParticipants.map(p => p.nickname)];
                const rows = breakdown.map(b => ({
                  Question: b.question,
                  "Correct Answer": b.correctAnswer,
                  ...Object.fromEntries(b.studentRows.map(r => [
                    r.name,
                    r.chosen !== null ? `${String.fromCharCode(65 + r.chosen)}. ${b.options[r.chosen] ?? ""} (${r.correct ? t("challenge_breakdown_correct") : t("challenge_breakdown_wrong")})`  : "—",
                  ])),
                }));
                exportToCsv(`${room.title || "challenge"}-breakdown`, rows);
              };

              return (
                <details className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden">
                  <summary className="p-4 cursor-pointer text-white font-semibold flex items-center justify-between gap-2 hover:bg-white/5">
                    <span className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-teal-300" />
                      {t("challenge_breakdown_title")}
                    </span>
                    <button
                      className="flex items-center gap-1.5 text-xs text-teal-300 border border-teal-400/40 rounded-lg px-2 py-1 hover:bg-teal-400/10 transition-colors"
                      onClick={e => { e.preventDefault(); handleBreakdownCsv(); }}
                    >
                      <CsvIcon /> {t("challenge_breakdown_csv")}
                    </button>
                  </summary>
                  <div className="px-4 pb-4 space-y-3 overflow-x-auto">
                    <table className="w-full text-xs text-white/80 border-collapse min-w-[480px]">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 pr-3 text-white/50 font-medium w-8">#</th>
                          <th className="text-left py-2 pr-3 text-white/50 font-medium">Question</th>
                          <th className="text-left py-2 pr-3 text-green-300/70 font-medium">✓ Answer</th>
                          <th className="text-center py-2 pr-3 text-yellow-300/70 font-medium">%</th>
                          {sortedParticipants.map(p => (
                            <th key={p.id} className="text-center py-2 px-1 text-white/50 font-medium max-w-[80px] truncate">{p.nickname}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((b, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2 pr-3 text-white/30">{i + 1}</td>
                            <td className="py-2 pr-3 max-w-[200px]">
                              <span className="line-clamp-2">{b.question}</span>
                            </td>
                            <td className="py-2 pr-3 text-green-300">{b.correctAnswer}</td>
                            <td className="py-2 pr-3 text-center">
                              <span className={`font-bold ${
                                b.total > 0 && b.correctCount / b.total >= 0.7 ? "text-green-300" :
                                b.total > 0 && b.correctCount / b.total >= 0.4 ? "text-yellow-300" : "text-red-300"
                              }`}>
                                {b.total > 0 ? Math.round((b.correctCount / b.total) * 100) : 0}%
                              </span>
                            </td>
                            {b.studentRows.map((r, si) => (
                              <td key={si} className="text-center py-2 px-1">
                                {r.chosen !== null ? (
                                  r.correct
                                    ? <Check className="w-3.5 h-3.5 text-green-400 mx-auto" />
                                    : <XIcon className="w-3.5 h-3.5 text-red-400 mx-auto" />
                                ) : <span className="text-white/20">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })()}

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
          );
        })()}

        {/* ── Next Word Dialog (PARAULA multi-round) ── */}
        {isParaulaRoom && roomId && (() => {
          // Get material word list from the room's linked material
          const materialId = (() => {
            try {
              const q = roomQuery.data?.questions as unknown as Array<{ materialId?: number }>;
              return q?.[0]?.materialId ?? null;
            } catch { return null; }
          })();
          // We need the material words — use the myMaterials list to find it
          const materialWords = (() => {
            const mat = myMaterials.data?.find((m) => m.id === materialId);
            if (!mat) return [];
            try {
              const c = JSON.parse((mat as unknown as { content: string }).content) as { words?: string[]; clues?: string[] };
              return (c.words ?? []).map((w, i) => ({ word: w.toUpperCase(), clue: c.clues?.[i] ?? "" }));
            } catch { return []; }
          })();
          return (
            <Dialog open={showNextWordDialog} onOpenChange={setShowNextWordDialog}>
              <DialogContent className="bg-slate-900 border-white/20 text-white max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <span className="font-black tracking-widest text-orange-400">PARAULA</span> Next Word
                  </DialogTitle>
                </DialogHeader>
                <p className="text-white/60 text-sm">Pick the next word for students to guess.</p>
                {materialWords.length > 0 ? (
                  <>
                    <input
                      type="text"
                      value={nextWordSearch}
                      onChange={e => setNextWordSearch(e.target.value)}
                      placeholder="Search words or clues…"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-orange-400/60"
                    />
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {materialWords.filter(p =>
                        !nextWordSearch.trim() ||
                        p.word.toUpperCase().includes(nextWordSearch.toUpperCase()) ||
                        p.clue.toLowerCase().includes(nextWordSearch.toLowerCase())
                      ).map((p, _filteredIdx) => {
                        const i = materialWords.indexOf(p);
                        const isValid = p.word.replace(/\s/g, "").length === 5;
                        return (
                          <button
                            key={i}
                            onClick={() => setNextWordIdx(i)}
                            className={`flex flex-col items-start p-2 rounded-lg border text-left transition-colors ${
                              nextWordIdx === i
                                ? "border-orange-500 bg-orange-500/10"
                                : isValid
                                  ? "border-white/20 hover:border-orange-400"
                                  : "border-red-500/40 hover:border-red-400 opacity-70"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 w-full">
                              <span className="font-mono font-bold text-orange-300 text-sm tracking-wider">{p.word}</span>
                              {!isValid && (
                                <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 border border-red-500/40 rounded px-1 py-0.5 font-semibold shrink-0">
                                  {p.word.replace(/\s/g, "").length}L
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-white/50 truncate w-full">{p.clue}</span>
                          </button>
                        );
                      })}
                    </div>
                    {materialWords[nextWordIdx] && materialWords[nextWordIdx].word.replace(/\s/g, "").length !== 5 && (
                      <p className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                        ⚠️ "{materialWords[nextWordIdx].word}" is {materialWords[nextWordIdx].word.replace(/\s/g, "").length} letters. PARAULA requires exactly 5 letters.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-white/40 text-sm text-center py-4">Loading word list…</p>
                )}
                <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={() => setShowNextWordDialog(false)} className="text-white/60 hover:text-white">
                    Cancel
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40"
                    disabled={
                      nextParaulaRoundMutation.isPending ||
                      materialWords.length === 0 ||
                      (materialWords[nextWordIdx]?.word.replace(/\s/g, "").length ?? 0) !== 5
                    }
                    title={
                      (materialWords[nextWordIdx]?.word.replace(/\s/g, "").length ?? 0) !== 5
                        ? "Selected word must be exactly 5 letters"
                        : undefined
                    }
                    onClick={() => nextParaulaRoundMutation.mutate({ challengeId: roomId, wordIndex: nextWordIdx })}
                  >
                    {nextParaulaRoundMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    Start Round
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}

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

        {/* ── Delete room confirmation dialog ── */}
        <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
          <DialogContent className="bg-slate-900 border-white/20 text-white">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                {t("challenge_delete_room")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-white/70 text-sm">{t("challenge_delete_room_confirm")}</p>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="text-white/60 hover:text-white">
                {t("cancel")}
              </Button>
              <Button
                onClick={() => deleteConfirmId !== null && deleteRoomMutation.mutate({ challengeId: deleteConfirmId })}
                disabled={deleteRoomMutation.isPending}
                className="bg-red-600 hover:bg-red-500 text-white gap-2"
              >
                {deleteRoomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t("challenge_delete_room_confirm_btn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
