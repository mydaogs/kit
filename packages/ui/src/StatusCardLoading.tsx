"use client";

import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";
import { StatusCard, StatusCardTypes } from "@mydaogs/ui";

type StatusCardLoadingProps = {
  className?: string;
  variant?: "card" | "compact";
  iconClassName?: string;
  /** Title shown on the `"card"` variant. Defaults to an English label — pass a
   * translated string from the consuming app. */
  label?: string;
};

export const StatusCardLoading = ({
  className,
  variant = "card",
  iconClassName,
  label = "Loading",
}: StatusCardLoadingProps) => {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground",
          className,
        )}
      >
        <LoaderCircle className={cn("size-6 animate-spin", iconClassName)} />
      </div>
    );
  }

  return (
    <StatusCard
      type={StatusCardTypes.LOADING}
      title={label}
      className={className}
    />
  );
};
