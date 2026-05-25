"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import {
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

// File-tree (design system magicui) adapté au projet : package unifié
// `radix-ui` (Accordion), helper `cn`, tokens NC. Pilotable par `children`
// (<Folder>/<File>) ou par données via la prop `elements`.

export type TreeViewElement = {
  id: string;
  name: string;
  type?: "file" | "folder";
  isSelectable?: boolean;
  children?: TreeViewElement[];
};

type TreeContextValue = {
  selectedId: string | undefined;
  expandedItems: string[];
  selectItem: (id: string) => void;
};

const TreeContext = React.createContext<TreeContextValue | null>(null);

function useTree() {
  const ctx = React.useContext(TreeContext);
  if (!ctx) throw new Error("Les composants Tree doivent être utilisés dans <Tree>");
  return ctx;
}

type TreeProps = React.ComponentPropsWithoutRef<"div"> & {
  initialSelectedId?: string;
  initialExpandedItems?: string[];
  elements?: TreeViewElement[];
};

export function Tree({
  className,
  children,
  initialSelectedId,
  initialExpandedItems,
  elements,
  ...props
}: TreeProps) {
  const [selectedId, setSelectedId] = React.useState(initialSelectedId);
  const [expandedItems, setExpandedItems] = React.useState<string[]>(
    initialExpandedItems ?? [],
  );

  const selectItem = React.useCallback((id: string) => setSelectedId(id), []);

  return (
    <TreeContext.Provider value={{ selectedId, expandedItems, selectItem }}>
      <div className={cn("overflow-auto", className)} {...props}>
        <AccordionPrimitive.Root
          type="multiple"
          value={expandedItems}
          onValueChange={setExpandedItems}
          className="flex flex-col gap-0.5"
        >
          {children ?? (elements ? renderElements(elements) : null)}
        </AccordionPrimitive.Root>
      </div>
    </TreeContext.Provider>
  );
}

function renderElements(elements: TreeViewElement[]): React.ReactNode {
  return elements.map((el) => {
    const isFolder = el.type === "folder" || (el.children?.length ?? 0) > 0;
    return isFolder ? (
      <Folder key={el.id} value={el.id} element={el.name} isSelectable={el.isSelectable}>
        {el.children ? renderElements(el.children) : null}
      </Folder>
    ) : (
      <File key={el.id} value={el.id} isSelectable={el.isSelectable}>
        {el.name}
      </File>
    );
  });
}

type FolderProps = {
  element: string;
  value: string;
  isSelectable?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function Folder({
  element,
  value,
  isSelectable = true,
  className,
  children,
}: FolderProps) {
  const { expandedItems } = useTree();
  const expanded = expandedItems.includes(value);

  return (
    <AccordionPrimitive.Item value={value} className="relative">
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          disabled={!isSelectable}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-raised)]",
            !isSelectable && "cursor-default opacity-50 hover:bg-transparent",
            className,
          )}
        >
          {expanded ? (
            <FolderOpenIcon size={15} className="shrink-0 text-[var(--color-brand)]" />
          ) : (
            <FolderIcon size={15} className="shrink-0 text-[var(--color-text-muted)]" />
          )}
          <span className="truncate font-medium text-[var(--color-text-primary)]">
            {element}
          </span>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden">
        <div className="ml-[15px] flex flex-col gap-0.5 border-l border-[var(--color-border-default)] pt-0.5 pl-2">
          {children}
        </div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

type FileProps = React.ComponentPropsWithoutRef<"button"> & {
  value: string;
  isSelectable?: boolean;
  isSelect?: boolean;
  fileIcon?: React.ReactNode;
};

export function File({
  value,
  isSelectable = true,
  isSelect,
  fileIcon,
  className,
  children,
  onClick,
  ...props
}: FileProps) {
  const { selectedId, selectItem } = useTree();
  const selected = isSelect ?? selectedId === value;

  return (
    <button
      type="button"
      disabled={!isSelectable}
      aria-current={selected ? "true" : undefined}
      onClick={(e) => {
        selectItem(value);
        onClick?.(e);
      }}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors",
        selected
          ? "bg-[rgba(224,98,90,0.10)] font-medium text-[var(--color-brand)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]",
        !isSelectable && "cursor-default opacity-50 hover:bg-transparent",
        className,
      )}
      {...props}
    >
      <span className="shrink-0 [&>svg]:size-[15px]">
        {fileIcon ?? <FileIcon size={15} className="opacity-70" />}
      </span>
      <span className="truncate">{children}</span>
    </button>
  );
}
