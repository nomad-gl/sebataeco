import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

interface Props {
  selectedCompetency?: CompetencyCode;
  selectedYearGroup?: YearGroup;
  onCompetencyChange: (code: CompetencyCode | undefined) => void;
  onYearGroupChange: (yg: YearGroup | undefined) => void;
  compact?: boolean;
}

const YEAR_GROUPS: { value: YearGroup; label: string }[] = [
  { value: "junior", label: "Junior (Yr 3–4)" },
  { value: "primary", label: "Primary (Yr 5–6)" },
  { value: "secondary", label: "Secondary (Yr 7–10)" },
];

export default function CompetencySelector({
  selectedCompetency,
  selectedYearGroup,
  onCompetencyChange,
  onYearGroupChange,
  compact = false,
}: Props) {
  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Year group pills */}
      <div>
        <p className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2", compact && "mb-1")}>
          Year Group
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
            All
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
          Competency
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
            All
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
