"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@mydaogs/ui";
import { cn } from "./cn";
import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Keep in sync with the CardContent grid transition below.
const COLLAPSE_TRANSITION_MS = 300;

// Run the scroll compensation after the DOM mutates but before paint. Falls back
// to useEffect during SSR (where layout effects no-op) to avoid the hydration
// warning.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Nearest scrollable ancestor, or null when the document (window) is the
// scroller. Keeps the compensation correct if this accordion is ever nested in
// an overflow container instead of scrolling the page.
const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    const scrollable =
      overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (scrollable && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

interface InfoCardAccordionProps {
  isDisabled?: boolean;
  title: string;
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Labels shown next to the chevron. Default to English — pass translated
   * strings from the consuming app. */
  expandLabel?: string;
  collapseLabel?: string;
}

export const InfoCardAccordion = ({
  isDisabled = false,
  title,
  children,
  className,
  isOpen,
  onToggle,
  expandLabel = "Expand",
  collapseLabel = "Collapse",
}: InfoCardAccordionProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  // Viewport-relative top of this card captured at click time; the layout effect
  // reads it to pin the card across the toggle's reflow. Null means "no click to
  // compensate" (e.g. the programmatic auto-open on mount).
  const anchorTopRef = useRef<number | null>(null);

  // FLIP-style scroll compensation. In a single-open group, opening a card
  // collapses a sibling; when that sibling sits ABOVE the clicked card the
  // document shrinks and the clicked card jumps upward, stranding the user in
  // the newly empty space below. Instead of scrolling after the collapse
  // animation finishes (which lagged behind it), we freeze the clicked card in
  // place: synchronously — after the DOM mutates but before paint — scroll by
  // exactly the delta so the card never visibly moves. The sibling's collapse
  // happens off-screen and is invisible. This requires the collapse to be
  // instant (no height transition below), so the post-toggle layout is final in
  // this single pass. Runs only for a real click (anchorTopRef set).
  useIsomorphicLayoutEffect(() => {
    const prevTop = anchorTopRef.current;
    anchorTopRef.current = null;
    if (prevTop == null) return;
    const el = cardRef.current;
    if (!el) return;
    const delta = el.getBoundingClientRect().top - prevTop;
    if (delta === 0) return;
    const scrollParent = getScrollParent(el);
    if (scrollParent) {
      scrollParent.scrollTop += delta;
    } else {
      window.scrollBy(0, delta);
    }
  }, [isOpen]);

  // The grid-rows 0fr collapse only clips the content visually; Chromium still
  // counts the overflowing children in the root scroller's scrollHeight, which
  // leaves dead space below the page footer once an accordion is folded. Drop
  // the content out of layout shortly after folding (kept mounted so form state
  // survives) so the document height actually shrinks.
  const [keepRendered, setKeepRendered] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      setKeepRendered(true);
      return;
    }
    const timeout = setTimeout(
      () => setKeepRendered(false),
      COLLAPSE_TRANSITION_MS,
    );
    return () => clearTimeout(timeout);
  }, [isOpen]);

  const onClick = () => {
    if (isDisabled) return;
    // Record where the card sits now so the layout effect can pin it there
    // across the reflow this toggle triggers (open or close).
    anchorTopRef.current = cardRef.current?.getBoundingClientRect().top ?? null;
    onToggle();
  };

  return (
    <Card
      ref={cardRef}
      className={cn("w-full min-w-0 max-w-lg overflow-clip pt-0", className, {
        "pb-4 gap-2": isOpen,
        "pb-0 gap-0": !isOpen,
        "opacity-80": isDisabled,
      })}
    >
      <CardHeader className="w-full px-0">
        <CardTitle
          role={isDisabled ? undefined : "button"}
          tabIndex={isDisabled ? undefined : 0}
          className={cn(
            "flex justify-between items-center bg-linear-to-l from-accent-foreground/90 to-accent-foreground/50 border-foreground px-4 py-px cursor-pointer",
            {
              "border-b-(length:--border-width-base)": isOpen,
              "border-b-0": !isOpen,
            },
            { "cursor-not-allowed": isDisabled },
          )}
          onClick={onClick}
        >
          <span className="font-mono text-sm text-primary/90">
            <ChevronDown
              className={cn("size-6 mr-1 inline-block", {
                "rotate-180": isOpen,
              })}
            />
            {isOpen ? collapseLabel : expandLabel}
          </span>
          <span className="text-lg font-light font-mono text-main/90">{`.${title}`}</span>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn("grid px-2 lg:px-5", {
          // Collapse is instant (no transition) so the post-toggle layout is
          // final in a single pass for the scroll compensation above; the open
          // direction still animates, growing below the pinned header.
          "grid-rows-[0fr]": !isOpen,
          "grid-rows-[1fr] transition-all duration-300 ease-in-out": isOpen,
        })}
      >
        <div
          className={cn("min-w-0 overflow-hidden", {
            hidden: !isOpen && !keepRendered,
          })}
        >
          <div className="flex min-w-0 flex-col gap-3 p-1">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
};
