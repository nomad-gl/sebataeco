import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_OPTIONS = [
  // Educació Infantil
  { group: "Infantil", label: "Infantil (3–6 anys)" },
  // Educació Primària
  { group: "Primària", label: "1r Primària" },
  { group: "Primària", label: "2n Primària" },
  { group: "Primària", label: "3r Primària" },
  { group: "Primària", label: "4t Primària" },
  { group: "Primària", label: "5è Primària" },
  { group: "Primària", label: "6è Primària" },
  // ESO
  { group: "ESO", label: "1r ESO" },
  { group: "ESO", label: "2n ESO" },
  { group: "ESO", label: "3r ESO" },
  { group: "ESO", label: "4t ESO" },
  // Batxillerat
  { group: "Batxillerat", label: "1r Batxillerat" },
  { group: "Batxillerat", label: "2n Batxillerat" },
  // FP
  { group: "Formació Professional", label: "CFGM (Grau Mitjà)" },
  { group: "Formació Professional", label: "CFGS (Grau Superior)" },
];

interface LevelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function LevelCombobox({ value, onChange, placeholder, className }: LevelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep internal input in sync when parent resets the value (e.g. on form reset)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = inputValue.trim()
    ? LEVEL_OPTIONS.filter((o) =>
        o.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        o.group.toLowerCase().includes(inputValue.toLowerCase())
      )
    : LEVEL_OPTIONS;

  // Group the filtered options
  const groups: Record<string, string[]> = {};
  for (const opt of filtered) {
    if (!groups[opt.group]) groups[opt.group] = [];
    groups[opt.group].push(opt.label);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
    setOpen(true);
  }

  function handleSelect(label: string) {
    setInputValue(label);
    onChange(label);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            "flex h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 pr-8 text-sm text-white",
            "placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "transition-colors"
          )}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-gray-900 shadow-xl max-h-64 overflow-y-auto py-1">
          {Object.keys(groups).length === 0 ? (
            <div className="px-4 py-2.5 text-sm text-white/40 italic">
              {inputValue ? `Use "${inputValue}"` : "No options"}
            </div>
          ) : (
            Object.entries(groups).map(([groupName, labels]) => (
              <div key={groupName}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {groupName}
                </div>
                {labels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(label); }}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors",
                      value === label
                        ? "text-primary bg-primary/10"
                        : "text-white/80 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Check className={cn("w-3.5 h-3.5 shrink-0", value === label ? "opacity-100" : "opacity-0")} />
                    {label}
                  </button>
                ))}
              </div>
            ))
          )}
          {/* Show "use custom value" hint when typed text doesn't exactly match any option */}
          {inputValue.trim() && !LEVEL_OPTIONS.some((o) => o.label === inputValue.trim()) && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(inputValue.trim()); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
              >
                <Check className="w-3.5 h-3.5 opacity-0 shrink-0" />
                Use "<span className="text-white/80 font-medium">{inputValue.trim()}</span>"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
