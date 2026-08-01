"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, useDayPicker } from "react-day-picker";
import { Button, buttonVariants } from "@mydaogs/ui";
import { cn } from "./cn";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const MONTHS_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface DatePickerSelectionProps {
  options: string[];
  onSelect: (_: string) => void;
  isVisible: boolean;
}

function DatePickerSelection({
  options,
  onSelect,
  isVisible,
}: DatePickerSelectionProps) {
  if (!isVisible) return null;

  const portalElement =
    typeof document !== "undefined"
      ? document.getElementById("date-picker-content")
      : null;

  if (!portalElement) {
    return null;
  }

  return createPortal(
    <div className="absolute z-50 inset-0 bg-main py-2 px-4">
      <ul className="flex gap-2 overflow-y-scroll h-full w-full flex-wrap text-xl font-mono justify-center items-center">
        {options.map((option) => (
          <li key={option}>
            <Button size="sm" onClick={() => onSelect(option)}>
              {option}
            </Button>
          </li>
        ))}
      </ul>
    </div>,
    portalElement,
  );
}

function DropdownNav({
  startMonth,
  endMonth,
}: {
  startMonth?: Date;
  endMonth?: Date;
}) {
  const { months, goToMonth } = useDayPicker();
  const [isSelectionMonthVisible, setIsSelectionMonthVisible] = useState(false);
  const [isSelectionYearVisible, setIsSelectionYearVisible] = useState(false);

  const value = useMemo(
    () => (months[0] ? months[0].date : new Date()),
    [months],
  );

  const yearOptions = useMemo(() => {
    const currentYear = value.getFullYear();
    const startYear = startMonth?.getFullYear() ?? currentYear - 10;
    const endYear = endMonth?.getFullYear() ?? currentYear + 10;

    const years: string[] = [];
    for (let year = endYear; year >= startYear; year--) {
      years.push(year.toString());
    }
    return years;
  }, [value, startMonth, endMonth]);

  const handleMonthSelect = useCallback(
    (monthName: string) => {
      const monthIndex = MONTHS_OPTIONS.indexOf(monthName);
      if (monthIndex === -1) return; // Safety check for invalid month
      const newDate = new Date(value.getFullYear(), monthIndex, 1);
      goToMonth(newDate);
      setIsSelectionMonthVisible(false);
    },
    [value, goToMonth],
  );

  const handleYearSelect = useCallback(
    (yearStr: string) => {
      const year = parseInt(yearStr, 10);
      if (isNaN(year)) return; // Safety check for invalid year
      const newDate = new Date(year, value.getMonth(), 1);
      goToMonth(newDate);
      setIsSelectionYearVisible(false);
    },
    [value, goToMonth],
  );

  const handleMonthButtonClick = useCallback(() => {
    setIsSelectionMonthVisible(true);
  }, []);

  const handleYearButtonClick = useCallback(() => {
    setIsSelectionYearVisible(true);
  }, []);

  return (
    <>
      <div className="flex justify-center items-center gap-2">
        <Button
          size="reset"
          variant="flat"
          className="px-2 py-px border-(length:--border-width-base)"
          onClick={handleMonthButtonClick}
        >
          {value.toLocaleString("default", { month: "long" })}
        </Button>
        <Button
          size="reset"
          variant="flat"
          className="px-2 py-px border-(length:--border-width-base)"
          onClick={handleYearButtonClick}
        >
          {value.getFullYear()}
        </Button>
      </div>
      <DatePickerSelection
        options={MONTHS_OPTIONS}
        onSelect={handleMonthSelect}
        isVisible={isSelectionMonthVisible}
      />
      <DatePickerSelection
        options={yearOptions}
        onSelect={handleYearSelect}
        isVisible={isSelectionYearVisible}
      />
    </>
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "rounded-base bg-main p-3 font-heading shadow-shadow",
        className,
      )}
      classNames={{
        month: "space-y-4",
        months: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 relative",
        month_caption: "flex justify-center pt-1 relative items-center",
        month_grid: "w-full border-collapse space-y-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 z-10",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 z-10",
        ),
        weeks: "w-full border-collapse space-y-",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day_button:
          "h-9 w-9 text-center text-sm p-0 relative hover:border-(length:--border-width-base) rounded-md [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:bg-secondary",
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (props) =>
          props.orientation === "left" ? (
            <ChevronLeft {...props} />
          ) : (
            <ChevronRight {...props} />
          ),
        DropdownNav: () => (
          <DropdownNav
            startMonth={props.startMonth}
            endMonth={props.endMonth}
          />
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
