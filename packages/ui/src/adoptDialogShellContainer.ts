/**
 * Appends a registrar-owned container into a shell-owned parent slot,
 * preserving focus if the currently focused element lives inside the
 * container (breakpoint swaps and stack reordering re-run this per entry).
 */
export const adoptDialogShellContainer = (
  parent: HTMLElement,
  container: HTMLElement,
) => {
  const activeElement = document.activeElement;
  const shouldRestoreFocus =
    activeElement instanceof HTMLElement && container.contains(activeElement);

  parent.appendChild(container);

  if (shouldRestoreFocus) {
    (activeElement as HTMLElement).focus({ preventScroll: true });
  }

  return () => {
    if (container.parentElement === parent) {
      parent.removeChild(container);
    }
  };
};
