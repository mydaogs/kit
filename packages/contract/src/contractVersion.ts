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
): value is BackendHealthResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === "string" &&
    typeof candidate.app === "string" &&
    typeof candidate.contractVersion === "string"
  );
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
  /** Gate so the probe only runs during a production build. */
  shouldVerify?: () => boolean;
}) {
  let verification: Promise<void> | null = null;

  return async function verifyContractOnce(): Promise<void> {
    if (options.shouldVerify && !options.shouldVerify()) return;

    verification ??= (async () => {
      const res = await fetch(options.healthUrl(), { cache: "no-store" });

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!isBackendHealthResponse(body)) {
        throw new Error(
          `Backend health probe failed: ${res.status} ${res.statusText} (invalid or missing body)`,
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

    await verification;
  };
}
