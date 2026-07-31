"use client";

import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { cn } from "./cn";
import { Button } from "@mydaogs/ui";

export interface LoadingButtonProps extends React.ComponentProps<
  typeof Button
> {
  isLoading?: boolean;
  loadingLabel?: string;
  loadingIndicatorClassName?: string;
  loadingContainerClassName?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export const LoadingButton = ({
  isLoading = false,
  loadingLabel,
  loadingIndicatorClassName,
  loadingContainerClassName,
  disabled,
  children,
  ref,
  ...props
}: LoadingButtonProps) => {
  return (
    <Button
      ref={ref}
      disabled={isLoading || disabled}
      aria-disabled={isLoading || disabled}
      {...props}
      className={props.className}
    >
      {isLoading ? (
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2",
            loadingContainerClassName,
          )}
        >
          <LoaderCircle
            aria-hidden="true"
            className={cn("animate-spin", loadingIndicatorClassName)}
          />
          {loadingLabel ? (
            <span className="sr-only">{loadingLabel}</span>
          ) : null}
        </span>
      ) : (
        children
      )}
    </Button>
  );
};
