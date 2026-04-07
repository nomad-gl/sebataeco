/**
 * DpaAcceptanceDialog — shown on first login if the user has not yet accepted
 * the current version of the Data Processing Agreement.
 *
 * Blocks navigation until the user explicitly accepts.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ExternalLink } from "lucide-react";

export default function DpaAcceptanceDialog() {
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);

  const { data: status, isLoading } = trpc.dpa.getStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();
  const acceptMutation = trpc.dpa.accept.useMutation({
    onSuccess: () => {
      void utils.dpa.getStatus.invalidate();
    },
  });

  // Don't render while loading or if already accepted
  if (isLoading || !status || status.accepted) return null;

  const handleAccept = () => {
    acceptMutation.mutate({});
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-lg"
        // Prevent closing by clicking outside — user must explicitly accept
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{t("dpa_dialog_title")}</DialogTitle>
          </div>
          <DialogDescription>{t("dpa_dialog_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Version badge */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t("dpa_dialog_version")}:</span>
            <span className="font-mono bg-muted px-2 py-0.5 rounded">
              {status.currentVersion}
            </span>
          </div>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-semibold">{t("dpa_dialog_summary_title")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("dpa_dialog_summary")}
            </p>
          </div>

          {/* Link to full DPA */}
          <a
            href="https://github.com/seba-ai-studio/docs/blob/main/DATA_PROCESSING_AGREEMENT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("dpa_dialog_view_full")}
          </a>

          {/* Acceptance checkbox */}
          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="dpa-accept"
              checked={checked}
              onCheckedChange={(v) => setChecked(!!v)}
              className="mt-0.5"
            />
            <Label htmlFor="dpa-accept" className="text-sm leading-relaxed cursor-pointer">
              {t("dpa_dialog_checkbox")}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!checked || acceptMutation.isPending}
            className="w-full sm:w-auto"
          >
            {acceptMutation.isPending ? t("dpa_dialog_accepting") : t("dpa_dialog_accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
