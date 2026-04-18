import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import { cn } from "@/lib/utils";
import {
  Hash, MessageSquare, Users, Send, Search,
  ChevronLeft, Circle, ArrowLeft, Wifi, WifiOff,
  SmilePlus, MoreVertical, Bell, Settings, Mic, MicOff,
  Pin, PinOff, Reply, Paperclip, FileText, Image as ImageIcon,
  Download, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


const HERO_BG =
  "/manus-storage/hero-bg_a767782c.jpg";

// ─── types ────────────────────────────────────────────────────────────────────

type Channel = { id: number; name: string; description: string | null; emoji: string; createdAt: Date };
type ChatMessage = { id: number; channelId?: number; userId: number; userName: string; body: string; originalBody?: string; createdAt: Date; messageType?: string; audioUrl?: string | null; };
type DmMessage = { id: number; fromUserId: number; toUserId: number; fromName: string; body: string; read: boolean; createdAt: Date; isMine: boolean; messageType?: string; audioUrl?: string | null; };
type UserEntry = { id: number; name: string; online: boolean; lastSeen: Date | null };
type Conversation = { otherId: number; otherName: string; lastBody: string; lastAt: Date; unread: number };

type View = "channel" | "dm";

// ─── helpers ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = "md", online }: { name: string; size?: "sm" | "md" | "lg"; online?: boolean }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colours = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500",
    "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-pink-500",
  ];
  const colour = colours[name.charCodeAt(0) % colours.length];
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-11 h-11 text-base" : "w-9 h-9 text-sm";
  return (
    <div className="relative flex-shrink-0">
      <div className={cn("rounded-full flex items-center justify-center font-bold text-white", colour, sz)}>
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white",
            online ? "bg-emerald-400" : "bg-gray-300"
          )}
        />
      )}
    </div>
  );
}

function useFormatTime() {
  const { t } = useI18n();
  useDocumentTitle("Fòrum · SEBA AI Aina");

  return function formatTime(date: Date | string) {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return t("forum_time_just_now");
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}${t("forum_time_minutes_ago")}`;
    if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t("forum_time_yesterday");
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Forum() {
  const { t, lang } = useI18n();
  const formatTime = useFormatTime();
  const { user } = useAuth();

  // sidebar state
  const [view, setView] = useState<View>("channel");
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeDmUserId, setActiveDmUserId] = useState<number | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [showUserList, setShowUserList] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  // message input
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // voice recording
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // polling timestamps
  const [channelSince, setChannelSince] = useState<number | undefined>(undefined);
  const [dmSince, setDmSince] = useState<number | undefined>(undefined);

  // new feature state
  const [channelTab, setChannelTab] = useState<"messages" | "files">("messages");
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [threadMsgId, setThreadMsgId] = useState<number | null>(null);
  const [threadInput, setThreadInput] = useState("");
  const [showPinned, setShowPinned] = useState(false);
  const [fileUploadRef] = useState(() => ({ current: null as HTMLInputElement | null }));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── queries ───────────────────────────────────────────────────────────────

  const channelsQ = trpc.forum.getChannels.useQuery(undefined, { refetchInterval: 30_000 });
  const usersQ = trpc.forum.getUsers.useQuery(undefined, { refetchInterval: 15_000 });
  const conversationsQ = trpc.forum.getConversations.useQuery(undefined, { refetchInterval: 5_000 });
  const unreadQ = trpc.forum.getUnreadCount.useQuery(undefined, { refetchInterval: 5_000 });

  const channelMessagesQ = trpc.forum.getMessages.useQuery(
    { channelId: activeChannelId ?? 0, lang },
    { enabled: view === "channel" && activeChannelId !== null, refetchInterval: 2_000 }
  );

  const messageIds = useMemo(() => (channelMessagesQ.data ?? []).map(m => m.id), [channelMessagesQ.data]);
  const reactionsQ = trpc.forum.getReactions.useQuery(
    { messageIds },
    { enabled: view === "channel" && messageIds.length > 0, refetchInterval: 5_000 }
  );
  const replyCountQ = trpc.forum.getReplyCount.useQuery(
    { messageIds },
    { enabled: view === "channel" && messageIds.length > 0, refetchInterval: 5_000 }
  );
  const pinnedQ = trpc.forum.getPinnedMessages.useQuery(
    { channelId: activeChannelId ?? 0 },
    { enabled: view === "channel" && activeChannelId !== null, refetchInterval: 10_000 }
  );
  const channelFilesQ = trpc.forum.getChannelFiles.useQuery(
    { channelId: activeChannelId ?? 0 },
    { enabled: view === "channel" && activeChannelId !== null && channelTab === "files", refetchInterval: 10_000 }
  );
  const threadRepliesQ = trpc.forum.getThreadReplies.useQuery(
    { parentMessageId: threadMsgId ?? 0, lang },
    { enabled: threadMsgId !== null, refetchInterval: 3_000 }
  );

  const dmMessagesQ = trpc.forum.getDirectMessages.useQuery(
    { withUserId: activeDmUserId ?? 0, lang },
    { enabled: view === "dm" && activeDmUserId !== null, refetchInterval: 2_000 }
  );

  // ─── mutations ─────────────────────────────────────────────────────────────

  const utils = trpc.useUtils();
  const sendMessageMut = trpc.forum.sendMessage.useMutation({
    onSuccess: () => utils.forum.getMessages.invalidate(),
  });
  const sendDmMut = trpc.forum.sendDirectMessage.useMutation({
    onSuccess: () => {
      utils.forum.getDirectMessages.invalidate();
      utils.forum.getConversations.invalidate();
    },
  });
  const pingMut = trpc.forum.ping.useMutation();
  const toggleReactionMut = trpc.forum.toggleReaction.useMutation({
    onSuccess: () => utils.forum.getReactions.invalidate(),
  });
  const pinMut = trpc.forum.pinMessage.useMutation({
    onSuccess: () => utils.forum.getPinnedMessages.invalidate(),
  });
  const uploadFileMut = trpc.forum.uploadChannelFile.useMutation({
    onSuccess: () => utils.forum.getChannelFiles.invalidate(),
  });
  const postReplyMut = trpc.forum.postThreadReply.useMutation({
    onSuccess: () => utils.forum.getThreadReplies.invalidate(),
  });
  const sendVoiceMut = trpc.forum.sendVoiceMessage.useMutation({
    onSuccess: () => utils.forum.getMessages.invalidate(),
  });
  const sendVoiceDmMut = trpc.forum.sendVoiceDm.useMutation({
    onSuccess: () => {
      utils.forum.getDirectMessages.invalidate();
      utils.forum.getConversations.invalidate();
    },
  });

  // ─── effects ───────────────────────────────────────────────────────────────

  // Auto-select first channel
  useEffect(() => {
    if (channelsQ.data && channelsQ.data.length > 0 && activeChannelId === null) {
      setActiveChannelId(channelsQ.data[0].id);
    }
  }, [channelsQ.data, activeChannelId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessagesQ.data, dmMessagesQ.data]);

  // Heartbeat ping every 30s
  useEffect(() => {
    const interval = setInterval(() => pingMut.mutate(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // ─── handlers ──────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    setInput("");
    try {
      if (view === "channel" && activeChannelId !== null) {
        await sendMessageMut.mutateAsync({ channelId: activeChannelId, body });
      } else if (view === "dm" && activeDmUserId !== null) {
        await sendDmMut.mutateAsync({ toUserId: activeDmUserId, body });
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, view, activeChannelId, activeDmUserId, sendMessageMut, sendDmMut]);

  // ─── voice recording handlers ──────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      alert(t("forum_mic_denied"));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecording(false);
    setRecordingSeconds(0);
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
      mr.stream.getTracks().forEach(t => t.stop());
    });
    const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
    if (blob.size < 1000) return; // too short, ignore
    // Convert to base64
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setSending(true);
      try {
        if (view === "channel" && activeChannelId !== null) {
          await sendVoiceMut.mutateAsync({ channelId: activeChannelId, audioBase64: base64, mimeType: mr.mimeType });
        } else if (view === "dm" && activeDmUserId !== null) {
          await sendVoiceDmMut.mutateAsync({ toUserId: activeDmUserId, audioBase64: base64, mimeType: mr.mimeType });
        }
      } finally {
        setSending(false);
      }
    };
  }, [view, activeChannelId, activeDmUserId, sendVoiceMut, sendVoiceDmMut]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openChannel = (id: number) => {
    setView("channel");
    setActiveChannelId(id);
    setMobileSidebarOpen(false);
  };

  const openDm = (userId: number) => {
    setView("dm");
    setActiveDmUserId(userId);
    setShowUserList(false);
    setMobileSidebarOpen(false);
    // Clear unread badge immediately when opening a DM conversation
    utils.forum.getUnreadCount.invalidate();
    utils.forum.getConversations.invalidate();
  };

  // ─── file upload handler ───────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeChannelId === null) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await uploadFileMut.mutateAsync({
        channelId: activeChannelId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64: base64,
      });
      setChannelTab("files");
    };
    e.target.value = "";
  }, [activeChannelId, uploadFileMut]);

  // ─── reaction helpers ──────────────────────────────────────────────────────
  const reactionsMap = useMemo(() => {
    const m: Record<number, { emoji: string; count: number; mine: boolean }[]> = {};
    for (const r of reactionsQ.data ?? []) m[r.messageId] = r.reactions;
    return m;
  }, [reactionsQ.data]);

  const replyCountMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const r of replyCountQ.data ?? []) m[r.messageId] = r.count;
    return m;
  }, [replyCountQ.data]);

  const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "👏", "😮"];

  // ─── derived data ──────────────────────────────────────────────────────────

  const channels = channelsQ.data ?? [];
  const allUsers = usersQ.data ?? [];
  const conversations = conversationsQ.data ?? [];
  const channelMessages = channelMessagesQ.data ?? [];
  const dmMessages = dmMessagesQ.data ?? [];
  const totalUnread = unreadQ.data?.unread ?? 0;

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeDmUser = allUsers.find((u) => u.id === activeDmUserId);

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );
  const filteredUsers = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      u.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );
  const filteredConversations = conversations.filter((c) =>
    c.otherName.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  const onlineCount = allUsers.filter((u) => u.online && u.id !== user?.id).length;

  // ─── render ────────────────────────────────────────────────────────────────

  const headerTitle =
    view === "channel" && activeChannel
      ? `${activeChannel.emoji} #${activeChannel.name}`
      : view === "dm" && activeDmUser
      ? activeDmUser.name
      : t("forum_title");

  const headerSub =
    view === "channel" && activeChannel
      ? activeChannel.description ?? ""
      : view === "dm" && activeDmUser
      ? activeDmUser.online ? t("forum_online") : t("forum_offline")
      : "";

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{
        backgroundImage: `url(${HERO_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Dark overlay matching hero */}
      <div className="absolute inset-0 bg-black/55 pointer-events-none z-0" />
      <NavBar />

      {/* Forum shell */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        {/* Mobile backdrop dim — taps outside close the sidebar */}
        {/* Mobile backdrop — always rendered so it can fade in/out */}
        <div
          className={cn(
            "fixed inset-0 z-10 bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-300",
            mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <aside
          className={cn(
            "flex flex-col w-full md:w-72 lg:w-80 flex-shrink-0",
            /* Desktop: subtle glass panel */
            "md:bg-white/10 md:backdrop-blur-md md:border-r md:border-white/20 md:z-20 md:relative md:flex",
            /* Mobile: stronger frosted glass, fixed over content with slide animation */
            "fixed inset-y-0 left-0 z-30 bg-black/50 backdrop-blur-xl border-r border-white/25 shadow-2xl",
            "md:static md:bg-white/10 md:backdrop-blur-md md:shadow-none md:border-r md:border-white/20",
            "transition-transform duration-300 ease-in-out",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          {/* Sidebar header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/15">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="font-heading font-bold text-lg text-white drop-shadow">{t("forum_title")}</h1>
                <p className="text-xs text-white/50">{t("forum_powered")}</p>
              </div>
              <div className="flex items-center gap-1">
                {onlineCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                    <Circle className="w-2 h-2 fill-emerald-500" />
                    {onlineCount} {t("forum_online_short")}
                  </span>
                )}
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={t("forum_search")}
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
              />
            </div>
          </div>

          {/* Sidebar tabs */}
          <div className="flex border-b border-white/15">
            <button
              onClick={() => setView("channel")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors",
                view === "channel"
                  ? "text-white border-b-2 border-white"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              <Hash className="w-3.5 h-3.5" />
              {t("forum_channels")}
            </button>
            <button
              onClick={() => setView("dm")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors relative",
                view === "dm"
                  ? "text-white border-b-2 border-white"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {t("forum_dms")}
              {totalUnread > 0 && (
                <span className="absolute top-1.5 right-4 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowUserList((v) => !v)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors",
                showUserList
                  ? "text-white border-b-2 border-white"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              {t("forum_members")}
            </button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto">

            {/* Channel list */}
            {!showUserList && view === "channel" && (
              <div className="py-2">
                <p className="px-4 py-1.5 text-[10px] font-bold text-white/50 uppercase tracking-widest">
                  {t("forum_channels")}
                </p>
                {filteredChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => openChannel(ch.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                      activeChannelId === ch.id && view === "channel"
                        ? "bg-white/20 text-white font-semibold"
                        : "text-white/80 hover:bg-white/10"
                    )}
                  >
                    <span className="text-lg flex-shrink-0">{ch.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">#{ch.name}</p>
                      {ch.description && (
                        <p className="text-xs text-white/50 truncate">{ch.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* DM conversation list */}
            {!showUserList && view === "dm" && (
              <div className="py-2">
                <div className="flex items-center justify-between px-4 py-1.5">
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    {t("forum_dms")}
                  </p>
                  <button
                    onClick={() => setShowUserList(true)}
                    className="text-xs text-white/70 font-semibold hover:text-white hover:underline"
                  >
                    + {t("forum_new_dm")}
                  </button>
                </div>

                {filteredConversations.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-white/50">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>{t("forum_no_dms")}</p>
                      <button
                      onClick={() => setShowUserList(true)}
                      className="mt-2 text-white/70 font-semibold hover:text-white hover:underline text-xs"
                    >
                      {t("forum_start_dm")}
                    </button>
                  </div>
                )}

                {filteredConversations.map((conv) => {
                  const u = allUsers.find((x) => x.id === conv.otherId);
                  return (
                    <button
                      key={conv.otherId}
                      onClick={() => openDm(conv.otherId)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left",
                        activeDmUserId === conv.otherId && view === "dm"
                          ? "bg-white/20 text-white"
                          : "text-white/80 hover:bg-white/10"
                      )}
                    >
                      <Avatar name={conv.otherName} size="md" online={u?.online} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm truncate">{conv.otherName}</p>
                          <span className="text-[10px] text-white/40 flex-shrink-0 ml-1">
                            {formatTime(conv.lastAt)}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 truncate">{conv.lastBody}</p>
                      </div>
                      {conv.unread > 0 && (
                        <span className="w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                          {conv.unread > 9 ? "9+" : conv.unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* User / member list */}
            {showUserList && (
              <div className="py-2">
                <div className="flex items-center justify-between px-4 py-1.5">
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    {t("forum_members")} ({allUsers.length})
                  </p>
                  <button
                    onClick={() => setShowUserList(false)}
                    className="text-xs text-white/50 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Online */}
                {filteredUsers.filter((u) => u.online).length > 0 && (
                  <>
                    <p className="px-4 py-1 text-[10px] font-semibold text-emerald-300 uppercase tracking-widest">
                      {t("forum_online")} — {filteredUsers.filter((u) => u.online).length}
                    </p>
                    {filteredUsers.filter((u) => u.online).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => openDm(u.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/10 text-left transition-colors"
                      >
                        <Avatar name={u.name} size="sm" online={true} />
                        <span className="font-medium text-white">{u.name}</span>
                      </button>
                    ))}
                  </>
                )}

                {/* Offline */}
                {filteredUsers.filter((u) => !u.online).length > 0 && (
                  <>
                    <p className="px-4 py-1 mt-1 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                      {t("forum_offline")} — {filteredUsers.filter((u) => !u.online).length}
                    </p>
                    {filteredUsers.filter((u) => !u.online).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => openDm(u.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/10 text-left transition-colors opacity-60"
                      >
                        <Avatar name={u.name} size="sm" online={false} />
                        <div>
                          <span className="font-medium text-white/80">{u.name}</span>
                          {u.lastSeen && (
                            <p className="text-[10px] text-white/40">{t("forum_last_seen")} {formatTime(u.lastSeen)}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar footer — current user */}
          {user && (
            <div className="border-t border-white/15 px-4 py-3 flex items-center gap-3 bg-white/10">
              <Avatar name={user.name ?? t("forum_me")} size="sm" online={true} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-emerald-300 font-medium">{t("forum_you_online")}</p>
              </div>
              <span className="text-[10px] text-white/40 font-medium">{t("forum_ai_label")}</span>
            </div>
          )}
        </aside>

        {/* ── CHAT AREA ───────────────────────────────────────────────── */}
        <main
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* DM mode: no conversation selected yet */}
          {view === "dm" && activeDmUserId === null && (
            <div className="flex flex-col flex-1 items-center justify-center text-center text-white/60 gap-4">
              <MessageSquare className="w-14 h-14 opacity-30" />
              <div>
                <p className="font-semibold text-white/80 text-lg">Select a conversation</p>
                <p className="text-sm mt-1 text-white/50">Choose a contact from the sidebar to start messaging</p>
              </div>
              <button
                className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                onClick={() => setMobileSidebarOpen(true)}
              >
                Open conversations
              </button>
            </div>
          )}
          {/* Channel mode: no channel selected */}
          {view === "channel" && activeChannelId === null && (
            <div className="flex flex-col flex-1 items-center justify-center text-center text-white/60 gap-4">
              <MessageSquare className="w-14 h-14 opacity-30" />
              <p className="font-semibold text-white/80 text-lg">Select a channel</p>
            </div>
          )}
          {/* Main content — only shown when a channel/DM is selected */}
          {((view === "channel" && activeChannelId !== null) || (view === "dm" && activeDmUserId !== null)) && (
            <>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-md border-b border-white/20 shadow-sm flex-shrink-0">
            {/* Mobile back button */}
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {view === "channel" && activeChannel && (
              <span className="text-2xl">{activeChannel.emoji}</span>
            )}
            {view === "dm" && activeDmUser && (
              <Avatar name={activeDmUser.name} size="md" online={activeDmUser.online} />
            )}

            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-white truncate drop-shadow">{headerTitle}</h2>
              {headerSub && <p className="text-xs text-white/60 truncate">{headerSub}</p>}
            </div>

            <div className="flex items-center gap-1 text-white/60">
              {view === "channel" && (
                <>
                  <button
                    onClick={() => setShowPinned(v => !v)}
                    className={cn("p-2 rounded-lg hover:bg-white/15 transition-colors", showPinned && "bg-amber-500/30 text-amber-300")}
                    title={t("forum_pinned")}
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowUserList((v) => !v)}
                    className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                    title={t("forum_members")}
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Channel tabs */}
          {view === "channel" && (
            <div className="flex border-b border-white/15 bg-white/5 flex-shrink-0">
              <button
                onClick={() => setChannelTab("messages")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors",
                  channelTab === "messages" ? "text-white border-b-2 border-white" : "text-white/50 hover:text-white/80"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {t("forum_messages_tab")}
              </button>
              <button
                onClick={() => setChannelTab("files")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors",
                  channelTab === "files" ? "text-white border-b-2 border-white" : "text-white/50 hover:text-white/80"
                )}
              >
                <Paperclip className="w-3.5 h-3.5" />
                {t("forum_files_tab")}
                {(channelFilesQ.data?.length ?? 0) > 0 && (
                  <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{channelFilesQ.data?.length}</span>
                )}
              </button>
            </div>
          )}

          {/* Pinned messages banner */}
          {view === "channel" && showPinned && (pinnedQ.data?.length ?? 0) > 0 && (
            <div className="flex-shrink-0 bg-amber-500/15 border-b border-amber-400/30 px-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Pin className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">{t("forum_pinned")}</span>
                <button onClick={() => setShowPinned(false)} className="ml-auto text-white/40 hover:text-white/70"><X className="w-3.5 h-3.5" /></button>
              </div>
              {pinnedQ.data?.map(pin => (
                <div key={pin.pinId} className="text-xs text-white/80 truncate pl-5">
                  <span className="font-semibold text-white/60">{pin.userName}: </span>{pin.body}
                </div>
              ))}
            </div>
          )}

          {/* Files tab content */}
          {view === "channel" && channelTab === "files" && (
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-black/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white/80">{t("forum_files_tab")} — #{activeChannel?.name}</h3>
                <label className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs text-white font-medium transition-colors">
                  <Paperclip className="w-3.5 h-3.5" />
                  {t("forum_upload_file")}
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              {(channelFilesQ.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/40">
                  <FileText className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">{t("forum_no_files")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {channelFilesQ.data?.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl">
                      {f.mimeType?.startsWith("image/") ? (
                        <ImageIcon className="w-8 h-8 text-blue-300 flex-shrink-0" />
                      ) : (
                        <FileText className="w-8 h-8 text-white/50 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{f.fileName}</p>
                        <p className="text-xs text-white/40">{f.uploaderName} · {f.fileSize ? `${Math.round(f.fileSize / 1024)}KB` : ""}</p>
                      </div>
                      <a href={f.fileUrl ?? ""} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className={cn("flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-black/20 backdrop-blur-sm", view === "channel" && channelTab === "files" && "hidden")}>
            {(view === "channel" ? channelMessages : dmMessages).length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-white/60 py-16">
                {view === "channel" ? (
                  <>
                    <span className="text-5xl mb-3">{activeChannel?.emoji ?? "💬"}</span>
                    <p className="font-semibold text-white/80 text-lg">#{activeChannel?.name}</p>
                    <p className="text-sm mt-1">{t("forum_channel_empty")}</p>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-12 h-12 mb-3 opacity-40" />
                    <p className="font-semibold text-white/80">{t("forum_dm_empty_title")}</p>
                    <p className="text-sm mt-1">{t("forum_dm_empty_sub")}</p>
                  </>
                )}
              </div>
            )}

            {view === "channel" && channelMessages.map((msg, idx) => {
              const isMine = msg.userId === user?.id;
              const prevMsg = channelMessages[idx - 1];
              const sameAuthor = prevMsg && prevMsg.userId === msg.userId;
              const timeDiff = prevMsg
                ? new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
                : Infinity;
              const showHeader = !sameAuthor || timeDiff > 5 * 60_000;
              const msgReactions = reactionsMap[msg.id] ?? [];
              const replyCount = replyCountMap[msg.id] ?? 0;
              return (
                <div key={msg.id} className={cn("group flex items-end gap-2", isMine ? "flex-row-reverse" : "flex-row", showHeader ? "mt-4" : "mt-0.5")}>
                  {!isMine && showHeader && <Avatar name={msg.userName} size="sm" />}
                  {!isMine && !showHeader && <div className="w-7 flex-shrink-0" />}
                  <div className={cn("max-w-[70%] flex flex-col", isMine ? "items-end" : "items-start")}>
                    {showHeader && !isMine && <span className="text-xs font-semibold text-gray-500 mb-1 ml-1">{msg.userName}</span>}
                    <div className={cn("px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-sm", isMine ? "bg-primary text-white rounded-br-sm" : "bg-white/15 backdrop-blur-sm text-white border border-white/20 rounded-bl-sm")}>
                      {msg.messageType === "voice" && msg.audioUrl ? (
                        <div className="flex flex-col gap-1.5">
                          <audio controls className="w-full max-w-xs" style={{ height: "32px" }}>
                            <source src={msg.audioUrl} type="audio/webm" />
                            <source src={msg.audioUrl} type="audio/mp4" />
                          </audio>
                          <span className="text-xs opacity-70">{msg.body}</span>
                        </div>
                      ) : (
                        msg.body
                      )}
                    </div>

                    {/* Reaction bar */}
                    {msgReactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 mx-1">
                        {msgReactions.map(r => (
                          <button
                            key={r.emoji}
                            onClick={() => toggleReactionMut.mutate({ messageId: msg.id, emoji: r.emoji })}
                            className={cn(
                              "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                              r.mine
                                ? "bg-primary/30 border-primary/50 text-white"
                                : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                            )}
                          >
                            {r.emoji} <span className="font-medium">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action buttons (hover) */}
                    <div className={cn(
                      "flex items-center gap-1 mt-0.5 mx-1 opacity-0 group-hover:opacity-100 transition-opacity",
                      isMine ? "flex-row-reverse" : "flex-row"
                    )}>
                      {/* Quick emoji picker */}
                      <div className="relative">
                        <button
                          onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                          className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 text-white/60 hover:text-white transition-colors"
                        >
                          <SmilePlus className="w-3.5 h-3.5" />
                        </button>
                        {showReactionPicker === msg.id && (
                          <div className={cn(
                            "absolute bottom-7 z-50 flex gap-1 p-1.5 bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-xl",
                            isMine ? "right-0" : "left-0"
                          )}>
                            {QUICK_EMOJIS.map(e => (
                              <button
                                key={e}
                                onClick={() => {
                                  toggleReactionMut.mutate({ messageId: msg.id, emoji: e });
                                  setShowReactionPicker(null);
                                }}
                                className="text-lg hover:scale-125 transition-transform p-0.5"
                              >{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Reply */}
                      <button
                        onClick={() => setThreadMsgId(threadMsgId === msg.id ? null : msg.id)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/25 text-white/60 hover:text-white text-[10px] font-medium transition-colors"
                      >
                        <Reply className="w-3 h-3" />
                        {replyCount > 0 && <span>{replyCount}</span>}
                      </button>
                      {/* Pin (staff only) */}
                      {['teacher','head_of_study','director'].includes((user as {position?: string})?.position ?? '') && (
                        <button
                          onClick={() => pinMut.mutate({ channelId: activeChannelId!, messageId: msg.id })}
                          className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 hover:bg-amber-500/30 text-white/60 hover:text-amber-300 transition-colors"
                          title={t("forum_pin_message")}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] text-white/40 mt-0.5 mx-1">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            {view === "dm" && dmMessages.map((msg, idx) => {
              const isMine = msg.isMine;
              const prevMsg = dmMessages[idx - 1];
              const sameAuthor = prevMsg && prevMsg.fromUserId === msg.fromUserId;
              const timeDiff = prevMsg
                ? new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
                : Infinity;
              const showHeader = !sameAuthor || timeDiff > 5 * 60_000;
              return (
                <div key={msg.id} className={cn("flex items-end gap-2", isMine ? "flex-row-reverse" : "flex-row", showHeader ? "mt-4" : "mt-0.5")}>
                  {!isMine && showHeader && <Avatar name={msg.fromName} size="sm" />}
                  {!isMine && !showHeader && <div className="w-7 flex-shrink-0" />}
                  <div className={cn("max-w-[70%] flex flex-col", isMine ? "items-end" : "items-start")}>
                    {showHeader && !isMine && <span className="text-xs font-semibold text-gray-500 mb-1 ml-1">{msg.fromName}</span>}
                    <div className={cn("px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-sm", isMine ? "bg-primary text-white rounded-br-sm" : "bg-white/15 backdrop-blur-sm text-white border border-white/20 rounded-bl-sm")}>
                      {msg.messageType === "voice" && msg.audioUrl ? (
                        <div className="flex flex-col gap-1.5">
                          <audio controls className="w-full max-w-xs" style={{ height: "32px" }}>
                            <source src={msg.audioUrl} type="audio/webm" />
                            <source src={msg.audioUrl} type="audio/mp4" />
                          </audio>
                          <span className="text-xs opacity-70">{msg.body}</span>
                        </div>
                      ) : (
                        msg.body
                      )}
                    </div>
                    <span className="text-[10px] text-white/40 mt-0.5 mx-1">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Thread panel */}
          {threadMsgId !== null && (
            <div className="flex-shrink-0 border-t border-white/20 bg-black/30 backdrop-blur-md px-4 py-3 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white/70 uppercase tracking-widest">{t("forum_thread")}</span>
                <button onClick={() => setThreadMsgId(null)} className="text-white/40 hover:text-white/70"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-2 mb-2">
                {(threadRepliesQ.data ?? []).map(r => (
                  <div key={r.id} className="flex items-start gap-2">
                    <Avatar name={r.userName} size="sm" />
                    <div>
                      <span className="text-xs font-semibold text-white/70">{r.userName}</span>
                      <p className="text-xs text-white/80 mt-0.5">{r.body}</p>
                    </div>
                  </div>
                ))}
                {(threadRepliesQ.data?.length ?? 0) === 0 && (
                  <p className="text-xs text-white/40">{t("forum_no_replies")}</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={threadInput}
                  onChange={e => setThreadInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && threadInput.trim() && threadMsgId && activeChannelId) {
                      postReplyMut.mutate({ parentMessageId: threadMsgId, channelId: activeChannelId, body: threadInput.trim() });
                      setThreadInput("");
                    }
                  }}
                  placeholder={t("forum_reply_placeholder")}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/40"
                />
                <button
                  onClick={() => {
                    if (threadInput.trim() && threadMsgId && activeChannelId) {
                      postReplyMut.mutate({ parentMessageId: threadMsgId, channelId: activeChannelId, body: threadInput.trim() });
                      setThreadInput("");
                    }
                  }}
                  disabled={!threadInput.trim()}
                  className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border-t border-white/20 px-4 py-3">
            {/* Recording indicator */}
            {recording && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-sm border border-red-400/40 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-600 font-medium">
                  {t("forum_recording")} {recordingSeconds}s
                </span>
                <span className="ml-auto text-xs text-red-400">{t("forum_release_to_send")}</span>
              </div>
            )}
            <div className="flex items-end gap-2 bg-white/10 backdrop-blur-sm border border-white/25 rounded-2xl px-3 py-2 focus-within:border-white/50 focus-within:ring-2 focus-within:ring-white/20 transition-all">
              {!recording && (
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    view === "channel" && activeChannel
                      ? `${t("forum_message_placeholder")} #${activeChannel.name}`
                      : view === "dm" && activeDmUser
                      ? `${t("forum_dm_placeholder")} ${activeDmUser.name}`
                      : t("forum_message_placeholder")
                  }
                  className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder:text-white/40 max-h-28 leading-relaxed"
                  style={{ minHeight: "24px" }}
                />
              )}
              {recording && (
                <div className="flex-1 flex items-center gap-1.5">
                  {[...Array(12)].map((_, i) => (
                    <span
                      key={i}
                      className="w-0.5 bg-red-400 rounded-full animate-pulse"
                      style={{ height: `${8 + Math.sin(i * 0.9 + Date.now() / 200) * 6}px`, animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              )}
              {/* Mic button — hold to record */}
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                disabled={sending}
                title={t("forum_hold_to_record")}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl transition-all flex-shrink-0",
                  recording
                    ? "bg-red-500 text-white shadow-md scale-110"
                    : "bg-white/15 text-white/70 hover:bg-white/25"
                )}
              >
                {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              {/* Send button */}
              {!recording && (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-xl transition-all flex-shrink-0",
                    input.trim() && !sending
                      ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/40 mt-1.5 text-center">
              {t("forum_enter_to_send")} · {t("forum_shift_enter")} · {t("forum_hold_to_record")}
            </p>
          </div>
            </>
          )}
        </main>
      </div>

      {/* Powered by SEBA footer strip */}
      <div className="hidden md:flex items-center justify-center py-1 bg-black/30 border-t border-white/15 text-[10px] text-white/40 relative z-10">
        {t("forum_footer")}
      </div>
    </div>
  );
}
