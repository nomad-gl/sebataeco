import { useI18n } from "@/contexts/I18nContext";

const LOMLOE_LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/lomloe_23170104.png";

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

          {/* Centre: site description */}
          <p className="text-xs text-muted-foreground text-center">
            SEBA AI | TA · {t("footer_aligned")}
          </p>

          {/* Right: Powered by SEBA + sebasnap link */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <a
              href="https://sebasnap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline font-medium"
            >
              sebasnap.com →
            </a>
            <span className="text-xs text-muted-foreground">{t("footer_powered")} SEBA</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
