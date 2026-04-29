import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "infantil" | "lower_primary" | "junior" | "primary" | "secondary";

interface Props {
  selectedCompetency?: CompetencyCode;
  selectedYearGroup?: YearGroup;
  onCompetencyChange: (code: CompetencyCode | undefined) => void;
  onYearGroupChange: (yg: YearGroup | undefined) => void;
  compact?: boolean;
}

export default function CompetencySelector({
  selectedCompetency,
  selectedYearGroup,
  onCompetencyChange,
  onYearGroupChange,
  compact = false,
}: Props) {
  const { t } = useI18n();
  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();

  const YEAR_GROUPS: { value: YearGroup; label: string }[] = [
    { value: "infantil", label: "Infantil (0–6)" },
    { value: "lower_primary", label: t("comp_lower_primary") },
    { value: "junior", label: t("comp_junior") },
    { value: "primary", label: t("comp_primary") },
    { value: "secondary", label: t("comp_secondary") },
  ];

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Year group pills */}
      <div>
        <p className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2", compact && "mb-1")}>
          {t("comp_year_group_label")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onYearGroupChange(undefined)}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-all",
              !selectedYearGroup
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
            )}
          >
            {t("comp_all")}
          </button>
          {YEAR_GROUPS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onYearGroupChange(selectedYearGroup === value ? undefined : value)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-all",
                selectedYearGroup === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Competency pills */}
      <div>
        <p className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2", compact && "mb-1")}>
          {t("comp_competency_label")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCompetencyChange(undefined)}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-all",
              !selectedCompetency
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
            )}
          >
            {t("comp_all")}
          </button>
          {competencies?.map((comp) => (
            <button
              key={comp.code}
              onClick={() =>
                onCompetencyChange(
                  selectedCompetency === (comp.code as CompetencyCode)
                    ? undefined
                    : (comp.code as CompetencyCode)
                )
              }
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-all flex items-center gap-1",
                selectedCompetency === comp.code
                  ? `badge-${comp.code} border-transparent`
                  : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
              )}
            >
              <span>{comp.emoji}</span>
              <span>{comp.code}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
