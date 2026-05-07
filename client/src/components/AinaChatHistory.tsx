import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Search, Trash2, MessageSquare, Clock, Plus, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256; // w-64
const COLLAPSED_WIDTH = 48;
const STORAGE_KEY = "aina_history_width";
const COLLAPSED_KEY = "aina_history_collapsed";

interface AinaChatHistoryProps {
  activeSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  onNewChat: () => void;
  /** Called whenever the sidebar width changes so Chat.tsx can react if needed */
  onWidthChange?: (width: number) => void;
  /** Called when the user wants to fully close/hide the history panel */
  onClose?: () => void;
}

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function AinaChatHistory({ activeSessionId, onSelectSession, onNewChat, onWidthChange, onClose }: AinaChatHistoryProps) {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);

  // ── Collapsed state ───────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch { return false; }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      onWidthChange?.(next ? COLLAPSED_WIDTH : width);
      return next;
    });
  }, [onWidthChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resizable width ──────────────────────────────────────────────────────
  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
      }
    } catch { /* ignore */ }
    return DEFAULT_WIDTH;
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width, collapsed]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
      onWidthChange?.(next);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidth((w) => {
        try { localStorage.setItem(STORAGE_KEY, String(w)); } catch { /* ignore */ }
        return w;
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onWidthChange]);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: sessions = [], refetch } = trpc.lomloe.listChatSessions.useQuery(undefined, {
    staleTime: 10_000,
  });

  const deleteMutation = trpc.lomloe.deleteChatSession.useMutation({
    onSuccess: () => {
      toast.success("Chat deleted");
      refetch();
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete chat"),
  });

  const clearAllMutation = trpc.lomloe.clearAllChatSessions.useMutation({
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} conversation${data.deleted !== 1 ? "s" : ""}`);
      refetch();
      setShowClearAll(false);
      onNewChat();
    },
    onError: () => toast.error("Failed to clear history"),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search]);

  // Group by date
  const grouped = useMemo(() => {
    const today: typeof filtered = [];
    const yesterday: typeof filtered = [];
    const thisWeek: typeof filtered = [];
    const older: typeof filtered = [];
    const now = Date.now();
    filtered.forEach((s) => {
      const d = new Date(s.updatedAt).getTime();
      const diff = now - d;
      if (diff < 86400000) today.push(s);
      else if (diff < 172800000) yesterday.push(s);
      else if (diff < 604800000) thisWeek.push(s);
      else older.push(s);
    });
    return { today, yesterday, thisWeek, older };
  }, [filtered]);

  const renderGroup = (label: string, items: typeof filtered) => {
    if (items.length === 0) return null;
    return (
      <div key={label} className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-2 py-1">{label}</p>
        {items.map((s) => (
          <div
            key={s.id}
            className={cn(
              "group relative flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-colors",
              activeSessionId === s.id
                ? "bg-white/20 text-white"
                : "hover:bg-white/10 text-white/80"
            )}
            onClick={() => onSelectSession(s.id)}
          >
            <MessageSquare className="size-3.5 flex-shrink-0 text-white/50" />
            {/* Text area: truncates title to max 30 characters */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium truncate leading-tight" title={s.title}>
                {s.title.length > 30 ? s.title.slice(0, 30) + "…" : s.title}
              </p>
              <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                <Clock className="size-2.5 flex-shrink-0 text-white/30" />
                <span className="text-[10px] text-white/40 truncate">{timeAgo(s.updatedAt)}</span>
              </div>
            </div>
            {/* Share button */}
            <button
              className="flex-shrink-0 flex items-center justify-center size-6 rounded text-white/50 hover:text-blue-400 hover:bg-blue-400/15 active:bg-blue-400/25 transition-colors touch-manipulation"
              title="Share chat"
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.share) {
                  navigator.share({
                    title: s.title,
                    text: `Chat: ${s.title}`,
                    url: window.location.origin + "/chat?session=" + s.id,
                  }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.origin + "/chat?session=" + s.id);
                  toast.success("Link copied to clipboard");
                }
              }}
            >
              <Share2 className="size-3.5" />
            </button>
            {/* Delete button — always visible */}
            <button
              className="flex-shrink-0 flex items-center justify-center size-6 rounded text-white/50 hover:text-red-400 hover:bg-red-400/15 active:bg-red-400/25 transition-colors touch-manipulation"
              title="Delete chat"
              onClick={(e) => { e.stopPropagation(); setDeleteId(s.id); }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // ── Collapsed (icon-only) view ────────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        className="relative flex flex-col items-center h-full overflow-hidden bg-white/5 backdrop-blur-sm border-r border-white/10 flex-shrink-0 transition-all duration-200"
        style={{ width: COLLAPSED_WIDTH }}
      >
        {/* New Chat icon */}
        <button
          onClick={onNewChat}
          title="New Chat"
          className="mt-5 flex items-center justify-center size-8 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
        >
          <Plus className="size-4" />
        </button>

        {/* Session icons — scrollable */}
        <ScrollArea className="flex-1 w-full py-2">
          <div className="flex flex-col items-center gap-1 px-1">
            {sessions.slice(0, 40).map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                title={s.title}
                className={cn(
                  "flex items-center justify-center size-8 rounded-lg transition-colors",
                  activeSessionId === s.id
                    ? "bg-white/25 text-white"
                    : "hover:bg-white/15 text-white/60 hover:text-white"
                )}
              >
                <MessageSquare className="size-3.5" />
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Expand toggle at bottom */}
        <button
          onClick={toggleCollapsed}
          title="Expand sidebar"
          className="mb-3 flex items-center justify-center size-8 rounded-lg hover:bg-white/15 text-white/50 hover:text-white transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>

        {/* Close panel entirely (if onClose provided) */}
        {onClose && (
          <button
            onClick={onClose}
            title="Hide history"
            className="mb-2 flex items-center justify-center size-8 rounded-lg hover:bg-white/15 text-white/40 hover:text-white/80 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>
    );
  }

  // ── Expanded view ─────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex flex-col h-full overflow-hidden bg-white/5 backdrop-blur-sm border-r border-white/10 flex-shrink-0 transition-all duration-200"
      style={{ width }}
    >
      {/* Header */}
      <div className="px-3 pt-4 pb-3 border-b border-white/10 flex items-center gap-2">
        <Button
          size="sm"
          onClick={onNewChat}
          className="flex-1 bg-white/15 hover:bg-white/25 text-white border border-white/20 gap-1.5 text-xs"
          variant="outline"
        >
          <Plus className="size-3.5" />
          New Chat
        </Button>
        {/* Collapse to icon-only */}
        <button
          onClick={toggleCollapsed}
          title="Collapse sidebar"
          className="flex-shrink-0 flex items-center justify-center size-7 rounded-lg hover:bg-white/15 text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        {/* Close panel entirely — shown on mobile where the outer toggle strip is hidden */}
        {onClose && (
          <button
            onClick={onClose}
            title="Close history"
            className="sm:hidden flex-shrink-0 flex items-center justify-center size-7 rounded-lg hover:bg-white/15 text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history..."
            className="pl-8 h-7 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
          />
        </div>
      </div>

      {/* Sessions list */}
      <ScrollArea className="flex-1 px-1 py-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-3 text-center">
            <MessageSquare className="size-8 text-white/20" />
            <p className="text-xs text-white/40">No chat history yet</p>
            <p className="text-[10px] text-white/30">Your conversations will appear here</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-3 text-center">
            <Search className="size-8 text-white/20" />
            <p className="text-xs text-white/40">No results for "{search}"</p>
          </div>
        ) : (
          <>
            {renderGroup("Today", grouped.today)}
            {renderGroup("Yesterday", grouped.yesterday)}
            {renderGroup("This week", grouped.thisWeek)}
            {renderGroup("Older", grouped.older)}
          </>
        )}
      </ScrollArea>

      {/* Footer */}
      {sessions.length > 0 && (
        <div className="p-2 border-t border-white/10 flex flex-col items-center gap-1">
          <p className="text-[10px] text-white/30 text-center">
            {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => setShowClearAll(true)}
            className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
          >
            Clear all history
          </button>
        </div>
      )}

      {/* Resize handle — right edge */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 w-2 h-full flex items-center justify-center cursor-col-resize z-10 group/resize"
        title="Drag to resize"
      >
        <div className="w-0.5 h-12 rounded-full bg-white/10 group-hover/resize:bg-white/40 transition-colors" />
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ sessionId: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all confirmation */}
      <AlertDialog open={showClearAll} onOpenChange={(o) => !o && setShowClearAll(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {sessions.length} conversation{sessions.length !== 1 ? "s" : ""} and their messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
            >
              {clearAllMutation.isPending ? "Clearing..." : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
