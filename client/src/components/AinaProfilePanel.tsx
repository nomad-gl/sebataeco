import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Brain, ChevronDown, ChevronUp, RotateCcw, ThumbsUp, ThumbsDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

export function AinaProfilePanel() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const STYLE_LABELS: Record<string, string> = {
    concise: t("aina_style_concise"),
    detailed: t("aina_style_detailed"),
    conversational: t("aina_style_conversational"),
    formal: t("aina_style_formal"),
  };

  const DEPTH_LABELS: Record<string, string> = {
    brief: t("aina_depth_brief"),
    moderate: t("aina_depth_moderate"),
    thorough: t("aina_depth_thorough"),
  };

  const profileQuery = trpc.lomloe.getAinaProfile.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });
  const ratingSummaryQuery = trpc.lomloe.getAinaRatingSummary.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });
  const utils = trpc.useUtils();
  const resetMutation = trpc.lomloe.resetAinaProfile.useMutation({
    onSuccess: () => {
      utils.lomloe.getAinaProfile.invalidate();
      utils.lomloe.getAinaRatingSummary.invalidate();
      toast.success(t("aina_reset_success"));
    },
    onError: () => toast.error(t("aina_reset_error")),
  });

  const profile = profileQuery.data;
  const ratings = ratingSummaryQuery.data;

  return (
    <div className="w-full">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors w-full px-1 py-1"
      >
        <Brain className="size-4 shrink-0 text-violet-300" />
        <span className="font-medium">{t("aina_knows_you")}</span>
        {open ? (
          <ChevronUp className="size-3.5 ml-auto" />
        ) : (
          <ChevronDown className="size-3.5 ml-auto" />
        )}
      </button>

      {/* Collapsible panel */}
      {open && (
        <Card className="mt-2 p-3 bg-white/10 border-white/20 text-white text-sm space-y-3">
          {profileQuery.isLoading || ratingSummaryQuery.isLoading ? (
            <p className="text-white/50 text-xs">{t("aina_loading_profile")}</p>
          ) : !profile ? (
            <p className="text-white/50 text-xs">
              {t("aina_no_profile")}
            </p>
          ) : (
            <>
              {/* Interaction count */}
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <Star className="size-3.5 text-yellow-300" />
                <span>
                  {profile.questionCount}{" "}
                  {profile.questionCount !== 1 ? t("aina_interactions_plural") : t("aina_interactions")}{" "}
                  {t("aina_interactions_recorded")}
                </span>
              </div>

              {/* Style & depth */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded-lg px-2 py-1.5">
                  <p className="text-white/50 text-xs mb-0.5">{t("aina_style")}</p>
                  <p className="font-medium capitalize">
                    {STYLE_LABELS[profile.communicationStyle] ?? profile.communicationStyle}
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg px-2 py-1.5">
                  <p className="text-white/50 text-xs mb-0.5">{t("aina_depth")}</p>
                  <p className="font-medium capitalize">
                    {DEPTH_LABELS[profile.responseDepthPreference] ?? profile.responseDepthPreference}
                  </p>
                </div>
              </div>

              {/* Top competencies */}
              {profile.topCompetencies.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs mb-1">{t("aina_top_competencies")}</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.topCompetencies.map((c) => (
                      <span
                        key={c}
                        className="bg-violet-500/30 text-violet-200 text-xs px-2 py-0.5 rounded-full"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic keywords */}
              {profile.topicKeywords.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs mb-1">{t("aina_recurring_topics")}</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.topicKeywords.slice(0, 6).map((kw) => (
                      <span
                        key={kw}
                        className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-full"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating summary */}
              {ratings && ratings.total > 0 && (
                <div>
                  <p className="text-white/50 text-xs mb-1">{t("aina_response_quality")}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-green-300">
                      <ThumbsUp className="size-3.5" />
                      <span className="text-xs font-medium">{ratings.upCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-300">
                      <ThumbsDown className="size-3.5" />
                      <span className="text-xs font-medium">{ratings.downCount}</span>
                    </div>
                    {ratings.pctHelpful !== null && (
                      <span
                        className={cn(
                          "text-xs font-medium ml-auto",
                          ratings.pctHelpful >= 70 ? "text-green-300" : ratings.pctHelpful >= 40 ? "text-yellow-300" : "text-red-300"
                        )}
                      >
                        {ratings.pctHelpful}% {t("aina_pct_helpful")}
                      </span>
                    )}
                  </div>
                  {/* Bar */}
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400 transition-all"
                      style={{ width: `${ratings.pctHelpful ?? 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Teaching context summary */}
              {profile.teachingContextSummary && (
                <div>
                  <p className="text-white/50 text-xs mb-1">{t("aina_teaching_context")}</p>
                  <p className="text-white/80 text-xs leading-relaxed line-clamp-3">
                    {profile.teachingContextSummary}
                  </p>
                </div>
              )}

              {/* Reset button */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-red-300 hover:text-red-200 hover:bg-red-500/10 text-xs h-7 mt-1"
                onClick={() => {
                  if (confirm(t("aina_reset_confirm"))) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending}
              >
                <RotateCcw className="size-3 mr-1.5" />
                {t("aina_reset_memory")}
              </Button>
            </>
          )}
        </Card>
      )}
      {/* BSC Salamandra & Àguila attribution */}
      <div className="flex flex-col items-center gap-0.5 mt-2 px-2">
        <a
          href="https://projecteaina.cat/tech/en/introducing-the-salamandra-family-of-models/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          🔬 Powered by <strong>Salamandra</strong> &amp; <strong>Àguila</strong> · Barcelona Supercomputing Center (BSC)
        </a>
        <a
          href="/ai-models"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-white/20 hover:text-white/50 transition-colors underline-offset-2 hover:underline"
        >
          {t("aina_view_model_credits")}
        </a>
      </div>
    </div>
  );
}
