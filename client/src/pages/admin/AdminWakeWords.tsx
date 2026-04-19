import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Mic, MicOff, Plus, Trash2, Star, StarOff, X, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Radio, Volume2, ArrowLeft,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

// ─── Pronunciation Tester ─────────────────────────────────────────────────────

type TestResult = {
  transcript: string;
  matched: boolean;
  matchedWord?: string;
  matchedVariant?: string;
};

function buildMatcher(words: { word: string; phoneticVariants: string; isActive: boolean }[]) {
  const entries: { word: string; variants: string[] }[] = words
    .filter((w) => w.isActive)
    .map((w) => {
      let variants: string[] = [];
      try { variants = JSON.parse(w.phoneticVariants); } catch { /* empty */ }
      return { word: w.word, variants };
    });

  return (transcript: string): { matched: boolean; word?: string; variant?: string } => {
    const t = transcript.toLowerCase().trim();
    for (const entry of entries) {
      const candidates = [entry.word, ...entry.variants];
      for (const c of candidates) {
        if (t.includes(c.toLowerCase())) {
          return { matched: true, word: entry.word, variant: c };
        }
      }
    }
    return { matched: false };
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSR = (): (new () => any) | null =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

function PronunciationTester({
  words,
  onAddVariant,
}: {
  words: { id: number; word: string; phoneticVariants: string; isActive: boolean }[];
  onAddVariant: (wordId: number, variant: string) => void;
}) {
  const { t } = useI18n();
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognisersRef = useRef<any[]>([]);

  const hasSR = !!getSR();

  const stopAll = useCallback(() => {
    recognisersRef.current.forEach((r) => { try { r.stop(); } catch { /* ignore */ } });
    recognisersRef.current = [];
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const SR = getSR();
    if (!SR) {
      setError(t("wake_test_no_sr"));
      return;
    }
    setResult(null);
    setLiveTranscript("");
    setError(null);
    setIsRecording(true);

    const matcher = buildMatcher(words);
    const LANGS = ["ca-ES", "es-ES"];
    let settled = false;

    const instances = LANGS.map((lang) => {
      const r = new SR();
      r.lang = lang;
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 3;

      r.onresult = (e: any) => {
        const transcripts: string[] = [];
        for (let i = 0; i < e.results.length; i++) {
          for (let j = 0; j < e.results[i].length; j++) {
            transcripts.push(e.results[i][j].transcript as string);
          }
        }
        const joined = transcripts.join(" ");
        setLiveTranscript(joined);

        if (e.results[0]?.isFinal && !settled) {
          settled = true;
          const { matched, word, variant } = matcher(joined);
          setResult({ transcript: joined, matched, matchedWord: word, matchedVariant: variant });
          stopAll();
        }
      };

      r.onerror = (e: any) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        if (!settled) {
          setError(`${t("wake_test_error")}: ${e.error}`);
          stopAll();
        }
      };

      r.onend = () => {
        // If no final result yet, stop everything
        if (!settled) {
          settled = true;
          if (liveTranscript) {
            const { matched, word, variant } = matcher(liveTranscript);
            setResult({ transcript: liveTranscript, matched, matchedWord: word, matchedVariant: variant });
          }
          stopAll();
        }
      };

      r.start();
      return r;
    });

    recognisersRef.current = instances;

    // Auto-stop after 6 seconds
    setTimeout(() => {
      if (!settled) stopAll();
    }, 6000);
  }, [words, t, stopAll, liveTranscript]);

  useEffect(() => () => stopAll(), [stopAll]);

  // Find the word id for a matched word name
  const matchedWordObj = result?.matchedWord
    ? words.find((w) => w.word === result.matchedWord)
    : undefined;

  return (
    <Card className="border-violet-200 dark:border-violet-800/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="w-4 h-4 text-violet-500" />
          {t("wake_test_title")}
        </CardTitle>
        <CardDescription>{t("wake_test_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasSR && (
          <p className="text-sm text-destructive">{t("wake_test_no_sr")}</p>
        )}

        {/* Record button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={isRecording ? stopAll : startRecording}
            disabled={!hasSR}
            variant={isRecording ? "destructive" : "default"}
            className={cn(
              "gap-2 transition-all",
              isRecording && "animate-pulse"
            )}
          >
            {isRecording ? (
              <><MicOff className="w-4 h-4" />{t("wake_test_stop")}</>
            ) : (
              <><Mic className="w-4 h-4" />{t("wake_test_record")}</>
            )}
          </Button>
          {isRecording && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {t("wake_test_listening")}
            </span>
          )}
        </div>

        {/* Live transcript */}
        {(isRecording || liveTranscript) && (
          <div className="rounded-md bg-muted/40 border px-3 py-2 text-sm font-mono min-h-[2.5rem]">
            {liveTranscript
              ? <span className="text-foreground">{liveTranscript}</span>
              : <span className="text-muted-foreground italic">{t("wake_test_waiting")}</span>
            }
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <XCircle className="w-4 h-4 shrink-0" />{error}
          </p>
        )}

        {/* Result */}
        {result && !isRecording && (
          <div className={cn(
            "rounded-lg border p-4 space-y-3",
            result.matched
              ? "bg-green-500/5 border-green-500/30"
              : "bg-red-500/5 border-red-500/30"
          )}>
            <div className="flex items-center gap-2">
              {result.matched ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <span className="font-semibold text-sm">
                {result.matched ? t("wake_test_pass") : t("wake_test_fail")}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                {t("wake_test_heard")}:{" "}
                <span className="font-mono text-foreground">"{result.transcript}"</span>
              </p>
              {result.matched && result.matchedWord && (
                <p className="text-muted-foreground">
                  {t("wake_test_matched_word")}:{" "}
                  <Badge variant="secondary" className="font-mono text-xs">{result.matchedWord}</Badge>
                  {result.matchedVariant && result.matchedVariant !== result.matchedWord && (
                    <> {t("wake_test_via_variant")} <Badge variant="outline" className="font-mono text-xs">{result.matchedVariant}</Badge></>
                  )}
                </p>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              {/* If it failed, offer to add the heard transcript as a variant to the closest word */}
              {!result.matched && words.filter((w) => w.isActive).length > 0 && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-muted-foreground">{t("wake_test_add_variant_hint")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {words.filter((w) => w.isActive).map((w) => (
                      <Button
                        key={w.id}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => {
                          onAddVariant(w.id, result.transcript.toLowerCase().trim());
                          toast.success(t("wake_test_variant_added"));
                          setResult(null);
                          setLiveTranscript("");
                        }}
                      >
                        <Plus className="w-3 h-3" />
                        {t("wake_test_add_to")} "{w.word}"
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* If it matched, offer to add the heard transcript as an additional variant */}
              {result.matched && matchedWordObj && result.matchedVariant !== result.transcript.toLowerCase().trim() && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1"
                  onClick={() => {
                    onAddVariant(matchedWordObj.id, result.transcript.toLowerCase().trim());
                    toast.success(t("wake_test_variant_added"));
                    setResult(null);
                    setLiveTranscript("");
                  }}
                >
                  <Plus className="w-3 h-3" />
                  {t("wake_test_add_as_variant")}
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 gap-1"
                onClick={() => { setResult(null); setLiveTranscript(""); }}
              >
                <X className="w-3 h-3" />
                {t("wake_test_clear")}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 gap-1"
                onClick={startRecording}
              >
                <Mic className="w-3 h-3" />
                {t("wake_test_retry")}
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <Volume2 className="w-3 h-3 inline mr-1" />
          {t("wake_test_langs_hint")}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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

  /** Called from PronunciationTester when user wants to add a heard transcript as a variant */
  const handleAddVariant = (wordId: number, variant: string) => {
    const wordObj = words.find((w) => w.id === wordId);
    if (!wordObj) return;
    let existing: string[] = [];
    try { existing = JSON.parse(wordObj.phoneticVariants); } catch { /* empty */ }
    const updated = Array.from(new Set([...existing, variant]));
    updateVariantsMutation.mutate({ id: wordId, phoneticVariants: updated });
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />{t("btn_back")}
      </button>
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

      {/* Pronunciation Tester */}
      <PronunciationTester words={words} onAddVariant={handleAddVariant} />

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
    </div>
  );
}
