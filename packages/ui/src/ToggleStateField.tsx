"use client";

import { Quote } from "@mydaogs/ui";
import { Checkbox } from "./checkbox";
import { Ban } from "lucide-react";
import { StatusCardLoading } from "./StatusCardLoading";
import { useEffect, useState } from "react";

interface ToggleStateFieldProps {
  label: string;
  currentValue: boolean;
  onToggle: () => Promise<void>;
}

export const ToggleStateField = ({
  label,
  currentValue,
  onToggle,
}: ToggleStateFieldProps) => {
  const [value, setValue] = useState(currentValue);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  return (
    <Quote className="flex py-px px-2 items-center justify-between">
      <span className="text-sm font-mono font-light">{label}</span>
      <div className="flex gap-1 h-full justify-center items-center">
        {isPending ? (
          <StatusCardLoading variant="compact" className="py-0" />
        ) : null}
        {isError ? <Ban className="py-1 h-6 w-6" /> : null}
        <Checkbox
          checked={value}
          onCheckedChange={() => {
            setIsError(false);
            const nextValue = !value;
            setValue(nextValue);
            setIsPending(true);
            onToggle()
              .catch(() => {
                setIsError(true);
                setValue(!nextValue);
              })
              .finally(() => {
                setIsPending(false);
              });
          }}
        />
      </div>
    </Quote>
  );
};
