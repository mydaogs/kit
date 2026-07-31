"use client";

import { Button } from "@mydaogs/ui";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { StatusCardLoading } from "./StatusCardLoading";
import type { GetComponentProps } from "./types";
import { cn } from "./cn";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

/**
 * The subset of a zod schema's `.safeParse()` contract Combobox actually
 * uses. Structural rather than `z.ZodSchema` so the package carries no
 * runtime or type-level zod dependency — any zod major version's schema
 * satisfies this shape, and callers never need a matching zod install just
 * to type a `validationSchema` prop.
 */
export interface ComboboxValidationSchema {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { errors: Array<{ message?: string }> };
  };
}

interface ComboboxProps extends GetComponentProps<typeof Button> {
  value: string;
  onValueSelect: (_: string) => void;
  options: string[];
  searchEnabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  // Add new item functionality
  onCreateNew?: (_: string) => Promise<void>;
  createNewLabel?: (_: string) => string;
  validationSchema?: ComboboxValidationSchema;
  isCreating?: boolean;
  minSearchLength?: number;
  allowClear?: boolean;
  /** Labels sourced from next-intl by the consuming app. Default to English. */
  labels?: {
    clear?: string;
  };
}

export const Combobox = (props: ComboboxProps) => {
  const {
    disabled,
    value,
    onValueSelect,
    options,
    searchEnabled = true,
    placeholder = "Select value",
    isLoading = false,
    loadingLabel = "Loading...",
    onCreateNew,
    createNewLabel,
    validationSchema,
    isCreating = false,
    minSearchLength = 3,
    allowClear = true,
    labels,
    className,
    ...rest
  } = props;

  const clearLabel = labels?.clear ?? "Clear";

  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const searchQuery = searchValue.trim();

  const filteredOptions = useMemo(() => {
    if (searchQuery) {
      const filtered = options.filter((option) =>
        option.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return filtered.slice(0, 200);
    }

    return options.length > 500 ? options.slice(0, 100) : options;
  }, [options, searchQuery]);

  const hasManyOptions = useMemo(() => {
    return options.length > 500;
  }, [options.length]);

  // Validate search value against schema
  const validationError = useMemo(() => {
    if (!validationSchema || !searchQuery) {
      return null;
    }

    const result = validationSchema.safeParse(searchQuery);
    if (result.success) {
      return null;
    }
    return result.error?.errors[0]?.message || "Invalid input";
  }, [searchQuery, validationSchema]);

  // Check if we should show "add new" option
  const shouldShowAddNew = useMemo(() => {
    if (!onCreateNew || !searchQuery) return false;
    if (searchQuery.length < minSearchLength) return false;

    // Check if search value already exists in options
    const exactMatch = options.some(
      (option) => option.toLowerCase() === searchQuery.toLowerCase(),
    );
    if (exactMatch) return false;

    // If validation schema is provided, only show if validation passed
    if (validationSchema && validationError) return false;

    return true;
  }, [
    onCreateNew,
    searchQuery,
    options,
    validationSchema,
    validationError,
    minSearchLength,
  ]);

  const addNewLabel = useMemo(() => {
    if (!shouldShowAddNew) return "";
    if (createNewLabel) {
      return createNewLabel(searchQuery);
    }
    return `Add "${searchQuery}"`;
  }, [shouldShowAddNew, searchQuery, createNewLabel]);

  // Check if empty string is allowed by the schema
  const schemaAllowsEmpty = useMemo(() => {
    if (!validationSchema) return true;
    return validationSchema.safeParse("").success;
  }, [validationSchema]);

  const showClear = useMemo(() => {
    return (
      allowClear &&
      value.length > 0 &&
      !isLoading &&
      !isCreating &&
      schemaAllowsEmpty
    );
  }, [allowClear, value, isLoading, isCreating, schemaAllowsEmpty]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearchValue("");
    }
  }, []);

  const handleOptionSelect = useCallback(
    (option: string) => {
      onValueSelect(option);
      handleOpenChange(false);
    },
    [onValueSelect, handleOpenChange],
  );

  const handleCreateNew = useCallback(async () => {
    if (!onCreateNew || !shouldShowAddNew) return;

    try {
      await onCreateNew(searchQuery);
      handleOpenChange(false);
    } catch (error) {
      // Error handling is done by parent component
      console.error("Failed to create new item:", error);
    }
  }, [onCreateNew, shouldShowAddNew, searchQuery, handleOpenChange]);

  const handleClear = useCallback(() => {
    onValueSelect("");
    handleOpenChange(false);
  }, [onValueSelect, handleOpenChange]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="flat"
          role="combobox"
          className={cn("group gap-px", className)}
          disabled={disabled || isLoading}
          {...rest}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !value.length && "text-primary/50 text-sm py-1",
              isLoading && "text-primary text-sm py-1",
            )}
          >
            {isLoading ? loadingLabel : value.length ? value : placeholder}
          </span>
          <ChevronDown className="shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-max min-w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-content-available-width)] p-0"
        align="center"
      >
        <Command shouldFilter={false}>
          {searchEnabled ? (
            <CommandInput
              placeholder={
                hasManyOptions
                  ? `Search ${options.length} values...`
                  : "Search values..."
              }
              className="h-9"
              value={searchValue}
              onValueChange={setSearchValue}
            />
          ) : null}
          <CommandList className="max-h-60 overflow-auto">
            {filteredOptions.length === 0 && !shouldShowAddNew && (
              <div className="py-6 text-center text-sm">
                {hasManyOptions && !searchQuery
                  ? `Type to search ${options.length} values`
                  : validationError
                    ? validationError
                    : "No values found."}
              </div>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  value={option}
                  key={option}
                  onSelect={handleOptionSelect}
                  disabled={isCreating}
                >
                  {option}
                  <Check
                    className={cn(
                      "ml-auto",
                      option === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Add New Option */}
            {shouldShowAddNew && (
              <CommandGroup>
                <CommandItem
                  value={`__add_new__${searchQuery}`}
                  onSelect={handleCreateNew}
                  disabled={isCreating}
                  className="border-t"
                >
                  {isCreating ? (
                    <StatusCardLoading variant="compact" className="py-0" />
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      {addNewLabel}
                    </>
                  )}
                </CommandItem>
              </CommandGroup>
            )}

            {hasManyOptions && !searchQuery && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center border-t">
                {`Showing first 100 cities. Type to search all ${options.length} cities.`}
              </div>
            )}
          </CommandList>

          {/* Clear footer */}
          {showClear && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={clearLabel}
              className="w-full cursor-pointer rounded-b-md border-t border-border bg-danger px-2 py-1.5 text-center font-mono text-sm text-main-foreground hover:brightness-90 active:brightness-95"
            >
              {clearLabel}
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
