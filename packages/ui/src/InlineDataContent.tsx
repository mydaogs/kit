import { cn } from "./cn";
import type { ReactNode } from "react";

interface InlineDataContentProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  sideContent?: ReactNode;
}

export const InlineDataContent = ({
  children,
  className,
  containerClassName,
  sideContent,
}: InlineDataContentProps) => {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 h-12 group/focusable",
        containerClassName,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center h-full pl-3 bg-linear-to-br bg-foreground/15 border-(length:--border-width-base) overflow-x-auto text-nowrap w-full",
          {
            "rounded-lg": !sideContent,
            "rounded-l-lg border-r-0": !!sideContent,
          },
          className,
        )}
      >
        <span className="min-w-0 text-lg font-mono text-foreground cursor-not-allowed w-full">
          {children}
        </span>
      </div>
      {sideContent ?? null}
    </div>
  );
};
