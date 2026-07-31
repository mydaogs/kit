"use client";

import { useEffect, useRef } from "react";
import { cn } from "./cn";
import { adoptDialogShellContainer } from "./adoptDialogShellContainer";
import type { DialogShellStackViewProps } from "./dialog-shell/createDialogShellStore";

const EntrySlot = ({
  container,
  isActive,
}: {
  container: HTMLElement;
  isActive: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = ref.current;
    if (!parent) return;
    return adoptDialogShellContainer(parent, container);
  }, [container]);

  return (
    <div
      ref={ref}
      className={cn(
        "h-full min-h-0 w-full",
        // The active slot stays in normal flow so it drives the stack
        // root's height (h-auto dialogs size to it; h-full ones just fill
        // it); covered slots are pulled out of flow so they can't add
        // height or be seen/interacted with.
        isActive
          ? "relative overflow-x-hidden overflow-y-auto"
          : "absolute inset-0 pointer-events-none invisible",
      )}
      aria-hidden={isActive ? undefined : true}
      inert={isActive ? undefined : true}
    />
  );
};

/**
 * No-animation default: pops settle immediately since there is no exit
 * transition to wait for. `apps/mhnt` supplies an animated implementation.
 */
export const DialogShellStackView = ({
  entries,
  onEntryExitComplete,
}: DialogShellStackViewProps) => {
  useEffect(() => {
    entries
      .filter((entry) => entry.state === "exiting")
      .forEach((entry) => onEntryExitComplete(entry.id));
  }, [entries, onEntryExitComplete]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      {entries
        .filter((entry) => entry.state !== "exiting")
        .map((entry) => (
          <EntrySlot
            key={entry.id}
            container={entry.container}
            isActive={entry.state === "active"}
          />
        ))}
    </div>
  );
};
