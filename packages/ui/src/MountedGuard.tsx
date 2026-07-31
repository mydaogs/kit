"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

let hydrated = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitHydrated() {
  hydrated = true;
  listeners.forEach((cb) => cb());
}

export const MountedGuard = ({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const isMounted = useSyncExternalStore(
    useCallback((onStoreChange) => {
      const unsub = subscribe(onStoreChange);
      if (!hydrated) {
        emitHydrated();
      }
      return unsub;
    }, []),
    () => hydrated,
    () => false,
  );

  if (!isMounted) {
    return fallback;
  }

  return children;
};
