import { cn } from "./cn";
import type { ElementType, ReactNode } from "react";

interface QuoteProps {
  children: ReactNode;
  className?: string;
  tag?: ElementType;
}

export const Quote = ({ children, className, tag = "h3" }: QuoteProps) => {
  const Tag = tag;

  return (
    <Tag
      className={cn(
        "text-foreground/90 border-l-4 border-accent-foreground/70 px-6 py-2 bg-linear-to-r from-accent-foreground/20 to-accent-foreground/0 text-start",
        className,
      )}
    >
      {children}
    </Tag>
  );
};
