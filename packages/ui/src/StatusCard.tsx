import type { ValueOf } from "@mydaogs/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "./cn";
import { AlertTriangle, Ban, Check, LoaderCircle } from "lucide-react";

export const StatusCardTypes = {
  LOADING: "LOADING",
  ERROR: "ERROR",
  WARN: "WARN",
  SUCCESS: "SUCCESS",
} as const;
export type StatusCardType = ValueOf<typeof StatusCardTypes>;

const STATUS_CARD_ICONS = {
  [StatusCardTypes.ERROR]: <Ban className="inline-block mr-2 h-8 w-8" />,
  [StatusCardTypes.LOADING]: (
    <LoaderCircle className="inline-block mr-2 animate-spin h-8 w-8" />
  ),
  [StatusCardTypes.SUCCESS]: <Check className="inline-block mr-2 h-8 w-8" />,
  [StatusCardTypes.WARN]: (
    <AlertTriangle className="inline-block mr-2 h-8 w-8" />
  ),
} as const;
interface StatusCardProps {
  className?: string;
  title: string;
  description?: string;
  type?: StatusCardType;
  children?: React.ReactNode;
}

export const StatusCard = ({
  className,
  title,
  description,
  type = StatusCardTypes.SUCCESS,
  children,
}: StatusCardProps) => {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        {
          "bg-linear-to-tr from-warn/0 via-warn to-warn/0":
            type === StatusCardTypes.WARN,
        },
        {
          "bg-linear-to-tr from-error/0 via-error to-error/0":
            type === StatusCardTypes.ERROR,
        },
        {
          "bg-linear-to-tr from-success/0 via-success to-success/0":
            type === StatusCardTypes.SUCCESS,
        },
        {
          "bg-linear-to-tr from-info/0 via-info to-info/0":
            type === StatusCardTypes.LOADING,
        },
        className,
      )}
    >
      <CardHeader className="text-center">
        <CardTitle className="font-mono text-2xl">
          {STATUS_CARD_ICONS[type]}
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="font-sans text-lg text-card">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      {children ? (
        <CardContent className="flex w-full justify-center items-center">
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
};
