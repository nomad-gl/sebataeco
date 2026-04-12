import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown, Printer, FileText, FileDown, Image, Loader2,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export type ExportOption = {
  /** Unique key used as React key and to track loading state */
  key: string;
  /** Icon to show next to the label */
  icon: React.ReactNode;
  /** Display label */
  label: string;
  /** Called when the item is clicked */
  onClick: () => void | Promise<void>;
  /** If true, a separator is rendered above this item */
  separator?: boolean;
};

type Props = {
  options: ExportOption[];
  /** Label shown on the trigger button. Defaults to "Export" i18n key. */
  label?: string;
  /** Extra class names for the trigger button */
  className?: string;
  /** Size of the trigger button */
  size?: "sm" | "default" | "lg" | "icon";
  /** Variant of the trigger button */
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
};

/**
 * A single trigger button that opens a dropdown listing all export/download
 * options. Handles its own loading state per option key.
 */
export default function ExportDropdown({
  options,
  label,
  className = "",
  size = "sm",
  variant = "outline",
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState<string | null>(null);

  const handleClick = async (opt: ExportOption) => {
    if (loading) return;
    setLoading(opt.key);
    try {
      await opt.onClick();
    } finally {
      setLoading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className={`gap-1.5 ${className}`} disabled={!!loading}>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileDown className="w-3.5 h-3.5" />
          )}
          {label ?? t("export_label")}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {options.map((opt) => (
          <span key={opt.key}>
            {opt.separator && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => handleClick(opt)}
              disabled={!!loading}
              className="gap-2 cursor-pointer"
            >
              {loading === opt.key ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                  {opt.icon}
                </span>
              )}
              {opt.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Convenience icon helpers ─────────────────────────────────────────────────
export const PrintIcon = () => <Printer className="w-4 h-4" />;
export const PdfIcon = () => <FileText className="w-4 h-4" />;
export const WordIcon = () => <FileDown className="w-4 h-4" />;
export const PngIcon = () => <Image className="w-4 h-4" />;
export const CsvIcon = () => <FileDown className="w-4 h-4" />;
export const XmlIcon = () => <FileDown className="w-4 h-4" />;
