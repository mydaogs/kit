"use client";

import { useState } from "react";
import { Button, buttonVariants, type VariantProps } from "@mydaogs/ui";
import { cn } from "./cn";
import { CaptureBtnBg } from "./CaptureBtnBg";

type CaptureBtnShape = "square" | "horizontal";

export interface CaptureBtnProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  shape?: CaptureBtnShape;
  isActive?: boolean;
  wrapperClassName?: string;
}

export const CaptureBtn = ({
  children,
  className,
  wrapperClassName,
  shape = "square",
  isActive = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  asChild,
  ...rest
}: CaptureBtnProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const isFocused = isActive || isHovered;

  return (
    <div className={cn("relative inline-flex", wrapperClassName)}>
      <CaptureBtnBg isActive={isFocused} />
      <Button
        className={cn(
          "relative z-10 p-2",
          {
            "aspect-square": shape === "square",
          },
          className,
        )}
        variant="ghost"
        size="reset"
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          setIsHovered(true);
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          setIsHovered(false);
        }}
        onFocus={(e) => {
          onFocus?.(e);
          setIsHovered(true);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setIsHovered(false);
        }}
        asChild={asChild}
        {...rest}
      >
        {children}
      </Button>
    </div>
  );
};
