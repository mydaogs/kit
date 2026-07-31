export interface TruncateTextProps {
  value: string;
  maxLen?: number;
  cutFrom?: "middle" | "end";
}

// Single-glyph horizontal ellipsis. Renders as evenly-spaced dots and cannot
// self-overlap the way three separate "." periods do (which looked squished /
// overlapping in some fonts and with letter-spacing).
const ELLIPSIS = "…";

export function truncateText({
  value,
  maxLen = 13,
  cutFrom = "middle",
}: TruncateTextProps) {
  if (value.length <= maxLen) return value;
  if (cutFrom === "middle") {
    const firstPart = Math.floor((maxLen - 1) / 2);
    const lastPart = maxLen - 1 - firstPart;
    return `${value.slice(0, firstPart)}${ELLIPSIS}${value.slice(
      value.length - lastPart,
    )}`;
  }
  return `${value.slice(0, maxLen - 1)}${ELLIPSIS}`;
}
