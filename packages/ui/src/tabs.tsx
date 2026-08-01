"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";

import * as React from "react";

import { cn } from "./cn";

import { useIndicatorPosition } from "./hooks/useIndicatorPosition";
import { TabIndicator } from "./tab-indicator";

type TabsHoverContextValue = {
  hoveredValue: string | null;
  setHoveredValue: (value: string | null) => void;
  activeValue: string | null;
  registerTrigger: (value: string, node: HTMLButtonElement | null) => void;
  triggerRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
};

const TabsHoverContext = React.createContext<TabsHoverContextValue | null>(
  null,
);

function Tabs({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [hoveredValue, setHoveredValue] = React.useState<string | null>(null);
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    string | undefined
  >(props.defaultValue);
  const triggerRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const activeValue =
    props.value ?? uncontrolledValue ?? props.defaultValue ?? null;
  const registerTrigger = React.useCallback(
    (value: string, node: HTMLButtonElement | null) => {
      if (!node) {
        triggerRefs.current.delete(value);
        return;
      }

      triggerRefs.current.set(value, node);
    },
    [],
  );
  const contextValue = React.useMemo(
    () => ({
      hoveredValue,
      setHoveredValue,
      activeValue,
      registerTrigger,
      triggerRefs,
    }),
    [activeValue, hoveredValue, registerTrigger],
  );

  return (
    <TabsHoverContext.Provider value={contextValue}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn("flex w-full max-w-lg flex-col gap-4", className)}
        {...props}
        onValueChange={(value) => {
          setUncontrolledValue(value);
          props.onValueChange?.(value);
        }}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsHoverContext.Provider>
  );
}

function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const tabsContext = React.useContext(TabsHoverContext);
  const targetValue = tabsContext?.hoveredValue ?? tabsContext?.activeValue;

  const { indicatorStyle, isReady } = useIndicatorPosition({
    containerRef: listRef,
    itemRefs: tabsContext?.triggerRefs ?? { current: new Map() },
    activeValue: targetValue ?? null,
  });

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      ref={listRef}
      className={cn(
        "relative inline-flex flex-wrap w-full max-w-lg items-center justify-center rounded-xl border-(length:--border-width-base) border-border bg-secondary/50 text-foreground overflow-clip p-1",
        className,
      )}
      {...props}
    >
      <TabIndicator indicatorStyle={indicatorStyle} isReady={isReady} />
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const tabsContext = React.useContext(TabsHoverContext);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const hoveredValue = tabsContext?.hoveredValue ?? null;
  const isHovered = hoveredValue !== null && hoveredValue === props.value;
  const isSuppressed = hoveredValue !== null && hoveredValue !== props.value;

  React.useLayoutEffect(() => {
    if (props.value && triggerRef.current && tabsContext?.registerTrigger) {
      tabsContext.registerTrigger(props.value, triggerRef.current);
    }

    return () => {
      if (props.value && tabsContext?.registerTrigger) {
        tabsContext.registerTrigger(props.value, null);
      }
    };
  }, [props.value, tabsContext]);

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      ref={triggerRef}
      className={cn(
        "relative z-10 inline-flex grow items-center justify-center whitespace-nowrap rounded-xl px-2 py-1 gap-0 text-sm font-base box-border disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        isHovered && "text-main-foreground",
        isSuppressed && "text-foreground",
        !isSuppressed &&
          !isHovered &&
          "data-[state=active]:text-main-foreground",
        className,
      )}
      onMouseEnter={(event) => {
        props.onMouseEnter?.(event);
        if (props.value) {
          tabsContext?.setHoveredValue(props.value);
        }
      }}
      onMouseLeave={(event) => {
        props.onMouseLeave?.(event);
        tabsContext?.setHoveredValue(null);
      }}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
