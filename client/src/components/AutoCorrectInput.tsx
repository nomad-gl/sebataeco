import { useCallback, ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { useAutoCorrect } from "@/hooks/useAutoCorrect";
import { AutoCorrectIndicator } from "@/components/AutoCorrectIndicator";

type InputProps = ComponentProps<typeof Input>;

interface AutoCorrectInputProps extends Omit<InputProps, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Whether to show the indicator (default: true) */
  showIndicator?: boolean;
  /** Debounce delay in ms (default: 1500) */
  debounceMs?: number;
  /** Minimum text length to trigger correction (default: 12) */
  minLength?: number;
}

/**
 * AutoCorrectInput — An Input with built-in auto-correct.
 * Wraps the standard Input component and applies debounced LLM-based
 * spelling/grammar correction as the user types.
 */
export function AutoCorrectInput({
  value,
  onChange,
  showIndicator = true,
  debounceMs = 1500,
  minLength = 12,
  className,
  ...rest
}: AutoCorrectInputProps) {
  const { state, handleChange, undoLastCorrection, toggleEnabled } = useAutoCorrect({
    debounceMs,
    minLength,
    maxLength: 500,
  });

  const onChangeHandler = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      onChange(newVal);
      handleChange(newVal, (corrected) => {
        onChange(corrected);
      });
    },
    [onChange, handleChange]
  );

  const handleUndo = useCallback(() => {
    const original = undoLastCorrection();
    if (original) onChange(original);
  }, [undoLastCorrection, onChange]);

  return (
    <div className="w-full">
      <Input
        value={value}
        onChange={onChangeHandler}
        className={className}
        {...rest}
      />
      {showIndicator && (
        <div className="mt-0.5">
          <AutoCorrectIndicator
            isPending={state.isPending}
            lastCorrection={state.lastCorrection}
            isEnabled={state.isEnabled}
            onUndo={handleUndo}
            onToggle={toggleEnabled}
          />
        </div>
      )}
    </div>
  );
}
