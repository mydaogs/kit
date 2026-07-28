export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}

/**
 * Capped exponential backoff for ordinary retryable failures.
 *
 * Returns `null` once attempts are exhausted, which the caller writes as a
 * dead letter (`nextRetryAt: null`) so the claim query stops selecting it.
 */
export function computeRetryAt(
  attemptCount: number,
  options: BackoffOptions = {},
): Date | null {
  const {
    baseDelayMs = 30_000,
    maxDelayMs = 600_000,
    maxAttempts = 8,
  } = options;

  if (attemptCount >= maxAttempts) return null;
  const delay = Math.min(baseDelayMs * 2 ** attemptCount, maxDelayMs);
  return new Date(Date.now() + delay);
}

/**
 * Backoff for a status gap. Never returns `null`: a gap is resolvable once the
 * missing intermediate event lands, so it must stay in the retry lane rather
 * than dead-lettering on an attempt cap.
 */
export function computeStatusGapRetryAt(
  attemptCount: number,
  options: Omit<BackoffOptions, "maxAttempts"> = {},
): Date {
  const { baseDelayMs = 30_000, maxDelayMs = 600_000 } = options;
  const delay = Math.min(baseDelayMs * 2 ** attemptCount, maxDelayMs);
  return new Date(Date.now() + delay);
}
