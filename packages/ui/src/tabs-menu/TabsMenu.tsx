"use client";

import * as React from "react";
import { ChevronRight, Settings2, X } from "lucide-react";

import { cn } from "../cn";

import { useBreakpoint } from "../hooks/useBreakpoint";
import { useIndicatorPosition } from "../hooks/useIndicatorPosition";
import { TabIndicator } from "../tab-indicator";
import type { TabsMenuItemConfig, TabsMenuProps } from "./types";
import { isTabsTreeGroup } from "./types";
import { pathKey } from "./utils";

const CloseButton = ({
  onClick,
  className,
  label,
}: {
  onClick: () => void;
  className?: string;
  label: string;
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={cn(
      "p-1 rounded-xl text-muted-foreground transition-all duration-200 ease-out hover:bg-secondary/80 hover:text-foreground hover:scale-110 active:scale-95",
      className,
    )}
  >
    <X className="h-4 w-4 transition-transform duration-200" />
  </button>
);

export function TabsMenu<K extends string>({
  className,
  tree,
  labels,
  value,
  defaultValue,
  onValueChange,
  ...props
}: TabsMenuProps<K>) {
  const isMobile = !useBreakpoint("md");
  const [draftPath, setDraftPath] = React.useState<string[] | null>(null);
  const [showChildren, setShowChildren] = React.useState(false);
  const [hoveredValue, setHoveredValue] = React.useState<string | null>(null);
  const [uncontrolledPath, setUncontrolledPath] = React.useState<string[]>(
    defaultValue ?? [],
  );
  const panelTriggersRef = React.useRef(new Map<string, HTMLButtonElement>());
  const navRef = React.useRef<HTMLElement>(null);

  const configs = React.useMemo(() => {
    const map = new Map<string, TabsMenuItemConfig>();
    let order = 0;

    const registerNode = (
      node: (typeof tree)[number],
      parentPath: string[],
    ) => {
      const isGroup = isTabsTreeGroup(node);
      const value = isGroup ? `group:${node.key}` : node.key;
      const path = parentPath.concat(value);
      const pathId = pathKey(path);

      map.set(pathId, {
        value,
        label: labels[node.key],
        content: isGroup ? undefined : node.content,
        depth: parentPath.length,
        path,
        parentPathKey: pathKey(parentPath),
        hasChildren: isGroup,
        order: order++,
      });

      if (isGroup) {
        node.children.forEach((child) => {
          registerNode(child, path);
        });
      }
    };

    tree.forEach((node) => registerNode(node, []));

    return map;
  }, [tree, labels]);

  // Build index for fast children/siblings lookup
  const configsByParentKey = React.useMemo(() => {
    const index = new Map<string, TabsMenuItemConfig[]>();
    configs.forEach((config) => {
      const parentKey = config.parentPathKey;
      if (!index.has(parentKey)) {
        index.set(parentKey, []);
      }
      index.get(parentKey)!.push(config);
    });
    // Sort each group by order
    index.forEach((items) => {
      items.sort((a, b) => a.order - b.order);
    });
    return index;
  }, [configs]);

  const confirmedPath = value ?? uncontrolledPath;

  // Get active path - auto-select first leaf if needed
  const resolvedConfirmedPath = React.useMemo(() => {
    if (configs.size === 0) return [];

    // Check if current path exists
    const config = configs.get(pathKey(confirmedPath));
    if (config) {
      if (!config.hasChildren) return confirmedPath;
      // If it's a group, prefer leaf nodes over parent nodes
      const children = configsByParentKey.get(pathKey(confirmedPath));
      if (children) {
        const firstLeaf = children.find((c) => !c.hasChildren);
        if (firstLeaf) return firstLeaf.path;
      }
    }

    // Auto-select first leaf (works for both root leaves and group-only trees)
    for (const config of configs.values()) {
      if (!config.hasChildren) return config.path;
    }
    return [];
  }, [configs, confirmedPath, configsByParentKey]);

  React.useEffect(() => {
    setDraftPath(null);
    setShowChildren(false);
    setHoveredValue(null);
  }, [value]);

  const displayPath = draftPath ?? resolvedConfirmedPath;
  const isEditing = draftPath !== null;

  // Dismiss panel on click outside
  React.useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setDraftPath(null);
        setShowChildren(false);
        setHoveredValue(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing]);

  // Memoize last item config to avoid repeated lookups
  const lastItemConfig = React.useMemo(
    () =>
      displayPath.length > 0
        ? (configs.get(pathKey(displayPath)) ?? null)
        : null,
    [configs, displayPath],
  );

  // Get options for the panel: children if drilling down, siblings if editing
  const currentOptions = React.useMemo(() => {
    if (!isEditing || !lastItemConfig) return [];

    let options: TabsMenuItemConfig[];

    if (showChildren && lastItemConfig.hasChildren) {
      // Show children of the last item (drilling down)
      options = configsByParentKey.get(pathKey(lastItemConfig.path)) ?? [];
    } else {
      // Show siblings of the last item (selecting among peers)
      options = configsByParentKey.get(lastItemConfig.parentPathKey) ?? [];
    }

    // Reorder so the currently selected item appears first
    const currentValue = displayPath[displayPath.length - 1];
    const currentIndex = options.findIndex((opt) => opt.value === currentValue);

    if (currentIndex > 0) {
      const currentItem = options[currentIndex];
      if (!currentItem) return options;
      // Move current item to the front
      return [
        currentItem,
        ...options.slice(0, currentIndex),
        ...options.slice(currentIndex + 1),
      ];
    }

    return options;
  }, [
    configsByParentKey,
    lastItemConfig,
    isEditing,
    showChildren,
    displayPath,
  ]);

  const showPanel = isEditing && currentOptions.length > 0;

  // Get content for the active leaf
  const leafContent = React.useMemo(() => {
    if (isEditing) return null;
    const config = configs.get(pathKey(resolvedConfirmedPath));
    return config?.content ?? null;
  }, [configs, isEditing, resolvedConfirmedPath]);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const panelActiveValue = React.useMemo(() => {
    if (hoveredValue) return hoveredValue;

    // If showing children, don't highlight any tab (no current selection among children yet)
    if (showChildren) return null;

    // Otherwise, highlight the current selection among siblings
    return isEditing ? (displayPath[displayPath.length - 1] ?? null) : null;
  }, [hoveredValue, showChildren, isEditing, displayPath]);

  const { indicatorStyle, isReady } = useIndicatorPosition({
    containerRef: panelRef,
    itemRefs: panelTriggersRef,
    activeValue: panelActiveValue,
  });

  const focusPanelOption = React.useCallback(
    (index: number) => {
      if (currentOptions.length === 0) return;
      const nextIndex = (index + currentOptions.length) % currentOptions.length;
      const nextValue = currentOptions[nextIndex]?.value;
      if (!nextValue) return;
      panelTriggersRef.current.get(nextValue)?.focus();
    },
    [currentOptions],
  );

  const chosenRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    chosenRefs.current = chosenRefs.current.slice(0, displayPath.length);
  }, [displayPath.length]);

  const focusChosen = React.useCallback(
    (index: number) => {
      if (displayPath.length === 0) return;
      const nextIndex = (index + displayPath.length) % displayPath.length;
      chosenRefs.current[nextIndex]?.focus();
    },
    [displayPath.length],
  );

  const commitPath = React.useCallback(
    (nextPath: string[]) => {
      if (value === undefined) {
        setUncontrolledPath(nextPath);
      }
      onValueChange?.(nextPath);
      setDraftPath(null);
      setShowChildren(false);
      setHoveredValue(null);
    },
    [onValueChange, value],
  );

  const startEditAtDepth = React.useCallback(
    (depthIndex: number) => {
      const targetPath = displayPath.slice(0, depthIndex + 1);
      const config = configs.get(pathKey(targetPath));
      if (!config) return;

      // Set draft path to the clicked item - we'll show its siblings in the panel
      setDraftPath(targetPath);
      setShowChildren(false);
      setHoveredValue(null);
    },
    [configs, displayPath],
  );

  const handlePanelSelect = React.useCallback(
    (option: TabsMenuItemConfig) => {
      if (option.hasChildren) {
        // Drill into this option to show its children
        setDraftPath(option.path);
        setShowChildren(true);
        setHoveredValue(null);
      } else {
        // Leaf node - commit the path
        commitPath(option.path);
      }
    },
    [commitPath],
  );

  if (configs.size === 0) return null;

  // When editing: if drilling into children, show all chips; if selecting siblings, hide last chip
  const chipsPath =
    isEditing && !showChildren ? displayPath.slice(0, -1) : displayPath;

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      <nav
        ref={navRef}
        className="flex w-full flex-col md:flex-row gap-1 items-center"
      >
        {chipsPath.length > 0 && (
          <div className="inline-flex max-w-full flex-wrap justify-center items-center gap-1 rounded-xl border-(length:--border-width-base) border-transparent p-0 transition-all duration-200">
            {chipsPath.map((_valueAtDepth: string, index: number) => {
              const path = displayPath.slice(0, index + 1);
              const config = configs.get(pathKey(path));
              if (!config) return null;

              return (
                <React.Fragment key={pathKey(path)}>
                  {index > 0 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <button
                    type="button"
                    ref={(node) => {
                      chosenRefs.current[index] = node;
                    }}
                    className="group inline-flex items-center gap-1 rounded-lg bg-main px-2 py-1 text-sm font-base text-nowrap text-main-foreground transition-all duration-200 ease-out hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-main/50 focus-visible:ring-offset-2"
                    onClick={() => startEditAtDepth(index)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowRight" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        focusChosen(index + 1);
                      }
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowUp"
                      ) {
                        event.preventDefault();
                        focusChosen(index - 1);
                      }
                    }}
                  >
                    <Settings2 className="h-4 w-4 transition-transform duration-200 group-hover:rotate-45" />
                    {config.label}
                  </button>
                </React.Fragment>
              );
            })}
            {showPanel && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}

        {showPanel ? (
          <div className="flex items-center gap-1 animate-in fade-in-0 slide-in-from-left-2 duration-200">
            <div
              ref={panelRef}
              role="tablist"
              aria-orientation="horizontal"
              className="relative inline-flex flex-wrap w-full max-w-lg items-center justify-center rounded-xl border-(length:--border-width-base) border-border bg-secondary/50 text-foreground overflow-clip p-1 transition-shadow duration-200 hover:shadow-sm"
              onMouseLeave={() => setHoveredValue(null)}
            >
              <TabIndicator
                indicatorStyle={indicatorStyle}
                isReady={isReady && panelActiveValue !== null}
              />
              {currentOptions.map((option, index) => {
                const isActive = panelActiveValue === option.value;
                return (
                  <button
                    key={pathKey(option.path)}
                    type="button"
                    ref={(node) => {
                      if (!node) {
                        panelTriggersRef.current.delete(option.value);
                        return;
                      }
                      panelTriggersRef.current.set(option.value, node);
                    }}
                    role="tab"
                    aria-selected={isActive}
                    className={cn(
                      "relative z-10 inline-flex grow items-center justify-center whitespace-nowrap rounded-xl px-2 py-1 gap-1 text-sm font-base box-border transition-colors duration-200 ease-out",
                      isActive && "text-main-foreground",
                      !isActive && "text-foreground hover:text-foreground/80",
                    )}
                    onMouseEnter={() => {
                      if (!isMobile) {
                        setHoveredValue(option.value);
                      }
                    }}
                    onClick={() => handlePanelSelect(option)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowRight" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        focusPanelOption(index + 1);
                      }
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowUp"
                      ) {
                        event.preventDefault();
                        focusPanelOption(index - 1);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setDraftPath(null);
                        setShowChildren(false);
                        setHoveredValue(null);
                      }
                    }}
                  >
                    {isActive && (
                      <Settings2 className="h-4 w-4 animate-in spin-in-90 zoom-in-50 duration-200" />
                    )}
                    {option.label}
                  </button>
                );
              })}
            </div>
            <CloseButton
              label="Cancel selection"
              onClick={() => {
                setDraftPath(null);
                setShowChildren(false);
                setHoveredValue(null);
              }}
            />
          </div>
        ) : null}
      </nav>

      {leafContent}
    </div>
  );
}
