import type { ComponentProps, ReactNode } from "react";

/** Tree node types for declarative menu structure */
export type TabsTreeLeaf<K extends string = string> = {
  key: K;
  content?: ReactNode;
};

export type TabsTreeGroup<K extends string = string> = {
  key: K;
  children: TabsTreeNode<K>[];
};

export type TabsTreeNode<K extends string = string> =
  | TabsTreeLeaf<K>
  | TabsTreeGroup<K>;

export const isTabsTreeGroup = <K extends string>(
  node: TabsTreeNode<K>,
): node is TabsTreeGroup<K> => "children" in node;

export type TabsMenuProps<K extends string = string> = Omit<
  ComponentProps<"div">,
  "children"
> & {
  tree: TabsTreeNode<K>[];
  labels: Record<K, ReactNode>;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export type TabsMenuItemConfig = {
  value: string;
  label: ReactNode;
  content?: ReactNode;
  depth: number;
  path: string[];
  parentPathKey: string;
  hasChildren: boolean;
  order: number;
};
