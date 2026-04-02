import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Brain, ChevronDown, ChevronUp, RotateCcw, ThumbsUp, ThumbsDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

const STYLE_LABELS: Record<string, string> = {
  concise: "Concise",
  detailed: "Detailed",
  conversational: "Conversational",
  formal: "Formal",
};

const DEPTH_LABELS: Record<string, string> = {
  brief: "Brief",
  moderate: "Balanced",
  thorough: "Thorough",
};

export function ClaraProfilePanel() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const profileQuery = trpc.lomloe.getClaraProfile.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });
  const ratingSummaryQuery = trpc.lomloe.getClaraRatingSummary.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });
  const utils = trpc.useUtils();
  const resetMutation = trpc.lomloe.resetClaraProfile.useMutation({
    onSuccess: () => {
      utils.lomloe.getClaraProfile.invalidate();
      utils.lomloe.getClaraRatingSummary.invalidate();
      toast.success("Clara's memory has been reset.");
    },
    onError: () => toast.error("Could not reset profile. Please try again."),
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
        <span className="font-medium">Clara knows you</span>
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
            <p className="text-white/50 text-xs">Loading profile…</p>
          ) : !profile ? (
            <p className="text-white/50 text-xs">
              Clara hasn't learned your style yet. Start a conversation to build your profile.
            </p>
          ) : (
            <>
              {/* Interaction count */}
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <Star className="size-3.5 text-yellow-300" />
                <span>{profile.questionCount} interaction{profile.questionCount !== 1 ? "s" : ""} recorded</span>
              </div>

              {/* Style & depth */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded-lg px-2 py-1.5">
                  <p className="text-white/50 text-xs mb-0.5">Style</p>
                  <p className="font-medium capitalize">
                    {STYLE_LABELS[profile.communicationStyle] ?? profile.communicationStyle}
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg px-2 py-1.5">
                  <p className="text-white/50 text-xs mb-0.5">Depth</p>
                  <p className="font-medium capitalize">
                    {DEPTH_LABELS[profile.responseDepthPreference] ?? profile.responseDepthPreference}
                  </p>
                </div>
              </div>

              {/* Top competencies */}
              {profile.topCompetencies.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs mb-1">Top competencies</p>
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
                  <p className="text-white/50 text-xs mb-1">Recurring topics</p>
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
                  <p className="text-white/50 text-xs mb-1">Response quality</p>
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
                        {ratings.pctHelpful}% helpful
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
                  <p className="text-white/50 text-xs mb-1">Teaching context</p>
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
                  if (confirm("Reset Clara's memory? She will start learning your style from scratch.")) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending}
              >
                <RotateCcw className="size-3 mr-1.5" />
                Reset Clara's memory
              </Button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
