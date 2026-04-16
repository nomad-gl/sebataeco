/**
 * SEBA Connect — Espai de Col·laboració
 *
 * A Teams-style collaboration space with:
 * - Channel sidebar (General, Anuncis, Claustre, subject channels)
 * - Message thread with auto-translation (EN/ES/CA)
 * - Assignments tab per channel
 * - Files tab per channel (S3-backed)
 * - Catalan sovereignty identity (senyera accent colours)
 */

import { useState, useRef, useEffect, useCallback } from "react";
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
  CheckCircle,
  Clock,
  Download,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";

// ─── types ────────────────────────────────────────────────────────────────────

type Tab = "messages" | "assignments" | "files";

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

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Avui";
  if (d.toDateString() === yesterday.toDateString()) return "Ahir";
  return d.toLocaleDateString("ca-ES", { day: "numeric", month: "long" });
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
}: {
  msg: Message;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
  onEdit: (msg: Message) => void;
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
          {msg.editedAt && <span className="text-xs text-muted-foreground italic">(editat)</span>}
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
              {msg.attachmentName ?? "Fitxer adjunt"}
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
  const { t, lang: currentLang } = useI18n();
  const lang = (currentLang === "ca" ? "ca" : currentLang === "es" ? "es" : "en") as "en" | "es" | "ca";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pos = (user as { position?: string } | null)?.position ?? "unassigned";
  const canManage = ["teacher", "head_of_study", "director"].includes(pos);
  const canDeleteOthers = pos === "director" || pos === "head_of_study";

  // ── queries ────────────────────────────────────────────────────────────────

  const channelsQuery = trpc.teams.getChannels.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const messagesQuery = trpc.teams.getMessages.useQuery(
    { channelId: selectedChannelId, lang },
    { refetchInterval: 3000, enabled: tab === "messages" }
  );

  const assignmentsQuery = trpc.teams.getAssignments.useQuery(
    { channelId: selectedChannelId },
    { enabled: tab === "assignments" }
  );

  const filesQuery = trpc.teams.getFiles.useQuery(
    { channelId: selectedChannelId },
    { enabled: tab === "files" }
  );

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  // ── handlers ───────────────────────────────────────────────────────────────

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

  // ─── render ─────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Cal iniciar sessió per accedir a SEBA Connect.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-200 overflow-hidden shrink-0 border-r border-border flex flex-col bg-card`}
      >
        {/* Sidebar header */}
        <div
          className="px-4 py-3 border-b border-border"
          style={{ background: "linear-gradient(135deg, #AE0001 0%, #003082 100%)" }}
        >
          <div className="flex items-center gap-2">
            <SebaSymbol className="w-5 h-5 text-white" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">SEBA Connect</p>
              <p className="text-white/70 text-xs">Espai de Col·laboració</p>
            </div>
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Canals
            </span>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="w-5 h-5"
                onClick={() => setShowCreateChannel(true)}
                title="Crear canal"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {channelsQuery.isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Carregant…</div>
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

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Channel header */}
        <div className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-card">
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

          {/* Tab bar */}
          <div className="ml-auto flex items-center gap-1">
            {(["messages", "assignments", "files"] as Tab[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "default" : "ghost"}
                className={`gap-1.5 text-xs h-7 ${tab === t ? "bg-[#AE0001] hover:bg-[#8a0001]" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "messages" && <MessageSquare className="w-3.5 h-3.5" />}
                {t === "assignments" && <ClipboardList className="w-3.5 h-3.5" />}
                {t === "files" && <FolderOpen className="w-3.5 h-3.5" />}
                {t === "messages" ? "Missatges" : t === "assignments" ? "Tasques" : "Fitxers"}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Messages tab ──────────────────────────────────────────────────── */}
        {tab === "messages" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messagesQuery.isLoading ? (
                <div className="text-center text-muted-foreground text-sm py-8">Carregant missatges…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-16">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Encara no hi ha missatges en aquest canal.</p>
                  <p className="text-xs mt-1">Sigues el primer a escriure!</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const showDate =
                      !prevMsg ||
                      formatDate(msg.createdAt) !== formatDate(prevMsg.createdAt);
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-2 my-4">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground px-2">
                              {formatDate(msg.createdAt)}
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
                              Desar
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
                  placeholder={`Escriu un missatge a #${selectedChannel?.name ?? "canal"}…`}
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
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Tasques del canal</h2>
              {canManage && (
                <Button
                  size="sm"
                  className="bg-[#AE0001] hover:bg-[#8a0001] gap-1.5"
                  onClick={() => setShowCreateAssignment(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova tasca
                </Button>
              )}
            </div>

            {assignmentsQuery.isLoading ? (
              <div className="text-muted-foreground text-sm">Carregant tasques…</div>
            ) : (assignmentsQuery.data ?? []).length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Cap tasca en aquest canal.</p>
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
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Fitxers del canal</h2>
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
                  Pujar fitxer
                </Button>
              </div>
            </div>

            {filesQuery.isLoading ? (
              <div className="text-muted-foreground text-sm">Carregant fitxers…</div>
            ) : (filesQuery.data ?? []).length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Cap fitxer en aquest canal.</p>
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
                        <Button size="icon" variant="ghost" className="w-8 h-8" title="Descarregar">
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

      {/* ── Create Channel Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nou canal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Nom del canal"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
            <Textarea
              placeholder="Descripció (opcional)"
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
              rows={2}
            />
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={newChannelType}
              onChange={(e) => setNewChannelType(e.target.value as typeof newChannelType)}
            >
              <option value="general">General</option>
              <option value="subject">Assignatura</option>
              <option value="year_group">Curs / Grup</option>
              <option value="announcement">Anunci oficial</option>
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
              Crear canal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Assignment Dialog ───────────────────────────────────────── */}
      <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tasca</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Títol de la tasca"
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
            />
            <Textarea
              placeholder="Descripció (opcional)"
              value={assignDesc}
              onChange={(e) => setAssignDesc(e.target.value)}
              rows={3}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data límit (opcional)</label>
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
              Crear tasca
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
