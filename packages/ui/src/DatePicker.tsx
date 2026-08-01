"use client";

import { Button } from "@mydaogs/ui";
import {
  Calendar,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@mydaogs/ui/client";
import { FormControl } from "./form";
import type { GetComponentProps } from "./types";
import { cn } from "./cn";
import { CalendarIcon } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";

interface DatePickerProps extends Omit<
  GetComponentProps<typeof Button>,
  "value"
> {
  value: Date;
  onValueSelect: (_: Date | undefined) => void;
  isPlaceholderDate?: (_: Date) => boolean;
  placeholderText?: string;
}

export const DatePicker = (props: DatePickerProps) => {
  const { value, onValueSelect, isPlaceholderDate, placeholderText, ...rest } =
    props;
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      onValueSelect(date);
      closeBtnRef.current?.click();
    },
    [onValueSelect],
  );

  const isPlaceholder = useMemo(
    () => (isPlaceholderDate ? isPlaceholderDate(value) : false),
    [isPlaceholderDate, value],
  );

  const isDisabledDate = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    const minDate = new Date(1900, 0, 1);
    minDate.setHours(0, 0, 0, 0);
    return compareDate > today || compareDate < minDate;
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            variant={"flat"}
            className={cn(
              "relative pl-3 py-2 h-auto text-lg font-normal bg-secondary border-(length:--border-width-base)",
            )}
            {...rest}
          >
            <span
              className={cn(
                "w-full text-start",
                isPlaceholder && "text-primary/50 text-sm py-1",
              )}
            >
              {!isPlaceholder
                ? value.toLocaleDateString()
                : (placeholderText ?? "Pick a date")}
            </span>
            <CalendarIcon className="absolute ml-auto right-2 top-1/2 -translate-y-1/2" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 overflow-visible" align="start">
        <div
          id="date-picker-content"
          className="pointer-events-auto rounded-md relative overflow-clip"
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            startMonth={new Date(1900, 0)}
            endMonth={new Date()}
            disabled={isDisabledDate}
            showOutsideDays={false}
            captionLayout="dropdown"
          />
        </div>
        <PopoverClose btnRef={closeBtnRef} />
      </PopoverContent>
    </Popover>
  );
};
