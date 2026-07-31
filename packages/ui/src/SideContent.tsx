import { cn } from "./cn";
import type { ReactNode } from "react";

interface SideContentProps {
  children: ReactNode;
  disabled?: boolean;
}

export const SideContent = ({
  children,
  disabled = false,
}: SideContentProps) => {
  return (
    <div
      className={cn(
        "bg-secondary/80 rounded-r-lg flex justify-center items-center px-2 border-2 border-l-0",
        {
          "cursor-not-allowed bg-foreground/15": disabled,
        },
      )}
    >
      {children}
    </div>
  );
};
