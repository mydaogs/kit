import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import * as React from "react";

import { cn } from "./cn";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-sm border border-border px-2 py-px text-sm font-base w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] overflow-hidden text-foreground shadow-lg shadow-foreground/30",
  {
    variants: {
      variant: {
        default: "bg-linear-to-br from-main/60 via-main/90 to-main/60",
        primary: "bg-linear-to-br from-primary/60 via-primary/90 to-primary/60",
        neutral:
          "bg-linear-to-br from-secondary/60 via-secondary/90 to-secondary/60",
        danger: "bg-linear-to-br from-danger/60 via-danger/90 to-danger/60",
        success: "bg-linear-to-br from-success/60 via-success/90 to-success/60",
        info: "bg-linear-to-br from-info/60 via-info/90 to-info/60",
        error: "bg-linear-to-br from-error/60 via-error/90 to-error/60",
      },
      size: {
        xs: "text-xs px-1 py-px",
        sm: "text-sm px-2 py-px",
        lg: "text-lg px-3 py-1",
        "4xl": "text-4xl px-4 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
