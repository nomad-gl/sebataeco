/**
 * SEBA Connect — Espai de Col·laboració
 *
 * A Teams-style collaboration space with:
 * - Channel sidebar (General, Anuncis, Claustre, subject channels)
 * - Message thread with auto-translation (EN/ES/CA)
 * - Assignments tab per channel
 * - Files tab per channel (S3-backed)
 * - Members right panel (reuses forum.getUsers with online presence)
 * - Video call with branded header (SEBA logo left, school logo right)
 * - Catalan sovereignty identity (senyera accent colours)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import PreCallScreen, { type VideoBackground, type VideoFilter } from "@/components/PreCallScreen";
import { IncomingCallBanner } from "@/components/IncomingCallBanner";
import { CallHistoryPanel } from "@/components/CallHistoryPanel";
import { SebaMeet } from "@/components/SebaMeet";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Hash,
  Megaphone,
  Users,
  Send,
  Paperclip,
  Trash2,
  Edit2,
  MoreVertical,
  Plus,
  ClipboardList,
  FolderOpen,
  MessageSquare,
  MessageCircle,
  CheckCircle,
  Clock,
  Download,
  X,
  ChevronDown,
  ChevronRight,
  Video,
  Circle,
  ScreenShare,
  ScreenShareOff,
  Phone,
  CalendarPlus,
  ArrowLeft,
  Menu,
} from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { MeetingInvitationBanner } from "@/components/MeetingInvitationBanner";
import { SendMeetingInvitationModal } from "@/components/SendMeetingInvitationModal";
import { MeetingHistoryPanel } from "@/components/MeetingHistoryPanel";
import { DMPanel } from "@/components/DMPanel";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


// ─── types ────────────────────────────────────────────────────────────────────

type Tab = "messages" | "assignments" | "files";

// ─── SebaMeetStable ───────────────────────────────────────────────────────────
// Defined OUTSIDE SebaConnect so it is never recreated on parent re-renders.
// This lets React.memo on SebaMeet do its job: the component only re-renders
// when its own props change, not when SebaConnect's state changes.

interface SebaMeetStableProps {
  dmCallRoom: { roomName: string; partnerName: string } | null;
  selectedChannelId: number;
  channelsData: Channel[] | undefined;
  callOpts: { videoEnabled: boolean; audioEnabled: boolean; background: VideoBackground; filter: VideoFilter } | null;
  schoolLogo: string | null;
  callId: number | null;
  setVideoCallActive: (v: boolean) => void;
  setDmCallRoom: (v: null) => void;
  setCallOpts: (v: null) => void;
}

function SebaMeetStable({
  dmCallRoom,
  selectedChannelId,
  channelsData,
  callOpts,
  schoolLogo,
  callId,
  setVideoCallActive,
  setDmCallRoom,
  setCallOpts,
}: SebaMeetStableProps) {
  const roomName = dmCallRoom
    ? dmCallRoom.roomName
    : `seba-connect-${selectedChannelId}`;
  const channelName = dmCallRoom
    ? dmCallRoom.partnerName
    : channelsData?.find((c) => c.id === selectedChannelId)?.name;
  const audioOnly    = callOpts ? !callOpts.videoEnabled : false;
  const schoolLogoUrl = schoolLogo ?? undefined;
  const videoFilter  = callOpts?.filter?.css ?? undefined;
  const backgroundId = callOpts?.background?.id ?? undefined;

  const handleEnd = useCallback(() => {
    setVideoCallActive(false);
    setDmCallRoom(null);
    setCallOpts(null);
  }, [setVideoCallActive, setDmCallRoom, setCallOpts]);

  return (
    <SebaMeet
      roomName={roomName}
      channelName={channelName}
      audioOnly={audioOnly}
      schoolLogoUrl={schoolLogoUrl}
      videoFilter={videoFilter}
      backgroundId={backgroundId}
      callId={callId ?? undefined}
      onEnd={handleEnd}
    />
  );
}

interface Channel {
  id: number;
  name: string;
  description: string | null;
  type: string;
  colour: string | null;
}

interface Message {
  id: number;
  channelId: number;
  userId: string;
  content: string;
  displayContent: string;
  senderName: string;
  createdAt: Date;
  editedAt: Date | null;
  isDeleted: boolean;
  replyToId: number | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function channelIcon(type: string) {
  if (type === "announcement") return <Megaphone className="w-3.5 h-3.5" />;
  if (type === "year_group") return <Users className="w-3.5 h-3.5" />;
  return <Hash className="w-3.5 h-3.5" />;
}

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateRaw(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "__today__";
  if (d.toDateString() === yesterday.toDateString()) return "__yesterday__";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

function fileIcon(mime: string | null) {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📕";
  if (mime.includes("word")) return "📝";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
  return "📄";
}

// ─── sub-components ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isOwn,
  canDelete,
  onDelete,
  onEdit,
  t,
}: {
  msg: Message;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
  onEdit: (msg: Message) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string;
}) {
  return (
    <div className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} items-start mb-3`}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
        style={{ background: isOwn ? "#AE0001" : "#003082" }}
      >
        {msg.senderName.charAt(0).toUpperCase()}
      </div>

      {/* Bubble */}
      <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-muted-foreground font-medium">{msg.senderName}</span>
          <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
          {msg.editedAt && <span className="text-xs text-muted-foreground italic">{t("connect_edited_label")}</span>}
        </div>

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isOwn
              ? "bg-[#AE0001] text-white rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          {msg.displayContent}
          {msg.attachmentUrl && (
            <a
              href={msg.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 mt-1.5 text-xs underline opacity-80"
            >
              <Paperclip className="w-3 h-3" />
              {msg.attachmentName ?? t("connect_attachment_label")}
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      {(isOwn || canDelete) && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 self-center">
          {isOwn && (
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6"
              onClick={() => onEdit(msg)}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 text-destructive"
              onClick={() => onDelete(msg.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SebaConnect() {
  const { user } = useAuth();
  useDocumentTitle("SEBA Connect · Videotrucada Educativa");

  const { t, lang: currentLang } = useI18n();
  const lang = (currentLang === "ca" ? "ca" : currentLang === "es" ? "es" : "en") as "en" | "es" | "ca";
  const [, navigate] = useLocation();

  const [selectedChannelId, setSelectedChannelId] = useState<number>(1);
  const [tab, setTab] = useState<Tab>("messages");
  const [messageText, setMessageText] = useState("");
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelType, setNewChannelType] = useState<"general" | "subject" | "year_group" | "announcement">("general");
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDue, setAssignDue] = useState("");
  // On mobile (< md) default both panels closed to avoid overflow
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [membersOpen, setMembersOpen] = useState(false);
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [preCallActive, setPreCallActive] = useState(false);
  const [callOpts, setCallOpts] = useState<{ videoEnabled: boolean; audioEnabled: boolean; background: VideoBackground; filter: VideoFilter } | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  // DM call — set when clicking an online member; null = channel call
  const [dmCallRoom, setDmCallRoom] = useState<{ roomName: string; partnerName: string } | null>(null);

  // Current user’s numeric DB id (needed for deterministic DM room names)
  const meQuery = trpc.auth.me.useQuery();
  const myDbId = meQuery.data?.id ?? null;

  // Generate a stable private room name from two numeric user IDs
  const makeDmRoom = useCallback((myId: number, theirId: number) => {
    const a = Math.min(myId, theirId);
    const b = Math.max(myId, theirId);
    return `seba-dm-${a}-${b}`;
  }, []);

  // tRPC mutation to record the call in the DB
  const initiateCallMutation = trpc.dmCall.initiate.useMutation();
  const endCallMutation = trpc.dmCall.end.useMutation();
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  // Meeting invitation modal state
  const [meetInviteTarget, setMeetInviteTarget] = useState<{ id: number; name: string } | null>(null);
  // Direct message panel state
  const [dmPartner, setDmPartner] = useState<{ id: number; name: string } | null>(null);
  const [reschedulePrefill, setReschedulePrefill] = useState<{ title?: string; agenda?: string | null; recurrence?: string | null } | null>(null);

  // ── Swipe gesture state ──────────────────────────────────────────────────
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    // Only trigger if horizontal swipe dominates (avoid scroll conflicts)
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    if (deltaX > 60) {
      // Swipe right → open sidebar
      setSidebarOpen(true);
      setMembersOpen(false);
    } else if (deltaX < -60) {
      // Swipe left → open members panel
      setMembersOpen(true);
      setSidebarOpen(false);
    }
  }, []);

  // Poll the status of the outgoing call so we can show a toast when declined/missed
  const callStatusQuery = trpc.dmCall.getCallStatus.useQuery(
    { callId: activeCallId! },
    {
      enabled: activeCallId !== null && preCallActive,
      refetchInterval: 3_000,
      refetchIntervalInBackground: false,
    }
  );

  // Show missed-call toast when the callee declines or the call times out
  const prevCallStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const status = callStatusQuery.data?.status;
    if (!status) return;
    if (prevCallStatusRef.current === status) return;
    prevCallStatusRef.current = status;
    const calleeName = callStatusQuery.data?.calleeName ?? "the other person";
    if (status === "declined") {
      toast.error(`${calleeName} declined the call`, { duration: 5000 });
      setPreCallActive(false);
      setVideoCallActive(false);
    } else if (status === "missed") {
      toast.info(`${calleeName} didn't answer`, { duration: 5000 });
      setPreCallActive(false);
      setVideoCallActive(false);
    }
  }, [callStatusQuery.data]);

  // Called when an online member avatar is clicked
  const handleMemberCall = useCallback(async (memberId: number, memberName: string, audioOnly = false) => {
    if (!myDbId) { toast.error("Not signed in"); return; }
    const roomName = makeDmRoom(myDbId, memberId);
    setDmCallRoom({ roomName, partnerName: memberName });
    prevCallStatusRef.current = null;
    try {
      const { callId } = await initiateCallMutation.mutateAsync({ calleeId: memberId, roomName, audioOnly });
      setActiveCallId(callId);
    } catch {
      // Non-critical — call still works without DB record
    }
    setPreCallActive(true);
  }, [myDbId, makeDmRoom, initiateCallMutation]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reset iframe loading state each time the call dialog opens
  useEffect(() => {
    if (videoCallActive) {
      setIframeLoading(true);
      setIsRecording(false);
      setActiveReaction(null);
    }
  }, [videoCallActive]);

  const sendReaction = (emoji: string) => {
    setActiveReaction(emoji);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => setActiveReaction(null), 3000);
  };
  const [schoolLogo, setSchoolLogo] = useState<string | null>(
    () => localStorage.getItem("seba_school_logo")
  );
  // Keep school logo in sync if it changes in another tab/component
  useEffect(() => {
    const onLogoChange = (e: Event) => {
      setSchoolLogo((e as CustomEvent<string | null>).detail);
    };
    window.addEventListener("seba_logo_changed", onLogoChange);
    return () => window.removeEventListener("seba_logo_changed", onLogoChange);
  }, []);

  // ── Handle incoming call accepted from GlobalCallListener (cross-page) ──────
  // Case 1: User was on /connect when they accepted — GlobalCallListener fires a
  //         custom DOM event so we open the pre-call dialog here.
  useEffect(() => {
    const handler = (e: Event) => {
      const { roomName, callerName, audioOnly } = (e as CustomEvent<{
        roomName: string;
        callerName: string;
        audioOnly: boolean;
      }>).detail;
      setDmCallRoom({ roomName, partnerName: callerName });
      if (audioOnly) {
        setVideoCallActive(true);
      } else {
        setPreCallActive(true);
      }
    };
    window.addEventListener("seba:incoming-call-accepted", handler);
    return () => window.removeEventListener("seba:incoming-call-accepted", handler);
  }, []);

  // Case 2: User navigated from another page after accepting — pick up from sessionStorage.
  useEffect(() => {
    const raw = sessionStorage.getItem("seba:pending-call");
    if (!raw) return;
    sessionStorage.removeItem("seba:pending-call");
    try {
      const { roomName, callerName, audioOnly } = JSON.parse(raw) as {
        roomName: string;
        callerName: string;
        audioOnly: boolean;
      };
      setDmCallRoom({ roomName, partnerName: callerName });
      if (audioOnly) {
        setVideoCallActive(true);
      } else {
        setPreCallActive(true);
      }
    } catch { /* malformed — ignore */ }
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pos = (user as { position?: string } | null)?.position ?? "unassigned";
  const canManage = ["teacher", "head_of_study", "director"].includes(pos);
  const canDeleteOthers = pos === "director" || pos === "head_of_study";

  // ── queries ────────────────────────────────────────────────────────────────

  const channelsQuery = trpc.teams.getChannels.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Pause message polling while a call is active — prevents the 3 s refetch from
  // re-rendering the parent and causing the SebaMeet container to flicker.
  const messagesQuery = trpc.teams.getMessages.useQuery(
    { channelId: selectedChannelId, lang },
    { refetchInterval: videoCallActive ? false : 3000, enabled: tab === "messages" && !videoCallActive }
  );

  const assignmentsQuery = trpc.teams.getAssignments.useQuery(
    { channelId: selectedChannelId },
    { enabled: tab === "assignments" }
  );

  const filesQuery = trpc.teams.getFiles.useQuery(
    { channelId: selectedChannelId },
    { enabled: tab === "files" }
  );

  // Members panel — reuse forum.getUsers (same presence data as TA Forum)
  const membersQuery = trpc.forum.getUsers.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const utils = trpc.useUtils();

  // ── mutations ──────────────────────────────────────────────────────────────

  const sendMutation = trpc.teams.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      utils.teams.getMessages.invalidate({ channelId: selectedChannelId });
    },
    onError: (e) => toast.error(e.message),
  });

  const editMutation = trpc.teams.editMessage.useMutation({
    onSuccess: () => {
      setEditingMsg(null);
      utils.teams.getMessages.invalidate({ channelId: selectedChannelId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.teams.deleteMessage.useMutation({
    onSuccess: () => utils.teams.getMessages.invalidate({ channelId: selectedChannelId }),
    onError: (e) => toast.error(e.message),
  });

  const createChannelMutation = trpc.teams.createChannel.useMutation({
    onSuccess: () => {
      setShowCreateChannel(false);
      setNewChannelName("");
      setNewChannelDesc("");
      utils.teams.getChannels.invalidate();
      toast.success("Canal creat!");
    },
    onError: (e) => toast.error(e.message),
  });

  const createAssignmentMutation = trpc.teams.createAssignment.useMutation({
    onSuccess: () => {
      setShowCreateAssignment(false);
      setAssignTitle("");
      setAssignDesc("");
      setAssignDue("");
      utils.teams.getAssignments.invalidate({ channelId: selectedChannelId });
      toast.success("Tasca creada!");
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadFileMutation = trpc.teams.uploadFile.useMutation({
    onSuccess: () => {
      utils.teams.getFiles.invalidate({ channelId: selectedChannelId });
      toast.success("Fitxer pujat!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteFileMutation = trpc.teams.deleteFile.useMutation({
    onSuccess: () => utils.teams.getFiles.invalidate({ channelId: selectedChannelId }),
    onError: (e) => toast.error(e.message),
  });

  // ── effects ────────────────────────────────────────────────────────────────

  // Scroll to bottom on new messages — use scrollTop on the container (not
  // scrollIntoView) to prevent the scroll from propagating up to the page body
  // and hijacking the user's window scroll position.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messagesQuery.data]);

  // ── handlers ──────────────────────────────────────────────────────────────

  function handleSend() {
    const text = messageText.trim();
    if (!text) return;
    sendMutation.mutate({ channelId: selectedChannelId, content: text });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El fitxer no pot superar els 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadFileMutation.mutate({
        channelId: selectedChannelId,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const selectedChannel = channelsQuery.data?.find((c) => c.id === selectedChannelId);
  const messages = (messagesQuery.data ?? []) as Message[];
  const members = membersQuery.data ?? [];
  const onlineCount = members.filter((m) => m.online).length;

  // ─── render ─────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Cal iniciar sessió per accedir a SEBA Connect.
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-64px)] overflow-visible md:overflow-hidden bg-background pb-16 md:pb-0">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? "w-full md:w-64 max-h-[50vh] md:max-h-none" : "w-0 max-h-0 md:max-h-none"
        } transition-all duration-200 overflow-hidden shrink-0 border-r border-border flex flex-col bg-card`}
      >
        {/* Sidebar header */}
        <div
          className="px-4 py-3 border-b border-border"
          style={{ background: "linear-gradient(135deg, #AE0001 0%, #003082 100%)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="p-1 rounded hover:bg-white/20 transition-colors text-white/80 hover:text-white shrink-0"
              title="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <SebaSymbol className="w-5 h-5 text-white" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">SEBA Connect</p>
              <p className="text-white/70 text-xs">{t("connect_subtitle")}</p>
            </div>
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("connect_channels_heading")}
            </span>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="w-5 h-5"
                onClick={() => setShowCreateChannel(true)}
                title={t("connect_create_channel")}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {channelsQuery.isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t("connect_loading")}</div>
          ) : (
            (channelsQuery.data ?? []).map((ch) => (
              <button
                key={ch.id}
                onClick={() => { setSelectedChannelId(ch.id); setTab("messages"); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${
                  selectedChannelId === ch.id
                    ? "bg-[#AE0001]/10 text-[#AE0001] font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className="shrink-0"
                  style={{ color: ch.colour ?? undefined }}
                >
                  {channelIcon(ch.type)}
                </span>
                <span className="truncate">{ch.name}</span>
                {ch.type === "announcement" && (
                  <Badge variant="secondary" className="ml-auto text-xs py-0 px-1">
                    Oficial
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>

        {/* Sovereignty footer */}
        <div className="px-4 py-2 border-t border-border">
          <div className="flex gap-0.5 rounded overflow-hidden h-1.5">
            <div className="flex-1 bg-[#FCDD09]" />
            <div className="flex-1 bg-[#AE0001]" />
            <div className="flex-1 bg-[#003082]" />
            <div className="flex-1 bg-[#AE0001]" />
            <div className="flex-1 bg-[#FCDD09]" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            Catalunya · Lliure i Sobirana
          </p>
        </div>
      </aside>

       {/* ── Main area ────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-visible md:overflow-hidden min-h-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Channel header */}
        <div className="min-h-14 border-b border-border flex flex-wrap items-center gap-2 px-3 py-2 shrink-0 bg-card">
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 shrink-0"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
          </Button>

          {selectedChannel && (
            <>
              <span style={{ color: selectedChannel.colour ?? "#AE0001" }}>
                {channelIcon(selectedChannel.type)}
              </span>
              <div>
                <p className="font-semibold text-sm leading-tight">{selectedChannel.name}</p>
                {selectedChannel.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                    {selectedChannel.description}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Tab bar + Video Call + Members toggle */}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {(["messages", "assignments", "files"] as Tab[]).map((tabItem) => (
              <Button
                key={tabItem}
                size="sm"
                variant={tab === tabItem ? "default" : "ghost"}
                className={`gap-1.5 text-xs h-7 ${tab === tabItem ? "bg-[#AE0001] hover:bg-[#8a0001]" : ""}`}
                onClick={() => setTab(tabItem)}
              >
                {tabItem === "messages" && <MessageSquare className="w-3.5 h-3.5" />}
                {tabItem === "assignments" && <ClipboardList className="w-3.5 h-3.5" />}
                {tabItem === "files" && <FolderOpen className="w-3.5 h-3.5" />}
                {tabItem === "messages" ? t("connect_messages") : tabItem === "assignments" ? t("connect_assignments") : t("connect_files")}
              </Button>
            ))}

            {/* Video Call button */}
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs h-7 text-[#003082] hover:bg-[#003082]/10"
              onClick={() => setPreCallActive(true)}
              title={t("connect_video_call")}
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("connect_video_call")}</span>
            </Button>

            {/* Members toggle */}
            <Button
              size="sm"
              variant={membersOpen ? "default" : "ghost"}
              className={`gap-1.5 text-xs h-7 ${membersOpen ? "bg-[#003082] hover:bg-[#002060]" : ""}`}
              onClick={() => setMembersOpen((o) => !o)}
              title={t("connect_toggle_members")}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{onlineCount}</span>
            </Button>
          </div>
        </div>

        {/* ── Messages tab ──────────────────────────────────────────────────── */}
        {tab === "messages" && (
          <>
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-[40vh] md:min-h-0">
              {messagesQuery.isLoading ? (
                <div className="text-center text-muted-foreground text-sm py-8">{t("connect_loading_messages")}</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-16">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{t("connect_no_messages")}</p>
                  <p className="text-xs mt-1">{t("connect_be_first_to_write")}</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const showDate =
                      !prevMsg ||
                      formatDateRaw(msg.createdAt) !== formatDateRaw(prevMsg.createdAt);
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-2 my-4">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground px-2">
                              {formatDateRaw(msg.createdAt) === "__today__" ? t("connect_today") : formatDateRaw(msg.createdAt) === "__yesterday__" ? t("connect_yesterday") : formatDateRaw(msg.createdAt)}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        {editingMsg?.id === msg.id ? (
                          <div className="flex gap-2 mb-3 ml-10">
                            <Input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  editMutation.mutate({ messageId: msg.id, content: editText });
                                }
                                if (e.key === "Escape") setEditingMsg(null);
                              }}
                            />
                            <Button
                              size="sm"
                              className="bg-[#AE0001] hover:bg-[#8a0001]"
                              onClick={() => editMutation.mutate({ messageId: msg.id, content: editText })}
                            >
                              {t("connect_save")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingMsg(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <MessageBubble
                            msg={msg}
                            isOwn={msg.userId === user?.openId}
                            canDelete={canDeleteOthers || msg.userId === user?.openId}
                            onDelete={(id) => deleteMutation.mutate({ messageId: id })}
                            onEdit={(m) => { setEditingMsg(m); setEditText(m.content); }}
                            t={t}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message input */}
            <div className="border-t border-border px-4 py-3 bg-card shrink-0">
              <div className="flex items-end gap-2">
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`${t("connect_write_message")} #${selectedChannel?.name ?? ""}…`}
                  className="flex-1 resize-none min-h-[40px] max-h-32 text-sm"
                  rows={1}
                />
                <div className="flex gap-1.5 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-9 h-9"
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar fitxer"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="w-9 h-9 bg-[#AE0001] hover:bg-[#8a0001]"
                    onClick={handleSend}
                    disabled={!messageText.trim() || sendMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Els missatges es tradueixen automàticament a EN / ES / CA
              </p>
            </div>
          </>
        )}

        {/* ── Assignments tab ───────────────────────────────────────────────── */}
        {tab === "assignments" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-[40vh] md:min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">{t("connect_tasks_heading")}</h2>
              {canManage && (
                <Button
                  size="sm"
                  className="bg-[#AE0001] hover:bg-[#8a0001] gap-1.5"
                  onClick={() => setShowCreateAssignment(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("connect_new_task_btn")}
                </Button>
              )}
            </div>

            {assignmentsQuery.isLoading ? (
              <div className="text-muted-foreground text-sm">{t("connect_loading_tasks")}</div>
            ) : (assignmentsQuery.data ?? []).length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("connect_no_tasks")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(assignmentsQuery.data ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="border border-border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{a.title}</p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {a.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {a.dueDate && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(a.dueDate).toLocaleDateString("ca-ES")}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          Màx: {a.maxScore} pts
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Files tab ─────────────────────────────────────────────────────── */}
        {tab === "files" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-[40vh] md:min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">{t("connect_files_heading")}</h2>
              <div>
                <input
                  type="file"
                  id="files-tab-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                />
                <Button
                  size="sm"
                  className="bg-[#AE0001] hover:bg-[#8a0001] gap-1.5"
                  onClick={() => document.getElementById("files-tab-upload")?.click()}
                  disabled={uploadFileMutation.isPending}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("connect_upload_file_btn")}
                </Button>
              </div>
            </div>

            {filesQuery.isLoading ? (
              <div className="text-muted-foreground text-sm">{t("connect_loading_files")}</div>
            ) : (filesQuery.data ?? []).length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("connect_no_files")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(filesQuery.data ?? []).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card hover:shadow-sm transition-shadow"
                  >
                    <span className="text-2xl shrink-0">{fileIcon(f.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.fileSize ? `${(f.fileSize / 1024).toFixed(1)} KB · ` : ""}
                        {new Date(f.uploadedAt).toLocaleDateString("ca-ES")}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <a href={f.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="ghost" className="w-8 h-8" title={t("connect_download")}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      {(f.uploadedBy === user?.openId || canDeleteOthers) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 text-destructive"
                          onClick={() => deleteFileMutation.mutate({ fileId: f.id })}
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Members right sidebar ───────────────────────────────────────────── */}
      <aside
        className={`${
          membersOpen ? "w-full md:w-56 max-h-[40vh] md:max-h-none" : "w-0 max-h-0 md:max-h-none"
        } transition-all duration-200 overflow-hidden shrink-0 border-l border-border flex flex-col bg-card`}
      >
        {/* Members header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#003082]" />
            <span className="font-semibold text-sm">{t("connect_members")}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Circle className="w-2 h-2 fill-green-500 text-green-500 mr-1" />
            {onlineCount}
          </Badge>
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto py-2">
          {membersQuery.isLoading ? (
            <div className="px-4 py-2 text-xs text-muted-foreground">{t("connect_loading")}</div>
          ) : members.length === 0 ? (
            <div className="px-4 py-4 text-xs text-muted-foreground text-center">
              {t("connect_no_members")}
            </div>
          ) : (
            <>
              {/* Online members */}
              {members.filter((m) => m.online).length > 0 && (
                <div>
                  <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("connect_online")} — {members.filter((m) => m.online).length}
                  </p>
                  {members.filter((m) => m.online).map((m) => (
                    <div
                      key={m.id}
                      className="group/member w-full flex items-center gap-2.5 px-4 py-1.5 hover:bg-blue-900/30 transition-colors rounded"
                    >
                      <div className="relative shrink-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: "#003082" }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 absolute -bottom-0.5 -right-0.5" />
                      </div>
                      <span className="text-sm truncate flex-1 text-left">{m.name}</span>
                      {/* Video + Audio call buttons — always visible on mobile, hover-reveal on desktop */}
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/member:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => handleMemberCall(m.id, m.name, false)}
                          title={t("connect_click_to_call")}
                          className="p-2 sm:p-1 rounded hover:bg-blue-700 active:bg-blue-700 text-green-400 hover:text-white transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        >
                          <Video className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMemberCall(m.id, m.name, true)}
                          title={t("call_audio_only_label")}
                          className="p-2 sm:p-1 rounded hover:bg-blue-700 active:bg-blue-700 text-green-400 hover:text-white transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        >
                          <Phone className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                        <button
                          onClick={() => { setDmPartner({ id: m.id, name: m.name }); setMembersOpen(false); }}
                          title="Send direct message"
                          className="p-2 sm:p-1 rounded hover:bg-blue-700 active:bg-blue-700 text-purple-300 hover:text-white transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        >
                          <MessageCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                        <button
                          onClick={() => setMeetInviteTarget({ id: m.id, name: m.name })}
                          title="Schedule a meeting"
                          className="p-2 sm:p-1 rounded hover:bg-blue-700 active:bg-blue-700 text-blue-300 hover:text-white transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        >
                          <CalendarPlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Offline members */}
              {members.filter((m) => !m.online).length > 0 && (
                <div className="mt-2">
                  <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("connect_offline")} — {members.filter((m) => !m.online).length}
                  </p>
                  {members.filter((m) => !m.online).map((m) => (
                    <div
                      key={m.id}
                      className="group/offline flex items-center gap-2.5 px-4 py-1.5 hover:bg-muted/50 transition-colors opacity-60 hover:opacity-90"
                    >
                      <div className="relative shrink-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: "#6b7280" }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <Circle className="w-2.5 h-2.5 fill-gray-400 text-gray-400 absolute -bottom-0.5 -right-0.5" />
                      </div>
                      <span className="text-sm truncate flex-1">{m.name}</span>
                      {/* Schedule meeting button — always visible on mobile, hover-reveal on desktop */}
                        <button
                          onClick={() => setMeetInviteTarget({ id: m.id, name: m.name })}
                          title="Schedule a meeting"
                          className="p-2 sm:p-1 rounded opacity-100 sm:opacity-0 sm:group-hover/offline:opacity-100 hover:bg-blue-700 active:bg-blue-700 text-blue-400 hover:text-white transition-all min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        >
                        <CalendarPlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Call History Panel ──────────────────────────────────────────── */}
        <CallHistoryPanel myId={myDbId} onRejoin={(roomName, partnerName) => {
          setDmCallRoom({ roomName, partnerName });
          setPreCallActive(true);
        }} />

        {/* ── Meeting History Panel ──────────────────────────────────────── */}
        <MeetingHistoryPanel
          myId={myDbId}
          onJoin={(roomName, title) => {
            setDmCallRoom({ roomName, partnerName: title });
            setPreCallActive(true);
          }}
          onReschedule={(prefill) => {
            setReschedulePrefill({ title: prefill.title, agenda: prefill.agenda, recurrence: prefill.recurrence });
            setMeetInviteTarget({ id: prefill.toUserId, name: prefill.toName });
          }}
        />
      </aside>
      {/* ── DM Panel overlay ─────────────────────────────────────────────── */}
      {dmPartner && myDbId && (
        <div className="fixed inset-0 z-[60] flex items-stretch md:items-end md:justify-end pointer-events-none">
          {/* Backdrop (mobile only) */}
          <div
            className="absolute inset-0 bg-black/40 md:hidden pointer-events-auto"
            onClick={() => setDmPartner(null)}
          />
          {/* Panel */}
          <div className="relative pointer-events-auto w-full md:w-96 h-full md:h-[calc(100dvh-4rem)] md:rounded-tl-2xl md:rounded-bl-2xl shadow-2xl overflow-hidden flex flex-col">
            <DMPanel
              partnerId={dmPartner.id}
              partnerName={dmPartner.name}
              myId={myDbId}
              onClose={() => setDmPartner(null)}
            />
          </div>
        </div>
      )}
      {/* ── Pre-Call Setup Dialog ─────────────────────────────────────────── */}
      <Dialog open={preCallActive} onOpenChange={(open) => { if (!open) { setPreCallActive(false); if (!open) setDmCallRoom(null); } }}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden rounded-xl" style={{ height: "560px" }}>
          <PreCallScreen
            roomName={dmCallRoom ? dmCallRoom.roomName : `seba-connect-${selectedChannelId}`}
            channelName={dmCallRoom ? dmCallRoom.partnerName : (selectedChannel?.name ?? t("connect_video_call"))}
            sebaLogoUrl="/manus-storage/SEBA_hd_new_b460fab2.png"
            schoolLogoUrl={schoolLogo ?? undefined}
            onJoin={(opts) => {
              setCallOpts(opts);
              setPreCallActive(false);
              setVideoCallActive(true);
            }}
            onCancel={() => setPreCallActive(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Video Call Dialog ───────────────────────────────────────────────── */}
      <Dialog open={videoCallActive} onOpenChange={(open) => {
          if (!open) {
            // Stop screen share when dialog closes
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
            setScreenSharing(false);
            // Record call end in DB
            if (activeCallId) {
              endCallMutation.mutate({ callId: activeCallId });
              setActiveCallId(null);
            }
            // Clear DM room so next call starts fresh
            setDmCallRoom(null);
          }
          setVideoCallActive(open);
        }}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden rounded-none sm:rounded-xl bg-[#003082] mx-0 sm:mx-4 h-[100dvh] sm:h-auto flex flex-col">
          {/* Branded header: SEBA S + logo left, channel name centre, school logo right */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#003082] text-white">
            {/* Left: S symbol + SEBA wordmark */}
            <div className="flex items-center gap-2 min-w-[140px]">
              <SebaSymbol size={28} color="white" bg="#1a4fa0" className="shrink-0" />
              <img
                src="/manus-storage/SEBA_hd_new_b460fab2.png"
                alt="SEBA"
                className="h-6 object-contain brightness-0 invert"
              />
            </div>
            {/* Centre: channel/partner name */}
            <DialogTitle className="text-sm font-semibold text-white tracking-wide">
              {dmCallRoom ? dmCallRoom.partnerName : (selectedChannel?.name ?? t("connect_video_call"))}
            </DialogTitle>
            {/* Right: school logo (if uploaded) */}
            <div className="flex items-center justify-end min-w-[120px]">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt="School logo"
                  className="h-8 max-w-[100px] object-contain rounded"
                />
              ) : (
                <span className="text-xs text-white/40 italic">{t("logo_label")}</span>
              )}
            </div>
          </div>
          {/* Call toolbar: reactions, screen share, recording */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#001f5a] border-b border-[#002a7a]">
            {/* Left: reaction buttons */}
            <div className="flex items-center gap-1.5">
              {(["\u270b", "\uD83D\uDC4D", "\uD83D\uDC4F", "\uD83D\uDE04", "\u2764\uFE0F"] as const).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className={`text-base px-2 py-0.5 rounded-md transition-all hover:scale-125 ${
                    activeReaction === emoji ? "bg-yellow-500/30 scale-125" : "hover:bg-white/10"
                  }`}
                  title={emoji === "\u270b" ? "Raise hand" : "React"}
                >
                  {emoji}
                </button>
              ))}
              {activeReaction && (
                <span className="text-xs text-yellow-300 animate-pulse ml-1">{activeReaction} Reacting…</span>
              )}
            </div>

            {/* Right: screen share + recording */}
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (screenSharing) {
                    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
                    screenStreamRef.current = null;
                    setScreenSharing(false);
                  } else {
                    try {
                      const stream = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (opts?: object) => Promise<MediaStream> }).getDisplayMedia({ video: true, audio: true });
                      screenStreamRef.current = stream;
                      stream.getVideoTracks()[0].onended = () => {
                        screenStreamRef.current = null;
                        setScreenSharing(false);
                      };
                      setScreenSharing(true);
                    } catch (_) { /* user cancelled */ }
                  }
                }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors ${
                  screenSharing
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white/80"
                }`}
              >
                {screenSharing ? <ScreenShareOff className="w-3.5 h-3.5" /> : <ScreenShare className="w-3.5 h-3.5" />}
                {screenSharing ? "Stop sharing" : "Share screen"}
              </button>

              {/* Recording notice toggle */}
              <button
                onClick={() => setIsRecording((r) => !r)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white/80"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  isRecording ? "bg-white animate-pulse" : "bg-white/50"
                }`} />
                {isRecording ? "Recording" : "Record"}
              </button>
            </div>
          </div>

          {/* Recording notice banner */}
          {isRecording && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-red-900/60 border-b border-red-800 text-xs text-red-200">
              <span>● This call is being recorded. All participants have been notified.</span>
              <button onClick={() => setIsRecording(false)} className="text-red-300 hover:text-white ml-4">✕</button>
            </div>
          )}
          {/* SebaMeet — sovereign WebRTC video engine.
               Props are stabilised with useMemo/useCallback so React.memo
               on SebaMeet can bail out and prevent flicker on parent re-renders. */}
          <div className="relative w-full flex-1 sm:flex-none" style={{ height: "min(520px, calc(100dvh - 180px))", minHeight: 0 }}>
            <SebaMeetStable
              dmCallRoom={dmCallRoom}
              selectedChannelId={selectedChannelId}
              channelsData={channelsQuery.data}
              callOpts={callOpts}
              schoolLogo={schoolLogo}
              callId={activeCallId}
              setVideoCallActive={setVideoCallActive}
              setDmCallRoom={setDmCallRoom}
              setCallOpts={setCallOpts}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Channel Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("connect_new_channel_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder={t("connect_channel_name_placeholder")}
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
            <Textarea
              placeholder={t("connect_description_placeholder")}
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
              rows={2}
            />
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={newChannelType}
              onChange={(e) => setNewChannelType(e.target.value as typeof newChannelType)}
            >
              <option value="general">{t("connect_channel_type_general")}</option>
              <option value="subject">{t("connect_channel_type_subject")}</option>
              <option value="year_group">{t("connect_channel_type_year_group")}</option>
              <option value="announcement">{t("connect_channel_type_announcement")}</option>
            </select>
            <Button
              className="w-full bg-[#AE0001] hover:bg-[#8a0001]"
              onClick={() =>
                createChannelMutation.mutate({
                  name: newChannelName,
                  description: newChannelDesc || undefined,
                  type: newChannelType,
                })
              }
              disabled={!newChannelName.trim() || createChannelMutation.isPending}
            >
              {t("connect_create_channel_btn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Assignment Dialog ───────────────────────────────────────── */}
      <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("connect_new_task_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder={t("connect_task_title_placeholder")}
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
            />
            <Textarea
              placeholder={t("connect_description_placeholder")}
              value={assignDesc}
              onChange={(e) => setAssignDesc(e.target.value)}
              rows={3}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("connect_due_date_label")}</label>
              <Input
                type="date"
                value={assignDue}
                onChange={(e) => setAssignDue(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-[#AE0001] hover:bg-[#8a0001]"
              onClick={() =>
                createAssignmentMutation.mutate({
                  channelId: selectedChannelId,
                  title: assignTitle,
                  description: assignDesc || undefined,
                  dueDate: assignDue || undefined,
                })
              }
              disabled={!assignTitle.trim() || createAssignmentMutation.isPending}
            >
              {t("connect_create_task_btn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Incoming Call Banner ─────────────────────────────────────────── */}
      {/* ── Meeting Invitation Modal ─────────────────────────────────────── */}
      {meetInviteTarget && (
        <SendMeetingInvitationModal
          open={!!meetInviteTarget}
          onOpenChange={(open) => { if (!open) { setMeetInviteTarget(null); setReschedulePrefill(null); } }}
          toUserId={meetInviteTarget.id}
          toUserName={meetInviteTarget.name}
          prefillTitle={reschedulePrefill?.title}
          prefillAgenda={reschedulePrefill?.agenda}
          prefillRecurrence={reschedulePrefill?.recurrence}
        />
      )}

      {/* ── Meeting Invitation Banner ────────────────────────────────────── */}
      <MeetingInvitationBanner
        onAccept={(roomName, title) => {
          setDmCallRoom({ roomName, partnerName: title });
          setPreCallActive(true);
        }}
      />

      <IncomingCallBanner
        onAccept={(roomName, callerName, audioOnly) => {
          setDmCallRoom({ roomName, partnerName: callerName });
          if (audioOnly) {
            // Skip pre-call screen for audio-only accepted calls
            setVideoCallActive(true);
          } else {
            setPreCallActive(true);
          }
        }}
      />

      {/* ── Mobile bottom navigation bar ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card flex items-center justify-around px-1 py-1 safe-area-inset-bottom">
        {/* Channels (sidebar toggle) */}
        <button
          type="button"
          onClick={() => { setSidebarOpen((o) => !o); setMembersOpen(false); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            sidebarOpen ? "text-[#AE0001] bg-[#AE0001]/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">{t("connect_channels_heading")}</span>
        </button>

        {/* Messages */}
        <button
          type="button"
          onClick={() => { setTab("messages"); setSidebarOpen(false); setMembersOpen(false); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            tab === "messages" && !sidebarOpen && !membersOpen ? "text-[#AE0001] bg-[#AE0001]/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">{t("connect_messages")}</span>
        </button>

        {/* Assignments */}
        <button
          type="button"
          onClick={() => { setTab("assignments"); setSidebarOpen(false); setMembersOpen(false); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            tab === "assignments" && !sidebarOpen && !membersOpen ? "text-[#AE0001] bg-[#AE0001]/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">{t("connect_assignments")}</span>
        </button>

        {/* Files */}
        <button
          type="button"
          onClick={() => { setTab("files"); setSidebarOpen(false); setMembersOpen(false); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            tab === "files" && !sidebarOpen && !membersOpen ? "text-[#AE0001] bg-[#AE0001]/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">{t("connect_files")}</span>
        </button>

        {/* DMs */}
        <button
          type="button"
          onClick={() => { setSidebarOpen(false); setMembersOpen(true); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative ${
            dmPartner ? "text-purple-600 bg-purple-600/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">DMs</span>
        </button>

        {/* Members (right panel toggle) */}
        <button
          type="button"
          onClick={() => { setMembersOpen((o) => !o); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            membersOpen ? "text-[#003082] bg-[#003082]/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">{t("connect_members")}</span>
        </button>
      </nav>
    </div>
  );
}
