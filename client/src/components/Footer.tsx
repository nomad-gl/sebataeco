import { useI18n } from "@/contexts/I18nContext";
import { Link } from "wouter";

const LOMLOE_LOGO =
  "/manus-storage/lomloe_23170104_ad4cf225.png";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-secondary/20 mt-auto print:hidden">
      <div className="container py-6">
        <div className="flex flex-col items-center sm:flex-row sm:justify-between gap-3 sm:gap-4 text-center sm:text-left">
          {/* Left: LOMLOE official logo */}
          <a
            href="https://www.educacionyfp.gob.es"
            target="_blank"
            rel="noopener noreferrer"
            title="Ministerio de Educación y Formación Profesional – LOMLOE"
          >
            <img
              src={LOMLOE_LOGO}
              alt="LOMLOE – Gobierno de España · Ministerio de Educación y Formación Profesional"
              className="h-12 w-auto object-contain"
            />
          </a>

          {/* Centre: site description + BSC Salamandra & Àguila attribution */}
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs text-muted-foreground text-center">
              Aina · {t("footer_aligned")}
            </p>
            <div className="flex flex-col items-center gap-0.5">
              <a
                href="https://projecteaina.cat/tech/en/introducing-the-salamandra-family-of-models/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                title="Salamandra — Barcelona Supercomputing Center (BSC)"
              >
                <span className="opacity-70">🔬</span>
                <span>
                  {t("footer_ai_powered_by")}{" "}
                  <span className="font-semibold text-primary/80">Salamandra</span>
                  {" "}&amp;{" "}
                  <span className="font-semibold text-primary/80">Àguila</span>
                  {" "}·{" "}
                  <span className="font-semibold">Barcelona Supercomputing Center (BSC)</span>
                </span>
              </a>
              <Link
                href="/ai-models"
                className="text-[10px] text-muted-foreground/70 hover:text-primary hover:underline transition-colors"
              >
                {t("footer_ai_models")}
              </Link>
            </div>
          </div>

          {/* Right: Powered by AINA + sebasnap link + legal links */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <a
              href="https://sebasnap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline font-medium"
            >
              sebasnap.com →
            </a>
            <span className="text-xs text-muted-foreground">{t("powered_by_seba")}</span>
            <span className="text-xs text-muted-foreground/70">{t("seba_description")}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Link href="/privacy" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors">
                {t("footer_privacy")}
              </Link>
              <span className="text-muted-foreground text-[11px]">·</span>
              <Link href="/dpa" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors">
                DPA
              </Link>
              <span className="text-muted-foreground text-[11px]">·</span>
              <Link href="/audit" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors">
                {t("audit_title")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
