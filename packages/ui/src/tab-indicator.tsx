"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

import type { IndicatorStyle } from "./hooks/useIndicatorPosition";

const tabIndicatorVariants = cva(
  "pointer-events-none absolute left-0 top-0 transition-[transform,width,height,opacity] duration-200 ease-in-out",
  {
    variants: {
      variant: {
        default: "rounded-lg bg-main",
        "flat-bottom": "rounded-t-full rounded-b-none bg-main",
        inverted: "rounded-lg bg-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type TabIndicatorVariant = VariantProps<
  typeof tabIndicatorVariants
>["variant"];

export type TabIndicatorProps = {
  indicatorStyle: IndicatorStyle | null;
  isReady: boolean;
  className?: string;
} & VariantProps<typeof tabIndicatorVariants>;

export function TabIndicator({
  indicatorStyle,
  isReady,
  className,
  variant,
}: TabIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(tabIndicatorVariants({ variant }), className)}
      style={{
        width: indicatorStyle?.width ?? 0,
        height: indicatorStyle?.height ?? 0,
        transform: `translate(${indicatorStyle?.left ?? 0}px, ${indicatorStyle?.top ?? 0}px)`,
        opacity: isReady && indicatorStyle ? 1 : 0,
      }}
    />
  );
}
