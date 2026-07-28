/**
 * Redaction returns a narrowed union, never nulled fields.
 *
 * The `hidden` branch carries no identifying metadata — not even the id — so a
 * restricted viewer cannot receive it and TypeScript forces every consumer to
 * check `visibility` before reading anything. A `name: string | null` shape
 * gives neither guarantee.
 *
 * Keep the cached data layer viewer-agnostic and apply redaction in the route
 * handler after the fetch, so one cache entry serves every viewer class.
 */
export type Redactable<TVisible extends object> =
  | { visibility: "hidden" }
  | ({ visibility: "public" } & TVisible);

export const HIDDEN = { visibility: "hidden" } as const;

export const redact = <TVisible extends object>(
  visible: TVisible,
  isVisible: boolean,
): Redactable<TVisible> =>
  isVisible ? { visibility: "public", ...visible } : HIDDEN;

export const isVisible = <TVisible extends object>(
  value: Redactable<TVisible>,
): value is { visibility: "public" } & TVisible =>
  value.visibility === "public";
