"use client";

import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { DialogShellHost } from "./DialogShellHost";
import { DialogShellStackView } from "./DialogShellStackView";
import { DialogShellContext } from "./DialogShellContext";
import {
  createDialogShellStore,
  type DialogShellStackViewProps,
} from "./dialog-shell/createDialogShellStore";

export interface DialogShellProviderProps {
  children: ReactNode;
  /** Defaults to the non-animated `DialogShellStackView`. */
  stackView?: ComponentType<DialogShellStackViewProps>;
  /**
   * aria-label for the generic "pop one level" back button shown at stack
   * depth > 1. `@mydaogs/ui` has no i18n setup of its own (consumers may not
   * even use next-intl), so this defaults to the hardcoded English string —
   * matching the existing precedent of `dialog.tsx`'s own sr-only "Close"
   * text — and an app that does use next-intl can pass its translated value
   * instead.
   */
  backLabel?: string;
}

/**
 * Mounts the single dialog shell host. Required above every `DialogDrawer`
 * usage.
 */
export const DialogShellProvider = ({
  children,
  stackView,
  backLabel = "Back",
}: DialogShellProviderProps) => {
  const [store] = useState(createDialogShellStore);

  return (
    <DialogShellContext.Provider value={store}>
      {children}
      <DialogShellHost
        shell={store}
        stackView={stackView ?? DialogShellStackView}
        backLabel={backLabel}
      />
    </DialogShellContext.Provider>
  );
};
