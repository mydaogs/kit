import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { cn } from "./cn";
import type { ReactNode } from "react";

interface InfoCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export const InfoCard = ({
  title,
  children,
  className,
  footer,
}: InfoCardProps) => (
  <Card className={cn("min-w-0 pt-0", className)}>
    <CardHeader className="w-full px-0">
      <CardTitle className="bg-linear-to-l from-accent-foreground/90 to-accent-foreground/50 border-b-2 border-foreground px-4 py-px text-lg font-light font-mono text-end text-main/90">
        {`.${title}`}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex min-w-0 flex-col gap-3">
      {children}
      {footer}
    </CardContent>
  </Card>
);
