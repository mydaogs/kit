"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

export type IndicatorStyle = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type UseIndicatorPositionOptions<T extends HTMLElement> = {
  containerRef: RefObject<T | null>;
  itemRefs: RefObject<Map<string, HTMLElement>>;
  activeValue: string | null;
};

export type UseIndicatorPositionResult = {
  indicatorStyle: IndicatorStyle | null;
  isReady: boolean;
};

export function useIndicatorPosition<T extends HTMLElement>({
  containerRef,
  itemRefs,
  activeValue,
}: UseIndicatorPositionOptions<T>): UseIndicatorPositionResult {
  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle | null>(
    null,
  );
  const [isReady, setIsReady] = useState(false);

  const computeIndicator = useCallback((): IndicatorStyle | null => {
    if (!containerRef.current || !activeValue) {
      return null;
    }

    const targetNode = itemRefs.current.get(activeValue);
    if (!targetNode) {
      return null;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();
    const containerStyles = getComputedStyle(containerRef.current);
    const borderLeft = parseFloat(containerStyles.borderLeftWidth) || 0;
    const borderTop = parseFloat(containerStyles.borderTopWidth) || 0;

    // Ensure we have valid dimensions
    if (targetRect.width === 0) {
      return null;
    }

    return {
      // Subtract border because indicator's left-0/top-0 is relative to padding edge
      left: targetRect.left - containerRect.left - borderLeft,
      top: targetRect.top - containerRect.top - borderTop,
      width: targetRect.width,
      height: targetRect.height,
    };
  }, [containerRef, itemRefs, activeValue]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    let rafId: number | null = null;
    let retryCount = 0;
    const maxRetries = 5;

    const updateIndicator = () => {
      const result = computeIndicator();
      if (result) {
        setIndicatorStyle(result);
        if (!isReady) {
          // Small delay before showing to ensure position is stable
          rafId = requestAnimationFrame(() => {
            setIsReady(true);
          });
        }
      } else if (retryCount < maxRetries) {
        // Item might not be registered yet, retry
        retryCount++;
        rafId = requestAnimationFrame(updateIndicator);
      }
    };

    updateIndicator();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const result = computeIndicator();
            if (result) {
              setIndicatorStyle(result);
            }
          })
        : null;

    if (observer) {
      observer.observe(containerRef.current);
      itemRefs.current.forEach((node) => observer.observe(node));
    } else {
      const handleResize = () => {
        const result = computeIndicator();
        if (result) {
          setIndicatorStyle(result);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener("resize", handleResize);
      };
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [containerRef, itemRefs, activeValue, computeIndicator, isReady]);

  return { indicatorStyle, isReady };
}
