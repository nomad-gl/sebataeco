import { useRef, useCallback, ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAutoCorrect } from "@/hooks/useAutoCorrect";
import { AutoCorrectIndicator } from "@/components/AutoCorrectIndicator";

type TextareaProps = ComponentProps<typeof Textarea>;

interface AutoCorrectTextareaProps extends Omit<TextareaProps, "onChange"> {
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
 * AutoCorrectTextarea — A Textarea with built-in auto-correct.
 * Wraps the standard Textarea component and applies debounced LLM-based
 * spelling/grammar correction as the user types.
 */
export function AutoCorrectTextarea({
  value,
  onChange,
  showIndicator = true,
  debounceMs = 1500,
  minLength = 12,
  className,
  ...rest
}: AutoCorrectTextareaProps) {
  const { state, handleChange, undoLastCorrection, toggleEnabled } = useAutoCorrect({
    debounceMs,
    minLength,
    maxLength: 1000,
  });

  const onChangeHandler = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
      <Textarea
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
