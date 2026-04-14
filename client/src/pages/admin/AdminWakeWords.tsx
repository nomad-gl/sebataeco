import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Mic, Plus, Trash2, Star, StarOff, X, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function AdminWakeWords() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const { data: words = [], isLoading } = trpc.wakeWords.getAll.useQuery();

  const addMutation = trpc.wakeWords.add.useMutation({
    onSuccess: () => {
      utils.wakeWords.getAll.invalidate();
      utils.wakeWords.getActive.invalidate();
      setNewWord("");
      setNewVariants("");
      toast.success(t("wake_word_added"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.wakeWords.delete.useMutation({
    onSuccess: () => {
      utils.wakeWords.getAll.invalidate();
      utils.wakeWords.getActive.invalidate();
      toast.success(t("wake_word_deleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActiveMutation = trpc.wakeWords.toggleActive.useMutation({
    onSuccess: () => {
      utils.wakeWords.getAll.invalidate();
      utils.wakeWords.getActive.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setPrimaryMutation = trpc.wakeWords.setPrimary.useMutation({
    onSuccess: () => {
      utils.wakeWords.getAll.invalidate();
      utils.wakeWords.getActive.invalidate();
      toast.success(t("wake_word_set_primary"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateVariantsMutation = trpc.wakeWords.updateVariants.useMutation({
    onSuccess: () => {
      utils.wakeWords.getAll.invalidate();
      utils.wakeWords.getActive.invalidate();
      toast.success(t("wake_word_variants_saved"));
    },
    onError: (e) => toast.error(e.message),
  });

  const [newWord, setNewWord] = useState("");
  const [newVariants, setNewVariants] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editVariants, setEditVariants] = useState<Record<number, string>>({});

  const handleAdd = () => {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    const variants = newVariants
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    addMutation.mutate({ word, phoneticVariants: variants, isPrimary: words.length === 0 });
  };

  const handleSaveVariants = (id: number) => {
    const raw = editVariants[id] ?? "";
    const variants = raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    updateVariantsMutation.mutate({ id, phoneticVariants: variants });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10">
          <Mic className="w-5 h-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t("wake_words_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("wake_words_desc")}</p>
        </div>
      </div>

      {/* Add new word */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("wake_word_add_new")}</CardTitle>
          <CardDescription>{t("wake_word_add_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t("wake_word_placeholder")}
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={!newWord.trim() || addMutation.isPending}>
              <Plus className="w-4 h-4 mr-1" />
              {t("wake_word_add_btn")}
            </Button>
          </div>
          <Input
            placeholder={t("wake_word_variants_placeholder")}
            value={newVariants}
            onChange={(e) => setNewVariants(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">{t("wake_word_variants_hint")}</p>
        </CardContent>
      </Card>

      {/* Word list */}
      <div className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">{t("loading")}</p>
        )}
        {!isLoading && words.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">{t("wake_words_empty")}</p>
        )}
        {words.map((w) => {
          const variants: string[] = (() => {
            try { return JSON.parse(w.phoneticVariants); } catch { return []; }
          })();
          const isExpanded = expandedId === w.id;
          const editVal = editVariants[w.id] ?? variants.join(", ");

          return (
            <Card key={w.id} className={`transition-all ${!w.isActive ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Primary star */}
                  <button
                    title={w.isPrimary ? t("wake_word_is_primary") : t("wake_word_set_primary")}
                    onClick={() => !w.isPrimary && setPrimaryMutation.mutate({ id: w.id })}
                    className={`shrink-0 transition-colors ${w.isPrimary ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
                  >
                    {w.isPrimary ? <Star className="w-4 h-4 fill-yellow-400" /> : <StarOff className="w-4 h-4" />}
                  </button>

                  {/* Word */}
                  <span className="font-mono font-semibold text-sm flex-1">{w.word}</span>

                  {/* Badges */}
                  {w.isPrimary && (
                    <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      {t("wake_word_primary_badge")}
                    </Badge>
                  )}
                  {!w.isActive && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {t("wake_word_disabled")}
                    </Badge>
                  )}
                  {variants.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      +{variants.length} {t("wake_word_variants_count")}
                    </Badge>
                  )}

                  {/* Expand variants */}
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : w.id);
                      if (!isExpanded) {
                        setEditVariants((prev) => ({ ...prev, [w.id]: variants.join(", ") }));
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Active toggle */}
                  <Switch
                    checked={w.isActive}
                    onCheckedChange={(v) => toggleActiveMutation.mutate({ id: w.id, isActive: v })}
                    title={w.isActive ? t("wake_word_disable") : t("wake_word_enable")}
                  />

                  {/* Delete */}
                  <button
                    onClick={() => deleteMutation.mutate({ id: w.id })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title={t("wake_word_delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded: edit variants */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <p className="text-xs text-muted-foreground">{t("wake_word_variants_edit_hint")}</p>
                    <div className="flex gap-2">
                      <Input
                        value={editVal}
                        onChange={(e) =>
                          setEditVariants((prev) => ({ ...prev, [w.id]: e.target.value }))
                        }
                        className="text-sm font-mono flex-1"
                        placeholder="ayna, anna, haina"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveVariants(w.id)}
                        disabled={updateVariantsMutation.isPending}
                      >
                        {t("save")}
                      </Button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {variants.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {variants.map((v) => (
                          <Badge key={v} variant="secondary" className="text-xs font-mono">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info box */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p><Star className="w-3 h-3 inline mr-1 text-yellow-400 fill-yellow-400" />{t("wake_words_info_primary")}</p>
          <p>{t("wake_words_info_variants")}</p>
          <p>{t("wake_words_info_active")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
