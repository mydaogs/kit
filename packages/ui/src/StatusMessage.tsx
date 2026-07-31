import { cn } from "./cn";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

interface StatusMessageProps {
  value: string | ReactNode;
  footer?: ReactNode;
  className?: string;
}

export const StatusMessage = ({
  value,
  className,
  footer,
}: StatusMessageProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 justify-center items-center px-4 py-3 bg-linear-to-tr from-danger/30 via-danger/0 to-danger/30 rounded-base border border-accent w-full",
        className,
      )}
    >
      <div className="flex gap-2 items-center">
        <AlertCircle className="h-5 w-5 text-accent shrink-0" />
        {
          <div className="text-sm font-bold font-mono text-accent text-start min-w-0 flex-1">
            {value}
          </div>
        }
      </div>
      {footer ?? null}
    </div>
  );
};
