/**
 * HourAdjustmentsLog — Shows the teaching contact hour adjustment ledger
 * for a specific teacher. Used in the Director's Teacher Profile → Hours tab.
 */
import { trpc } from "@/lib/trpc";
import { useI18n, type TranslationKey } from "@/contexts/I18nContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingDown, TrendingUp } from "lucide-react";

type AdjustmentType = "extra_cover" | "payback" | "manual";

function typeBadge(type: AdjustmentType, minutes: number, t: (key: TranslationKey) => string) {
  if (type === "extra_cover")
    return <Badge variant="outline" className="text-amber-400 border-amber-500/50 text-xs">{t("hour_adj_extra_cover")}</Badge>;
  if (type === "payback")
    return <Badge variant="outline" className="text-blue-400 border-blue-500/50 text-xs">{t("hour_adj_payback")}</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-xs">{t("hour_adj_manual")}</Badge>;
}

export function HourAdjustmentsLog({ userId }: { userId: number }) {
  const { t } = useI18n();

  const { data, isLoading } = trpc.cover.getHourAdjustments.useQuery({ userId });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4 flex items-center gap-2">
        <Clock className="h-4 w-4 animate-pulse" />
        {t("hour_adj_loading")}
      </div>
    );
  }

  if (!data || data.adjustments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        {t("hour_adj_empty")}
      </div>
    );
  }

  const netMinutes = data.netMinutes;
  const netHours = (Math.abs(netMinutes) / 60).toFixed(1);
  const isPositive = netMinutes >= 0;

  return (
    <div className="space-y-4">
      {/* Net summary */}
      <div className={`rounded-lg border p-3 flex items-center gap-3 ${
        isPositive ? "border-amber-500/30 bg-amber-500/10" : "border-blue-500/30 bg-blue-500/10"
      }`}>
        {isPositive ? (
          <TrendingUp className="h-5 w-5 text-amber-400 shrink-0" />
        ) : (
          <TrendingDown className="h-5 w-5 text-blue-400 shrink-0" />
        )}
        <div>
          <p className="text-sm font-semibold">
            {t("hour_adj_net")}: {isPositive ? "+" : "-"}{netHours}h ({Math.abs(netMinutes)} min)
          </p>
          <p className="text-xs text-muted-foreground">
            {isPositive
              ? t("hour_adj_above_schedule")
              : t("hour_adj_below_schedule")}
          </p>
        </div>
      </div>

      {/* Ledger */}
      <div className="space-y-2">
        {data.adjustments.map((adj: {
          id: number;
          adjustmentType: AdjustmentType;
          adjustmentMinutes: number;
          reason: string;
          createdAt: Date | string;
        }) => (
          <div
            key={adj.id}
            className="rounded-md border border-border p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              {typeBadge(adj.adjustmentType, adj.adjustmentMinutes, t)}
              <span className={`text-sm font-semibold tabular-nums ${
                adj.adjustmentMinutes >= 0 ? "text-amber-400" : "text-blue-400"
              }`}>
                {adj.adjustmentMinutes >= 0 ? "+" : ""}{adj.adjustmentMinutes} min
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{adj.reason}</p>
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(adj.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
