"use client";

import { useState, useCallback, useLayoutEffect } from "react";

const RESIZE_THROTTLE_DELAY = 150;

function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
): { run: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastRan = 0;

  const run = (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRan >= delay) {
      func(...args);
      lastRan = now;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastRan = Date.now();
        },
        delay - (now - lastRan),
      );
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { run, cancel };
}

export const useWindowSize = () => {
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
  });

  const handleResize = useCallback(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  useLayoutEffect(() => {
    handleResize();
    const throttledResize = throttle(handleResize, RESIZE_THROTTLE_DELAY);

    window.addEventListener("resize", throttledResize.run);

    return () => {
      window.removeEventListener("resize", throttledResize.run);
      throttledResize.cancel();
    };
  }, [handleResize]);

  return dimensions;
};
