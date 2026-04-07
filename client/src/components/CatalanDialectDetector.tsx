/**
 * CatalanDialectDetector
 *
 * Mounts invisibly in the app root. Responsibilities:
 *  1. On first CA-language load: calls geoDialect.detect, shows a confirmation
 *     dialog asking the user to accept the detected dialect.
 *  2. On every subsequent load: silently re-checks the IP region and, if it
 *     has changed significantly (different dialect), shows a "region changed"
 *     dialog offering to reset the dialect.
 *  3. Stores the accepted dialect and last-known region code in localStorage.
 */

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n, type CatalanDialect } from "@/contexts/I18nContext";
import { DIALECT_LABELS, DIALECT_BADGE } from "@/contexts/dialectOverrides";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_DIALECT_CHOSEN = "seba_ca_dialect_chosen"; // "true" once user has confirmed
const STORAGE_LAST_REGION    = "seba_ca_last_region";    // e.g. "ES-VC"

type PopupKind = "initial" | "region_changed" | null;

export default function CatalanDialectDetector() {
  const { lang, dialect, setDialect } = useI18n();
  const [popup, setPopup] = useState<PopupKind>(null);
  const [detected, setDetected] = useState<{ dialect: CatalanDialect; region: string; dialectLabel: string } | null>(null);

  // Only run when the UI language is Catalan
  const enabled = lang === "ca";

  const { data, isSuccess } = trpc.geoDialect.detect.useQuery(undefined, {
    enabled,
    // Re-fetch on every mount but don't refetch in background
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isSuccess || !data || !enabled) return;

    const regionKey = `${data.countryCode}-${data.region}`;
    const alreadyChosen = localStorage.getItem(STORAGE_DIALECT_CHOSEN);
    const lastRegion    = localStorage.getItem(STORAGE_LAST_REGION);

    setDetected({ dialect: data.dialect, region: regionKey, dialectLabel: data.dialectLabel });

    if (!alreadyChosen) {
      // First time — always show confirmation so user can choose IEC standard or regional variant
      setPopup("initial");
      return;
    }

    // Subsequent loads — check if region changed to a different dialect
    if (lastRegion && lastRegion !== regionKey && data.dialect !== dialect) {
      setPopup("region_changed");
    }
  }, [isSuccess, data, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptDetected = () => {
    if (!detected) return;
    setDialect(detected.dialect);
    localStorage.setItem(STORAGE_DIALECT_CHOSEN, "true");
    localStorage.setItem(STORAGE_LAST_REGION, detected.region);
    setPopup(null);
  };

  const keepCurrent = () => {
    if (detected) {
      // Remember the new region so we don't prompt again immediately
      localStorage.setItem(STORAGE_LAST_REGION, detected.region);
      if (popup === "initial") {
        // User declined — mark as chosen so we don't show again
        localStorage.setItem(STORAGE_DIALECT_CHOSEN, "true");
      }
    }
    setPopup(null);
  };

  if (!popup || !detected) return null;

  const isInitial = popup === "initial";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) keepCurrent(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🏴󠁥󠁳󠁣󠁴󠁿</span>
            {isInitial ? "Benvingut/da a SEBA" : "Canvi de regió detectat"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {isInitial
              ? `SEBA utilitza el català estàndard IEC per defecte. Hem detectat que et trobes a una zona de variant "${detected.dialectLabel}". Tria la variant que prefereixes:`
              : `La teva ubicació ha canviat. Hem detectat la variant "${detected.dialectLabel}". Vols actualitzar la variant lingüística de SEBA?`}
          </DialogDescription>
        </DialogHeader>

        {isInitial ? (
          <div className="grid grid-cols-1 gap-2">
            {/* IEC Standard option */}
            <button
              onClick={() => {
                setDialect("standard");
                localStorage.setItem(STORAGE_DIALECT_CHOSEN, "true");
                if (detected) localStorage.setItem(STORAGE_LAST_REGION, detected.region);
                setPopup(null);
              }}
              className="flex items-center gap-3 rounded-lg border-2 border-primary/30 hover:border-primary bg-primary/5 px-4 py-3 text-left transition-colors"
            >
              <span className="text-xl">🏴󠁥󠁳󠁣󠁴󠁿</span>
              <div>
                <div className="font-semibold text-sm">Català estàndard (IEC)</div>
                <div className="text-xs text-muted-foreground">Norma de l'Institut d'Estudis Catalans — recomanat</div>
              </div>
            </button>
            {/* Regional variant option — only show if different from standard */}
            {detected.dialect !== "standard" && detected.dialect !== "central" && (
              <button
                onClick={acceptDetected}
                className="flex items-center gap-3 rounded-lg border hover:border-primary/50 bg-muted/30 px-4 py-3 text-left transition-colors"
              >
                <span className="text-xl">🌍</span>
                <div>
                  <div className="font-semibold text-sm">{detected.dialectLabel}</div>
                  <div className="text-xs text-muted-foreground">Variant regional detectada per la teva ubicació</div>
                </div>
              </button>
            )}
          </div>
        ) : (
          /* Region-changed info card */
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Variant actual</span>
              <span className="font-semibold">{DIALECT_LABELS[dialect]}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">Variant detectada</span>
              <span className="font-semibold text-primary">{detected.dialectLabel}</span>
            </div>
          </div>
        )}

        {!isInitial && (
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={keepCurrent}>
              Mantenir la variant actual
            </Button>
            <Button className="w-full sm:w-auto" onClick={acceptDetected}>
              Actualitzar variant
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Small badge component for the NavBar showing the active dialect. */
export function DialectBadge() {
  const { lang, dialect } = useI18n();
  if (lang !== "ca") return null;
  const badge = DIALECT_BADGE[dialect];
  if (badge === "CA") return null; // Don't show badge for standard central
  return (
    <span className="ml-0.5 text-[10px] font-medium text-primary/70 leading-none">
      {badge.replace("CA · ", "")}
    </span>
  );
}
