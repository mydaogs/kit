export interface TruncateStringProps {
  value: string;
  /** Characters kept at the start, counted from index 0 (a `0x` prefix is included). */
  leading?: number;
  /** Characters kept at the end. */
  trailing?: number;
  separator?: string;
}

/**
 * Shortens long opaque identifiers (tx hashes, addresses, database ids) for
 * display. Returns the input unchanged when it is already short enough, so
 * callers never need a length check of their own.
 */
export const truncateString = ({
  value,
  leading = 6,
  trailing = 4,
  separator = "…",
}: TruncateStringProps): string => {
  if (typeof value !== "string") return "";
  if (value.length <= leading + trailing + separator.length) return value;
  return `${value.slice(0, leading)}${separator}${value.slice(-trailing)}`;
};
