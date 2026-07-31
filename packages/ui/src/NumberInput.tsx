"use client";

import * as React from "react";

import { Input } from "./input";

type InputProps = React.ComponentProps<typeof Input>;

export interface NumberInputProps extends Omit<
  InputProps,
  "type" | "value" | "onChange" | "defaultValue"
> {
  value?: number | null;
  onChange?: (value: number | null) => void;
}

/**
 * Numeric input that keeps its own raw string so the field can be emptied.
 * A plain `type="number"` bound to a numeric form value forces an empty input
 * back to `0`, which makes the field impossible to clear and produces values
 * like `0150` when typing over the stuck zero. Here the displayed string is
 * decoupled from the emitted number: clearing the field emits `null` (a defined
 * "empty", so react-hook-form keeps the field controlled) instead of `0`, and
 * the consumer/schema decides what an empty value means.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ value, onChange, onBlur, ...props }, ref) {
    const [raw, setRaw] = React.useState(
      value == null || Number.isNaN(value) ? "" : String(value),
    );

    // Sync the raw string when the value changes from the outside (form reset,
    // programmatic set) without clobbering an in-progress edit.
    React.useEffect(() => {
      const parsed = raw === "" ? null : Number(raw);
      const next = value == null || Number.isNaN(value) ? null : value;
      if (parsed !== next) {
        setRaw(next === null ? "" : String(next));
      }
      // `raw` is read intentionally but excluded to avoid an update loop.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextRaw = e.target.value;
      setRaw(nextRaw);
      const num = e.target.valueAsNumber;
      onChange?.(nextRaw === "" || Number.isNaN(num) ? null : num);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        inputMode="numeric"
        value={raw}
        onChange={handleChange}
        onBlur={onBlur}
      />
    );
  },
);

export { NumberInput };
