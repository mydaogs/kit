"use client";

import { cn } from "./cn";
import { truncateText, type TruncateTextProps } from "./truncateText";
import { CopyToClipboardBtn } from "./CopyToClipboardBtn";
import { TooltipPopover } from "./TooltipPopover";
import { useState, useCallback, useMemo, useRef } from "react";

export interface TruncatedStringProps extends Omit<
  TruncateTextProps,
  "value"
> {
  className?: string;
  children: string | undefined;
  isFullWidth?: boolean;
  underlineWhenTruncated?: boolean;
}

export const TruncatedString = ({
  className,
  isFullWidth = true,
  underlineWhenTruncated = true,
  maxLen,
  cutFrom = "end",
  children = "",
}: TruncatedStringProps) => {
  const [calculatedMaxLen, setCalculatedMaxLen] = useState<number | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  // Measure span width and calculate truncation length
  const measureRef = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) {
        spanRef.current = node;

        const calculateMaxLen = () => {
          if (!spanRef.current) return;
          const span = spanRef.current;

          // Find the constraining container.
          // The span and any inline / inline-block wrapper (e.g. the tooltip
          // trigger) shrink-to-fit their own content, so measuring them is
          // circular once the text has been truncated. Climb to the nearest
          // block-level ancestor, whose content width is a stable reference.
          let container = span.parentElement;
          if (!container) return;

          while (
            container.parentElement &&
            window.getComputedStyle(container).display.includes("inline")
          ) {
            container = container.parentElement;
          }

          const containerStyle = window.getComputedStyle(container);
          const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
          const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
          const borderLeft = parseFloat(containerStyle.borderLeftWidth) || 0;
          const borderRight = parseFloat(containerStyle.borderRightWidth) || 0;

          // Full content width of the block container.
          const fullWidth =
            container.offsetWidth -
            paddingLeft -
            paddingRight -
            borderLeft -
            borderRight;

          if (fullWidth <= 0) return;

          // For inline usage, also measure the room left on the line after any
          // preceding content (e.g. a label) so the value can fill the rest of
          // that line. This is derived from the preceding content's geometry,
          // which does NOT depend on whether this value wraps, so resizing stays
          // reversible (a previous span-position-based version was sticky).
          let lineWidth = -1;
          if (!isFullWidth) {
            let flowEl: HTMLElement = span;
            while (flowEl.parentElement && flowEl.parentElement !== container) {
              flowEl = flowEl.parentElement;
            }
            if (flowEl.parentElement === container) {
              const range = document.createRange();
              range.setStart(container, 0);
              range.setEndBefore(flowEl);
              const rects = range.getClientRects();
              const last = rects[rects.length - 1];
              if (last && last.width > 0) {
                const contentRight =
                  container.getBoundingClientRect().right -
                  paddingRight -
                  borderRight;
                lineWidth = contentRight - last.right;
              }
            }
          }

          // Rather than estimate an average character width (inaccurate across
          // fonts/weights/kerning), measure real rendered width with a hidden
          // node that copies the span's exact typography.
          const spanStyle = window.getComputedStyle(span);
          const measureSpan = document.createElement("span");
          measureSpan.style.position = "absolute";
          measureSpan.style.left = "-9999px";
          measureSpan.style.top = "0";
          measureSpan.style.visibility = "hidden";
          measureSpan.style.whiteSpace = "nowrap";
          measureSpan.style.fontFamily = spanStyle.fontFamily;
          measureSpan.style.fontSize = spanStyle.fontSize;
          measureSpan.style.fontWeight = spanStyle.fontWeight;
          measureSpan.style.fontStyle = spanStyle.fontStyle;
          measureSpan.style.fontVariant = spanStyle.fontVariant;
          measureSpan.style.letterSpacing = spanStyle.letterSpacing;
          measureSpan.style.wordSpacing = spanStyle.wordSpacing;
          measureSpan.style.textTransform = spanStyle.textTransform;
          document.body.appendChild(measureSpan);

          const widthOf = (text: string) => {
            measureSpan.textContent = text;
            return measureSpan.getBoundingClientRect().width;
          };

          // Largest length whose rendered width fits `avail`. A truncation of
          // length n is ~as wide as the first n glyphs (the single "…" marker is
          // one glyph wide in the monospace contexts this is used in).
          const fit = (avail: number) => {
            if (avail <= 0) return 0;
            if (widthOf(children) <= avail) return children.length;
            let lo = 1;
            let hi = children.length;
            let b = 0;
            while (lo <= hi) {
              const mid = (lo + hi) >> 1;
              if (widthOf(children.slice(0, mid)) <= avail) {
                b = mid;
                lo = mid + 1;
              } else {
                hi = mid - 1;
              }
            }
            return b;
          };

          const MIN = 12;
          // Keep it on the current line while a useful amount fits there;
          // otherwise let it wrap to its own line and use the full width.
          const onLine = lineWidth > 0 ? fit(lineWidth) : 0;
          const best = onLine >= MIN ? onLine : fit(fullWidth);

          document.body.removeChild(measureSpan);

          setCalculatedMaxLen(Math.max(MIN, Math.min(best, 150)));
        };

        setTimeout(calculateMaxLen, 100);

        const resizeObserver = new ResizeObserver(calculateMaxLen);
        // Observe the outer layout container so truncation recalculates on resize.
        const container = node.parentElement?.parentElement;
        if (container) {
          resizeObserver.observe(container);
        }

        return () => {
          resizeObserver.disconnect();
        };
      }
      // Re-measure if the measured value or layout mode changes.
    },
    [children, isFullWidth],
  );

  // Use the smaller of user-provided maxLen or calculated maxLen
  const effectiveMaxLen = useMemo(() => {
    if (maxLen !== undefined && calculatedMaxLen !== null) {
      return Math.min(maxLen, calculatedMaxLen);
    }
    return maxLen ?? calculatedMaxLen ?? 12;
  }, [maxLen, calculatedMaxLen]);

  const displayValue = useMemo(() => {
    if (children.length <= effectiveMaxLen) {
      return children;
    }
    return truncateText({
      value: children,
      maxLen: effectiveMaxLen,
      cutFrom,
    });
  }, [children, effectiveMaxLen, cutFrom]);

  const isTruncated = children.length > effectiveMaxLen;

  if (!isTruncated) {
    return (
      <span
        ref={measureRef}
        className={cn(
          isFullWidth ? "block" : "inline-block",
          // whitespace-nowrap keeps the truncated value on a single line even
          // when an ancestor sets overflow-wrap/break rules (e.g. prose), which
          // would otherwise break a space-less value and overlap nearby lines.
          "max-w-full whitespace-nowrap",
          className,
        )}
      >
        {displayValue}
      </span>
    );
  }

  return (
    <TooltipPopover
      isFullWidth={isFullWidth}
      triggerClassName={className}
      content={
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm break-all">{children}</span>
          <CopyToClipboardBtn value={children} size="icon" variant="ghost" />
        </div>
      }
      className="cursor-auto"
    >
      <span
        ref={measureRef}
        className={cn(
          isFullWidth ? "block" : "inline-block",
          "max-w-full whitespace-nowrap cursor-pointer",
          underlineWhenTruncated &&
            "underline decoration-dotted underline-offset-2",
        )}
      >
        {displayValue}
      </span>
    </TooltipPopover>
  );
};
