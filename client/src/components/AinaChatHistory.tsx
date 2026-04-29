import { useState, useMemo } from "react";
import { Search, Trash2, MessageSquare, Clock, ChevronRight, Plus } from "lucide-react";
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

interface AinaChatHistoryProps {
  activeSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  onNewChat: () => void;
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

export function AinaChatHistory({ activeSessionId, onSelectSession, onNewChat }: AinaChatHistoryProps) {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

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
              "group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors",
              activeSessionId === s.id
                ? "bg-white/20 text-white"
                : "hover:bg-white/10 text-white/80"
            )}
            onClick={() => onSelectSession(s.id)}
          >
            <MessageSquare className="size-3.5 mt-0.5 flex-shrink-0 text-white/50" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate leading-tight">{s.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="size-2.5 text-white/30" />
                <span className="text-[10px] text-white/40">{timeAgo(s.updatedAt)}</span>
                <span className="text-[10px] text-white/30">·</span>
                <span className="text-[10px] text-white/40">{s.messageCount} msg{s.messageCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 opacity-0 group-hover:opacity-100 flex-shrink-0 text-white/50 hover:text-red-400 hover:bg-red-400/10"
              onClick={(e) => { e.stopPropagation(); setDeleteId(s.id); }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-sm border-r border-white/10 w-64 flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <Button
          size="sm"
          onClick={onNewChat}
          className="w-full bg-white/15 hover:bg-white/25 text-white border border-white/20 gap-1.5 text-xs"
          variant="outline"
        >
          <Plus className="size-3.5" />
          New Chat
        </Button>
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
        <div className="p-2 border-t border-white/10">
          <p className="text-[10px] text-white/30 text-center">
            {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

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
    </div>
  );
}
