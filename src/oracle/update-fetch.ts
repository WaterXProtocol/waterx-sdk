/**
 * `fetchWithPolicy` — resilience wrapper around `fetch` for the oracle money
 * path's off-chain update-data fetches. Every order/position/collateral
 * tx-build depends on one of these REST calls landing (Hermes VAA for
 * `pyth_rule`, Lazer signed updates for `pyth_lazer_rule`); a bare `fetch`
 * with a single attempt and no retry means one Hermes 429/5xx or timeout
 * fails every trade. `fetchPriceFeedsUpdateData` (`./pyth.ts`) and
 * `PythLazerRule.fetchUpdateData`'s Lazer POST (`./rules/pyth-lazer-rule.ts`)
 * both delegate here instead of calling `fetch` directly — this is the ONE
 * place a retry/timeout/auth policy is implemented for oracle fetches.
 *
 * Policy semantics:
 * - Bearer auth is attached iff `policy.apiKey` is a non-empty string —
 *   absent/empty is byte-identical to today's keyless request (no
 *   `Authorization` header at all). This is the Phase-0 invariant of the
 *   Pyth Pro migration: existing keyless deployments see no behavior change.
 * - Retries on network errors, HTTP 429, and HTTP 5xx, with exponential
 *   backoff (`retryDelayMs * 2^attempt`, capped at `MAX_BACKOFF_MS`). Other
 *   4xx statuses (401/400/403/404/…) are NOT retried — auth/bad-request
 *   failures are deterministic, so that `Response` (`ok: false`) is handed
 *   back on the first attempt for the caller to format its own
 *   domain-specific error, exactly as it did before this wrapper existed.
 * - Each attempt gets its own `AbortSignal.timeout(policy.timeoutMs)`. An
 *   optional caller-supplied `externalSignal` cancels the WHOLE policy — an
 *   in-flight attempt AND a queued backoff sleep — via `AbortSignal.any`.
 * - Exhausting retries with no successful/non-retryable response (i.e. every
 *   attempt was a network error, or the final attempt was still a retryable
 *   HTTP failure) throws a {@link FetchPolicyError} naming the target's
 *   `host + pathname` (never the query string — feed ids are off-chain
 *   noise, not diagnostic value), the attempt count, and whichever of
 *   `status` (a retryable HTTP failure) or `cause` (a network error) the
 *   final attempt produced.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_BACKOFF_MS = 2_000;

export interface FetchPolicy {
  /** Per-attempt timeout (ms). Default 15_000. */
  readonly timeoutMs?: number;
  /** Retry attempts AFTER the first try — `retries: 2` ⇒ 3 attempts total. Default 2. */
  readonly retries?: number;
  /** Base backoff (ms); doubled per attempt, capped at 2_000ms. Default 250. */
  readonly retryDelayMs?: number;
  /** Bearer token. Attached iff non-empty; empty/missing ⇒ no `Authorization` header. */
  readonly apiKey?: string;
  /** Override the fetch implementation (tests / non-global-`fetch` environments). Default: global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

/** Thrown by {@link fetchWithPolicy} when every attempt failed. */
export class FetchPolicyError extends Error {
  /** HTTP status of the final attempt, when it got a (retryable-but-failing) response. */
  readonly status?: number;
  /** Total attempts made (first try + retries actually used). */
  readonly attempts: number;

  constructor(message: string, opts: { status?: number; cause?: unknown; attempts: number }) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "FetchPolicyError";
    this.status = opts.status;
    this.attempts = opts.attempts;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffMs(retryDelayMs: number, attempt: number): number {
  return Math.min(retryDelayMs * 2 ** attempt, MAX_BACKOFF_MS);
}

/** `host + pathname` only — never the query string (feed ids are noise, not diagnostic). */
function describeTarget(url: string): string {
  const parsed = new URL(url);
  return `${parsed.host}${parsed.pathname}`;
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Resolves after `ms`, or rejects immediately (with `signal.reason`) if `signal` fires first. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
  const abortSignal = signal;
  if (abortSignal.aborted) return Promise.reject(abortSignal.reason as unknown);
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortSignal.reason as unknown);
    };
    const timer = setTimeout(() => {
      abortSignal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    abortSignal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Merge `Authorization: Bearer <apiKey>` into `base` iff `apiKey` is
 * non-empty; `base` is returned UNTOUCHED otherwise (byte-identical to
 * today's keyless requests — no header, whatever shape the caller passed).
 * Always builds a plain object (never a `Headers` instance) so callers that
 * assert on the exact `init` they handed `fetch` keep working unchanged.
 */
function withBearerAuth(
  base: RequestInit["headers"],
  apiKey: string | undefined,
): RequestInit["headers"] {
  if (!apiKey) return base;
  const merged: Record<string, string> = {};
  if (base instanceof Headers) {
    base.forEach((value, key) => {
      merged[key] = value;
    });
  } else if (Array.isArray(base)) {
    for (const [key, value] of base) merged[key] = value;
  } else if (base) {
    Object.assign(merged, base);
  }
  merged.Authorization = `Bearer ${apiKey}`;
  return merged;
}

/**
 * `fetch` with per-attempt timeout, bounded retry + backoff, and optional
 * Bearer auth. See the module header for the full policy. `externalSignal`
 * (optional) cancels in-flight attempts AND queued backoff sleeps — pass a
 * caller's own `AbortController.signal` to make the whole call cancellable.
 */
export async function fetchWithPolicy(
  url: string,
  init: RequestInit = {},
  policy: FetchPolicy = {},
  externalSignal?: AbortSignal,
): Promise<Response> {
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = policy.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = policy.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const doFetch = policy.fetchImpl ?? fetch;
  const headers = withBearerAuth(init.headers, policy.apiKey);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = externalSignal
      ? AbortSignal.any([timeoutSignal, externalSignal])
      : timeoutSignal;

    let status: number | undefined;
    let cause: unknown;
    try {
      const response = await doFetch(url, { ...init, headers, signal });
      if (response.ok || !isRetryableStatus(response.status)) return response;
      status = response.status;
    } catch (err) {
      if (externalSignal?.aborted) throw err;
      cause = err;
    }

    if (attempt === retries) {
      const detail = status !== undefined ? `last status ${status}` : causeMessage(cause);
      throw new FetchPolicyError(
        `fetchWithPolicy: ${describeTarget(url)} failed after ${attempt + 1} attempt(s) — ${detail}`,
        { status, cause, attempts: attempt + 1 },
      );
    }
    await sleep(backoffMs(retryDelayMs, attempt), externalSignal);
  }

  // Unreachable: the loop above always returns or throws on its final
  // (attempt === retries) iteration — this satisfies the compiler only.
  throw new FetchPolicyError(`fetchWithPolicy: ${describeTarget(url)} exhausted retries`, {
    attempts: retries + 1,
  });
}
