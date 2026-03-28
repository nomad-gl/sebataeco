import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NavBar from "@/components/NavBar";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ExternalLink, BookOpen, Presentation, Grid3X3, AlignLeft, Search, CreditCard, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

const TYPE_ICONS: Record<string, React.ElementType> = {
  quiz: BookOpen,
  slides: Presentation,
  crossword: Grid3X3,
  missing_words: AlignLeft,
  wordsearch: Search,
  flashcards: CreditCard,
};

const TYPE_COLORS: Record<string, string> = {
  quiz:          "from-blue-500 to-blue-600",
  slides:        "from-purple-500 to-purple-600",
  crossword:     "from-green-500 to-green-600",
  missing_words: "from-amber-500 to-amber-600",
  wordsearch:    "from-rose-500 to-rose-600",
  flashcards:    "from-teal-500 to-teal-600",
};

export default function MyMaterials() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: materials, isLoading } = trpc.materials.list.useQuery(undefined, { enabled: !!user });
  const deleteMutation = trpc.materials.delete.useMutation({
    onSuccess: () => {
      toast.success("Material deleted.");
      utils.materials.list.invalidate();
    },
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">Sign in to view your materials</h2>
              <Button asChild className="w-full">
                <a href={getLoginUrl()}>Sign in</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <div className="container py-8 max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Materials</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {materials?.length ?? 0} saved {materials?.length === 1 ? "activity" : "activities"}
            </p>
          </div>
          <Button onClick={() => navigate("/create")} className="gap-2">
            <Plus className="w-4 h-4" /> Create New
          </Button>
        </div>

        {!materials || materials.length === 0 ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">No materials yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first LOMLOE-aligned teaching activity.
                </p>
              </div>
              <Button onClick={() => navigate("/create")} className="gap-2">
                <Plus className="w-4 h-4" /> Create Material
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {materials.map((m) => {
              const Icon = TYPE_ICONS[m.type] ?? BookOpen;
              const colorClass = TYPE_COLORS[m.type] ?? "from-gray-400 to-gray-500";
              return (
                <Card key={m.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {m.type.replace("_", " ")}
                        </Badge>
                        {m.competency && <Badge variant="outline" className="text-xs">{m.competency}</Badge>}
                        {m.yearGroup && <Badge variant="outline" className="text-xs capitalize">{m.yearGroup}</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="outline" className="gap-1.5"
                        onClick={() => navigate(`/materials/${m.id}`)}>
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Delete this material?")) deleteMutation.mutate({ id: m.id }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center pb-4">Powered by SEBA</p>
      </div>
    </div>
  );
}
