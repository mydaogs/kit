import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import * as React from "react";

import { cn } from "./cn";

// Always applied, even when variant="unset" — layout/interaction, not skin.
const LAYOUT =
  "inline-flex items-center justify-center text-center text-nowrap gap-2 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 disabled:cursor-not-allowed ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
// Only applied when variant !== "unset" — the escape hatch for a consumer
// that wants Button's behavior and accessibility wiring with none of its
// visual opinions.
const SKIN =
  "rounded-base text-sm font-base text-main-foreground/[var(--text-opacity)] border-main-foreground/100 [--bg-opacity:100%] [--text-opacity:100%] disabled:[--bg-opacity:50%] disabled:[--text-opacity:50%]";

const cvaButton = cva(LAYOUT, {
  variants: {
    variant: {
      default:
        "bg-main/[var(--bg-opacity)] border-(length:--border-width-base) border-border shadow-shadow hover:brightness-90 active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none",
      danger:
        "bg-danger/[var(--bg-opacity)] border-(length:--border-width-base) border-border shadow-shadow hover:brightness-90 active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none",
      primary:
        "bg-primary/[var(--bg-opacity)] border-(length:--border-width-base) border-border shadow-shadow hover:brightness-90 active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none",
      secondary:
        "bg-secondary/[var(--bg-opacity)] border-(length:--border-width-base) border-border shadow-shadow hover:brightness-90 active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none",
      outline:
        "hover:bg-accent-foreground/[var(--bg-opacity)] border-(length:--border-width-base) border-border/0 hover:border-border/100 rounded-full font-mono",
      ghost: "bg-none border-none shadow-none",
      flat: "bg-main/[var(--bg-opacity)] hover:bg-secondary/[var(--bg-opacity)] shadow-transparent border font-mono",
      link: "underline hover:text-accent-foreground",
      side: "bg-linear-to-br from-background/50 via-background/[var(--bg-opacity)] to-background/50 hover:from-secondary/50 hover:to-secondary/50 border-(length:--border-width-base) border-l-(length:--border-width-base) rounded-l-none rounded-r-lg group-focus-within/focusable:ring-2 ring-ring",
      // Escape hatch: no rounding, no border, no text/bg opacity vars — just
      // LAYOUT plus whatever the consumer passes through `className`. `size`
      // is a separate axis and still applies its own classes on top (e.g.
      // the `default` size's h-10 px-4 py-2 text-lg) unless the consumer
      // also passes `size="reset"`.
      unset: "",
    },
    size: {
      default: "h-10 px-4 py-2 text-lg",
      reset: "h-auto p-0",
      sm: "h-9 px-3 text-sm",
      lg: "h-11 px-6 text-xl",
      icon: "size-10",
      side: "px-4 h-12",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

type ButtonVariantsOptions = VariantProps<typeof cvaButton> & {
  className?: string;
};

// The variant !== "unset" gate lives here, not in the Button component below,
// so every other caller of buttonVariants (calendar.tsx, pagination.tsx,
// sonner.tsx, CaptureBtn.tsx) gets the same gating for free.
const buttonVariants = ({ variant, size, className }: ButtonVariantsOptions = {}) =>
  cn(variant !== "unset" && SKIN, cvaButton({ variant, size }), className);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
export type { VariantProps };
