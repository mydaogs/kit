import type { ReactNode } from "react";
import { cn } from "./cn";

interface InlineDataProps {
  className?: string;
  children: ReactNode;
}

export const InlineData = ({ className, children }: InlineDataProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-start justify-center gap-1",
        className,
      )}
    >
      {children}
    </div>
  );
};
