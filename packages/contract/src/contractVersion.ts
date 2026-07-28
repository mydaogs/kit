export interface BackendHealthResponse {
  status: "ok" | "degraded";
  app: string;
  contractVersion: string;
  reason?: string;
}

export class BackendContractMismatchError extends Error {
  constructor(expected: string, received: string) {
    super(
      `Backend contract mismatch: consumer expects ${expected}, backend reports ${received}`,
    );
    this.name = "BackendContractMismatchError";
  }
}

export function isBackendHealthResponse(
  value: unknown,
  expectedApp?: string,
): value is BackendHealthResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.status !== "string" ||
    typeof candidate.app !== "string" ||
    typeof candidate.contractVersion !== "string"
  ) {
    return false;
  }
  // Without this, the probe accepts any service that happens to expose a
  // `contractVersion` — a misrouted origin passes the gate silently.
  if (expectedApp !== undefined && candidate.app !== expectedApp) return false;
  return true;
}

/**
 * Build-time deploy gate.
 *
 * Probes the live backend's health endpoint once and throws if its
 * `contractVersion` differs from the version compiled into this consumer. A
 * split deploy then fails the build instead of failing at runtime, in
 * production, on whichever route happens to hit the changed shape first.
 *
 * A `503` with a valid body and a matching version is tolerated: a degraded
 * database is an operational condition, not a contract break.
 */
export function createContractVerifier(options: {
  expectedVersion: string;
  healthUrl: () => string;
  /**
   * Asserted against the probe's `app` field. Set it — a version string alone
   * does not prove you reached the service you meant to reach.
   */
  expectedApp?: string;
  /**
   * Gate deciding when the probe runs. **Required** — it must not default to
   * "always".
   *
   * This is a build-time deploy gate, so the correct value is a build-phase
   * check. Left to run at request time it turns a network probe into a
   * dependency of every request: see the memoization note below.
   */
  shouldVerify: () => boolean;
}) {
  let verification: Promise<void> | null = null;

  return async function verifyContractOnce(): Promise<void> {
    if (!options.shouldVerify()) return;

    // Memoize the SUCCESS only. Caching a rejected promise would make one
    // transient health-endpoint blip permanent for the life of the process —
    // every later request rejecting on a stale failure it cannot retry.
    verification ??= (async () => {
      const res = await fetch(options.healthUrl(), { cache: "no-store" });

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!isBackendHealthResponse(body, options.expectedApp)) {
        throw new Error(
          `Backend health probe failed: ${res.status} ${res.statusText} (invalid body, or not the expected app)`,
        );
      }

      if (body.contractVersion !== options.expectedVersion) {
        throw new BackendContractMismatchError(
          options.expectedVersion,
          body.contractVersion,
        );
      }

      const isDegraded503 = res.status === 503 && body.status === "degraded";
      if (!res.ok && !isDegraded503) {
        throw new Error(
          `Backend health probe failed: ${res.status} ${res.statusText}`,
        );
      }
    })();

    try {
      await verification;
    } catch (error) {
      verification = null;
      throw error;
    }
  };
}
