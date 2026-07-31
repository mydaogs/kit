"use client";

import { useBreakpoint } from "./hooks/useBreakpoint";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { StatusCardLoading } from "./StatusCardLoading";

interface TooltipPopoverProps {
  className?: string;
  triggerClassName?: string;
  isFullWidth?: boolean;
  children: ReactNode;
  content: ReactNode | (() => Promise<ReactNode>);
}

const AsyncContent = ({
  content,
}: {
  content: ReactNode | (() => Promise<ReactNode>);
}) => {
  const [renderedContent, setRenderedContent] = useState<ReactNode>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (typeof content === "function") {
      setIsLoading(true);
      setError(null);

      content()
        .then((result) => {
          if (isMounted) {
            setRenderedContent(result);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(
              err instanceof Error ? err.message : "Failed to load content",
            );
            setIsLoading(false);
          }
        });
    } else {
      setRenderedContent(content);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [content]);

  if (isLoading) {
    return <StatusCardLoading variant="compact" className="p-4" />;
  }

  if (error) {
    return <div className="text-destructive text-sm p-2">{error}</div>;
  }

  return <>{renderedContent}</>;
};

const TooltipWrapper = ({
  className,
  triggerClassName,
  isFullWidth = true,
  children,
  content,
}: TooltipPopoverProps) => {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              isFullWidth ? "block w-full" : "inline-block",
              triggerClassName,
            )}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className={className}>
          <AsyncContent content={content} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const PopoverWrapper = ({
  className,
  triggerClassName,
  isFullWidth = true,
  children,
  content,
}: TooltipPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn(
            isFullWidth ? "block w-full" : "inline-block",
            triggerClassName,
          )}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent className={className}>
        {isOpen && <AsyncContent content={content} />}
      </PopoverContent>
    </Popover>
  );
};

export const TooltipPopover = (props: TooltipPopoverProps) => {
  const isWindowOverSM = useBreakpoint("sm");
  const Comp = isWindowOverSM ? TooltipWrapper : PopoverWrapper;
  return <Comp {...props} />;
};
