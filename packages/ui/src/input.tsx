"use client";

import * as React from "react";

import { cn } from "./cn";
import { truncateText } from "./truncateText";

const MIN_VISIBLE_TRUNCATED_LENGTH = 8;

interface AppInputProps extends React.ComponentProps<"input"> {
  sideContent?: React.ReactNode;
  containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, AppInputProps>(function Input(
  { className, containerClassName, sideContent, type, ...props },
  forwardedRef,
) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [maxLen, setMaxLen] = React.useState(MIN_VISIBLE_TRUNCATED_LENGTH);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep the internal measurement ref while also exposing the DOM node to the
  // caller (e.g. react-hook-form's `field.ref` for focus-on-error).
  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const calculateMaxLen = React.useCallback(() => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const style = window.getComputedStyle(input);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const availableWidth = input.clientWidth - paddingLeft - paddingRight;

    const measureSpan = document.createElement("span");
    measureSpan.style.font = style.font;
    measureSpan.style.fontSize = style.fontSize;
    measureSpan.style.fontFamily = style.fontFamily;
    measureSpan.style.visibility = "hidden";
    measureSpan.style.position = "absolute";
    measureSpan.style.whiteSpace = "nowrap";
    measureSpan.textContent = "0x12345678";
    document.body.appendChild(measureSpan);
    const actualCharWidth = measureSpan.offsetWidth / 10;
    document.body.removeChild(measureSpan);

    const calculatedMaxLen = Math.floor(availableWidth / actualCharWidth);
    setMaxLen(
      Math.max(MIN_VISIBLE_TRUNCATED_LENGTH, Math.min(calculatedMaxLen, 150)),
    );
  }, []);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const frameId = window.requestAnimationFrame(calculateMaxLen);
    const resizeObserver = new ResizeObserver(calculateMaxLen);
    resizeObserver.observe(input);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [calculateMaxLen]);

  const displayValue = React.useMemo(() => {
    if (isFocused || !props.value) {
      return props.value;
    }

    const stringValue = String(props.value);

    if (stringValue.length <= maxLen) {
      return props.value;
    }

    return truncateText({
      value: stringValue,
      maxLen,
      cutFrom: "end",
    });
  }, [isFocused, props.value, maxLen]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 rounded-base group/focusable",
        sideContent && "focus-within:ring-2 ring-ring",
        containerClassName,
      )}
    >
      <input
        type={type}
        data-slot="input"
        className={cn(
          "min-w-0 flex-1 rounded-base border-2 border-border pl-3 py-2 text-lg font-base text-foreground placeholder:text-foreground/50 placeholder:text-sm focus-visible:outline-hidden disabled:cursor-not-allowed font-mono bg-secondary/80 disabled:bg-foreground/15",
          sideContent
            ? "rounded-r-none border-r-0"
            : "focus-visible:ring-2 ring-ring",
          className,
        )}
        {...props}
        ref={setRefs}
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {sideContent ?? null}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
