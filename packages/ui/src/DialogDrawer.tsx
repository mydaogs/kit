"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ComponentProps, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { cn } from "./cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./drawer";
import { DialogShellContext } from "./DialogShellContext";
import type {
  DialogShellRole,
  DialogShellType,
} from "./dialog-shell/createDialogShellStore";

export interface DialogDrawerFrameProps {
  className?: string;
  children: ReactNode;
  title: string;
  isOpen: boolean;
  backBtn?: ReactNode;
  preventDialogOutsideInteraction?: boolean;
  onClose: () => void;
}

export interface DialogDrawerProps {
  className?: string;
  children: ReactNode;
  title: string;
  isOpen: boolean;
  backBtn?: ReactNode;
  preventDialogOutsideInteraction?: boolean;
  onClose: () => void;
  shellType?: DialogShellType;
  shellRole?: DialogShellRole;
  baseKey?: string;
}

const DialogWrapper = ({
  isOpen,
  className,
  children,
  title,
  backBtn,
  onClose,
  preventDialogOutsideInteraction,
}: DialogDrawerFrameProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
      <DialogContent
        className={cn("overflow-hidden py-0", className)}
        preventDialogOutsideInteraction={preventDialogOutsideInteraction}
      >
        <DialogHeader className="relative">
          <DialogTitle className="text-center font-medium font-sans text-3xl text-muted-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {`Dialog content for ${title}`}
          </DialogDescription>
          {backBtn}
        </DialogHeader>
        <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto py-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Grace window after a drag-release close attempt before assuming it was
// refused (a guarded top entry) rather than merely mid-flight. Longer than
// the store's own `CLOSE_ALL_ACK_TIMEOUT_MS` (300ms) so a legitimate
// multi-hop pop chain has room to finish propagating `isOpen` down through
// the shell before this fires.
const DRAG_DISMISS_RESET_DELAY_MS = 450;

const DrawerWrapper = ({
  className,
  children,
  title,
  isOpen,
  backBtn,
  onClose,
  preventDialogOutsideInteraction,
}: DialogDrawerFrameProps) => {
  // vaul's own `closeDrawer()` (fired on a drag-past-threshold or
  // fast-flick release, verified against its 1.1.2 source) calls `onClose`
  // but never resets the drag transform it applied to the drawer's DOM node
  // during the gesture — it assumes `open` will shortly become `false`,
  // unmounting the node via its own CSS close transition. When a guarded
  // top entry refuses the close (`onClose` no-ops, `isOpen` never changes),
  // that assumption breaks: the node stays mounted at whatever offset the
  // drag left it, indefinitely (not "snapped back" — there is nothing in
  // vaul that does that for this path). Remounting the drawer (key bump)
  // forces vaul to reinitialize its drag state from scratch instead; the
  // portaled `children` survive via their registrar-owned container being
  // re-adopted into the new instance, the same as a `sm`-breakpoint swap.
  const [remountKey, setRemountKey] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  // Only a drag release that attempted to close (vaul's `onRelease` fires
  // for every release, with `open` telling us whether it did) can leave the
  // transform stranded — Escape and outside-click dismissals never touch
  // it, so arming this recovery for them would just replay the open
  // animation on a refusal for no reason.
  const handleRelease: NonNullable<ComponentProps<typeof Drawer>["onRelease"]> =
    useCallback(
      (_event, open) => {
        if (open) return;
        clearResetTimer();
        resetTimerRef.current = setTimeout(() => {
          resetTimerRef.current = null;
          setRemountKey((key) => key + 1);
        }, DRAG_DISMISS_RESET_DELAY_MS);
      },
      [clearResetTimer],
    );

  // The scheduled recovery only means anything while THIS attempt is still
  // unresolved. The moment `isOpen` is observed false, the attempt
  // succeeded — cancel it so an unrelated dialog opening later within the
  // grace window can't be mistaken for the original refusal and get
  // force-remounted right after it opens.
  useEffect(() => {
    if (!isOpen) clearResetTimer();
  }, [isOpen, clearResetTimer]);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  return (
    <Drawer
      key={remountKey}
      open={isOpen}
      onClose={onClose}
      onRelease={handleRelease}
      autoFocus={isOpen}
    >
      <DrawerContent
        className={cn("overflow-hidden py-2", className)}
        preventDialogOutsideInteraction={preventDialogOutsideInteraction}
      >
        <DrawerHeader className="relative">
          <DrawerTitle className="text-center font-medium font-sans text-3xl text-muted-foreground">
            {title}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {`Drawer content for ${title}`}
          </DrawerDescription>
        </DrawerHeader>
        <div
          data-vaul-no-drag
          className="h-full min-h-0 overflow-x-hidden overflow-y-auto"
        >
          {children}
        </div>
        {backBtn}
      </DrawerContent>
    </Drawer>
  );
};

/**
 * Package-internal shell chrome, rendered exactly once by `DialogShellHost`.
 * Not re-exported from the package barrels.
 */
export const DialogDrawerFrame = (props: DialogDrawerFrameProps) => {
  const isWindowOverSM = useBreakpoint("sm");

  const Comp = isWindowOverSM ? DialogWrapper : DrawerWrapper;
  return <Comp {...props} />;
};

// The container is the sole DOM ancestor between the shell's sized slot and
// arbitrary call-site `children` (e.g. `TransitionLayoutContent`, which is
// only absolutely-positioned motion children) — without an explicit height
// class here, those children's percentage heights resolve to `auto` against
// this otherwise-unstyled div and collapse to zero.
const createContainer = () => {
  if (typeof document === "undefined") return null;
  const container = document.createElement("div");
  container.className = "h-full min-h-0 w-full";
  return container;
};

/**
 * Registrar: portals `children`/`backBtn` into containers owned by this
 * instance and describes its chrome to the single `DialogShellHost`.
 */
export const DialogDrawer = ({
  className,
  children,
  title,
  isOpen,
  backBtn,
  preventDialogOutsideInteraction,
  onClose,
  shellType = "normal",
  shellRole = "stacked",
  baseKey,
}: DialogDrawerProps) => {
  const shell = useContext(DialogShellContext);
  if (!shell) {
    throw new Error(
      "DialogDrawer must be rendered within a DialogShellProvider. Mount <DialogShellProvider> above the tree.",
    );
  }

  const id = useId();
  const [container] = useState(createContainer);
  const [backContainerEl] = useState(createContainer);
  const registeredRef = useRef(false);
  const invalidatedRef = useRef(false);

  const latestRef = useRef({
    className,
    title,
    backBtn,
    preventDialogOutsideInteraction,
    onClose,
    shellType,
    shellRole,
    baseKey,
  });
  latestRef.current = {
    className,
    title,
    backBtn,
    preventDialogOutsideInteraction,
    onClose,
    shellType,
    shellRole,
    baseKey,
  };

  const stableOnClose = useCallback(() => {
    latestRef.current.onClose();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      invalidatedRef.current = false;
      return;
    }
    if (invalidatedRef.current || !container || !backContainerEl) return;

    shell.register({
      id,
      role: latestRef.current.shellRole,
      shellType: latestRef.current.shellType,
      title: latestRef.current.title,
      className: latestRef.current.className,
      baseKey: latestRef.current.baseKey,
      preventDialogOutsideInteraction: Boolean(
        latestRef.current.preventDialogOutsideInteraction,
      ),
      container,
      backContainer: latestRef.current.backBtn ? backContainerEl : null,
      onClose: stableOnClose,
      onInvalidate: () => {
        registeredRef.current = false;
        invalidatedRef.current = true;
      },
    });
    registeredRef.current = true;

    return () => {
      if (registeredRef.current) {
        shell.unregister(id);
        registeredRef.current = false;
      }
    };
    // Registration intentionally reacts to `isOpen` only — other chrome
    // fields are pushed through the `update()` effect below so prop-identity
    // churn (e.g. an inline `onClose`) can never re-fire register/unregister.
  }, [isOpen, id, shell, container, backContainerEl, stableOnClose]);

  useEffect(() => {
    if (!registeredRef.current) return;
    shell.update(id, {
      shellType,
      title,
      className,
      baseKey,
      preventDialogOutsideInteraction: Boolean(preventDialogOutsideInteraction),
      backContainer: backBtn ? backContainerEl : null,
    });
  }, [
    shell,
    id,
    shellType,
    title,
    className,
    baseKey,
    preventDialogOutsideInteraction,
    backBtn,
    backContainerEl,
  ]);

  const isExiting = useSyncExternalStore(
    shell.subscribe,
    () => shell.isExiting(id),
    () => false,
  );

  if (!container || !backContainerEl) return null;
  // `isExiting` reflects the store as of the LAST commit: on the very render
  // where `isOpen` first flips false, the registration effect's cleanup
  // (which calls `unregister` and flips the store to "exiting") hasn't run
  // yet, so `isExiting` is still stale-false here. Falling through to
  // `registeredRef.current` for that one render keeps the portal mounted
  // instead of unmounting-then-remounting the call site's subtree (which
  // would reset the very state this stack is meant to preserve during exit).
  if (!isOpen && !isExiting && !registeredRef.current) return null;

  return (
    <>
      {createPortal(children, container)}
      {backBtn ? createPortal(backBtn, backContainerEl) : null}
    </>
  );
};
