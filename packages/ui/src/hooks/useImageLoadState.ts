"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const MAX_CACHED_IMAGE_KEYS = 200;
const loadedImageSources = new Set<string>();
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const getCacheKey = (cacheScope: string, resolvedSrc: string) =>
  `${cacheScope}:${resolvedSrc}`;

const rememberLoadedImageSource = (cacheKey: string) => {
  loadedImageSources.delete(cacheKey);
  loadedImageSources.add(cacheKey);

  if (loadedImageSources.size <= MAX_CACHED_IMAGE_KEYS) return;

  while (loadedImageSources.size > MAX_CACHED_IMAGE_KEYS) {
    const oldestKey = loadedImageSources.keys().next().value as
      | string
      | undefined;

    if (oldestKey === undefined) break;

    loadedImageSources.delete(oldestKey);
  }
};

export const useImageLoadState = (
  resolvedSrc: string,
  cacheScope = "default",
) => {
  const cacheKey = getCacheKey(cacheScope, resolvedSrc);
  const [isLoaded, setIsLoaded] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setIsLoaded(loadedImageSources.has(cacheKey));
  }, [cacheKey]);

  const markLoaded = () => {
    rememberLoadedImageSource(cacheKey);
    setIsLoaded(true);
  };

  const markError = () => {
    setIsLoaded(true);
  };

  return { isLoaded, markLoaded, markError };
};
