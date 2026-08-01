"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { ComponentType } from "react";
import { ArrowBigLeft } from "lucide-react";
import { cn } from "./cn";
import { Button } from "@mydaogs/ui";
import { DialogDrawerFrame } from "./DialogDrawer";
import { adoptDialogShellContainer } from "./adoptDialogShellContainer";
import type {
  DialogShellApi,
  DialogShellEntry,
  DialogShellStackEntryView,
  DialogShellStackViewProps,
  DialogShellType,
} from "./dialog-shell/createDialogShellStore";

const SHELL_TYPE_CLASSNAMES: Record<DialogShellType, string> = {
  normal: "",
  dangerous: "bg-danger bg-[image:var(--danger-shell-grid-image)] bg-size-[70px_70px]",
};

const EMPTY_ENTRIES: readonly DialogShellEntry[] = [];

interface DialogShellChrome {
  isOpen: boolean;
  title: string;
  shellType: DialogShellType;
  className?: string;
  preventDialogOutsideInteraction: boolean;
  stackDepth: number;
  backContainer: HTMLElement | null;
}

const deriveChrome = (
  entries: readonly DialogShellEntry[],
): DialogShellChrome => {
  const live = entries.filter((entry) => entry.status === "active");
  const exiting = entries.filter((entry) => entry.status === "exiting");
  const top = live.at(-1) ?? exiting.at(-1) ?? null;

  return {
    // Deliberately live-only: while the last live entry is exiting (nothing
    // left to reveal behind it), the frame should start its own close
    // transition immediately with that entry's content still visible/
    // portaled (via its registrar's `isExiting` window), rather than
    // waiting for the stack view's exit animation to finish first and then
    // playing a second, separate close transition on an empty frame.
    isOpen: live.length > 0,
    title: top?.title ?? "",
    shellType: top?.shellType ?? "normal",
    className: top?.className,
    preventDialogOutsideInteraction: live.some(
      (entry) => entry.preventDialogOutsideInteraction,
    ),
    stackDepth: live.length,
    backContainer: live.length === 1 ? (top?.backContainer ?? null) : null,
  };
};

const deriveStackViewEntries = (
  entries: readonly DialogShellEntry[],
): readonly DialogShellStackEntryView[] => {
  const live = entries.filter((entry) => entry.status === "active");
  const exiting = entries.filter((entry) => entry.status === "exiting");

  return [
    ...live.map((entry, index) => ({
      id: entry.id,
      container: entry.container,
      backContainer: entry.backContainer,
      state: (index === live.length - 1 ? "active" : "covered") as
        | "active"
        | "covered",
    })),
    ...exiting.map((entry) => ({
      id: entry.id,
      container: entry.container,
      backContainer: entry.backContainer,
      state: "exiting" as const,
    })),
  ];
};

const BackContainerSlot = ({ container }: { container: HTMLElement }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = ref.current;
    if (!parent) return;
    return adoptDialogShellContainer(parent, container);
  }, [container]);

  return <div ref={ref} className="contents" />;
};

interface DialogShellHostProps {
  shell: DialogShellApi;
  stackView: ComponentType<DialogShellStackViewProps>;
  backLabel: string;
}

export const DialogShellHost = ({
  shell,
  stackView: StackView,
  backLabel,
}: DialogShellHostProps) => {
  const entries = useSyncExternalStore(
    shell.subscribe,
    shell.getState,
    () => EMPTY_ENTRIES,
  );
  const chrome = useMemo(() => deriveChrome(entries), [entries]);
  const stackViewEntries = useMemo(
    () => deriveStackViewEntries(entries),
    [entries],
  );

  const handleClose = useCallback(() => {
    shell.requestCloseAll();
  }, [shell]);

  const handleBack = useCallback(() => {
    shell.requestBack();
  }, [shell]);

  const handleEntryExitComplete = useCallback(
    (id: string) => {
      shell.settleExit(id);
    },
    [shell],
  );

  const backBtn = useMemo(() => {
    if (chrome.stackDepth > 1) {
      return (
        <Button
          type="button"
          variant="default"
          size="reset"
          aria-label={backLabel}
          className="absolute top-3 sm:top-0 left-3 sm:left-4 p-px sm:p-1 [&_svg]:size-8"
          onClick={handleBack}
        >
          <ArrowBigLeft />
        </Button>
      );
    }
    if (chrome.stackDepth === 1 && chrome.backContainer) {
      return <BackContainerSlot container={chrome.backContainer} />;
    }
    return undefined;
  }, [chrome.stackDepth, chrome.backContainer, handleBack, backLabel]);

  return (
    <DialogDrawerFrame
      isOpen={chrome.isOpen}
      title={chrome.title}
      className={cn(SHELL_TYPE_CLASSNAMES[chrome.shellType], chrome.className)}
      preventDialogOutsideInteraction={chrome.preventDialogOutsideInteraction}
      backBtn={backBtn}
      onClose={handleClose}
    >
      <StackView
        entries={stackViewEntries}
        onEntryExitComplete={handleEntryExitComplete}
      />
    </DialogDrawerFrame>
  );
};
