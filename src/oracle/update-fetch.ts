/**
 * `fetchWithPolicy` — resilience wrapper around `fetch` for the oracle money
 * path's off-chain update-data fetches. Every order/position/collateral
 * tx-build depends on one of these REST calls landing (Hermes VAA for
 * `pyth_rule`, Lazer signed updates for `pyth_lazer_rule`); a bare `fetch`
 * with a single attempt and no retry means one Hermes 429/5xx or timeout
 * fails every trade. `fetchPriceFeedsUpdateData` (`./pyth.ts`),
 * `PythLazerRule.fetchUpdateData`'s Lazer POST (`./rules/pyth-lazer-rule.ts`),
 * and `loadConfig` (`../perp/config.ts`) all delegate here instead of calling
 * `fetch` directly — this is the ONE place a retry/timeout/auth policy is
 * implemented for these fetches.
 *
 * Policy semantics:
 * - Bearer auth is attached iff `policy.apiKey` is a non-empty string —
 *   absent/empty is byte-identical to today's keyless request (no
 *   `Authorization` header at all). This is the Phase-0 invariant of the
 *   Pyth Pro migration: existing keyless deployments see no behavior change.
 * - Retries on network errors, HTTP 429, and HTTP 5xx, with exponential
 *   backoff (`retryDelayMs * 2^attempt`, capped at `MAX_BACKOFF_MS`). A 429
 *   carrying a numeric `Retry-After` header uses the SERVER'S delay instead,
 *   when it fits under the same cap — a longer ask degrades to normal
 *   backoff rather than stalling a money-path build for tens of seconds.
 *   Other
 *   4xx statuses (401/400/403/404/…) are NOT retried — auth/bad-request
 *   failures are deterministic, so that `Response` (`ok: false`) is handed
 *   back on the first attempt for the caller to format its own
 *   domain-specific error, exactly as it did before this wrapper existed.
 * - `init.body`, if set, MUST be replayable across attempts — a retry
 *   re-sends the SAME `init` object to `fetch` on every attempt. A string /
 *   `URLSearchParams` / BCS-serialized `Uint8Array` body (every caller today)
 *   is fine; a one-shot `ReadableStream` body would not survive a second
 *   attempt and must not be passed through this function.
 * - Each attempt gets its own `AbortSignal.timeout(policy.timeoutMs)`
 *   combined with whichever of `init.signal` / the `externalSignal` param are
 *   set — ALL of them can end the whole policy (not just the in-flight
 *   attempt), including a queued backoff sleep, via `AbortSignal.any`
 *   (runtime floor: Node ≥20.3 / any modern browser — matches this repo's
 *   `target: ES2023` + `lib: ["dom", "esnext"]`).
 * - Exhausting retries with no successful/non-retryable response (i.e. every
 *   attempt was a network error, or the final attempt was still a retryable
 *   HTTP failure) throws a {@link FetchPolicyError} naming the target's
 *   `host + pathname` (never the query string — feed ids are off-chain
 *   noise, not diagnostic value), the attempt count, and whichever of
 *   `status` (a retryable HTTP failure — plus a truncated response-body
 *   snippet, when the final attempt's response carried one) or `cause` (a
 *   network error) the final attempt produced. An INTERMEDIATE (non-final)
 *   retryable response's body is discarded via `response.body?.cancel()`
 *   instead of read, so a doomed-to-retry response doesn't pin its
 *   connection's socket open for no reason.
 * - Retry worst case: with the defaults (15s timeout × 3 attempts + ~0.75s of
 *   backoff between them) a FULL outage takes up to ~46s to surface as a
 *   `FetchPolicyError`, vs ~15s pre-3.2.0's single bare-`fetch` attempt.
 *   Tunable per client via `config.pyth.fetch.{timeoutMs,retries}`.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_BACKOFF_MS = 2_000;
/** Final-error diagnostic only — not a protocol limit. */
const MAX_BODY_SNIPPET_LENGTH = 200;

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
  /** Truncated (~200 char) body of the final attempt's response, when one was readable. */
  readonly bodySnippet?: string;
  /** Total attempts made (first try + retries actually used). */
  readonly attempts: number;

  constructor(
    message: string,
    opts: { status?: number; bodySnippet?: string; cause?: unknown; attempts: number },
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "FetchPolicyError";
    this.status = opts.status;
    this.bodySnippet = opts.bodySnippet;
    this.attempts = opts.attempts;
  }
}

/**
 * Join an API `path` onto an `endpoint` PRESERVING the endpoint's own base
 * path. `new URL(path, endpoint)` is the footgun this replaces: a
 * leading-slash path is *absolute* and silently discards the endpoint's path
 * — harmless for a bare-origin endpoint (`https://hermes.pyth.network`) but
 * it dropped the `/hermes` prefix of the Pyth Pro compat endpoint and 404'd
 * every feed (see `fetchPriceFeedsUpdateData`). Every oracle fetch that
 * targets `<endpoint><fixed path>` must build its URL here.
 */
/** One canonical trailing-slash trim — `joinEndpointPath` (URL building) and
 * `pyth.ts`'s `memoKey` (endpoint identity) must never drift apart on it. */
export function trimTrailingSlashes(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

export function joinEndpointPath(endpoint: string, path: string): URL {
  return new URL(`${trimTrailingSlashes(endpoint)}/${path.replace(/^\/+/, "")}`);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffMs(retryDelayMs: number, attempt: number): number {
  return Math.min(retryDelayMs * 2 ** attempt, MAX_BACKOFF_MS);
}

/**
 * The server's own `Retry-After` (numeric-seconds form only), when present
 * and within `MAX_BACKOFF_MS` — `undefined` otherwise (absent, HTTP-date
 * form, zero/garbage, or an ask too long to honor inside a build path).
 */
function retryAfterMs(response: Response): number | undefined {
  // Optional-chained: minimal test doubles (and some fetch shims) carry no
  // `headers` — a missing header must read as "no hint", never throw.
  const ms = Number(response.headers?.get?.("retry-after")) * 1_000;
  return ms > 0 && ms <= MAX_BACKOFF_MS ? ms : undefined;
}

/** `host + pathname` only — never the query string (feed ids are noise, not diagnostic). */
function describeTarget(url: string): string {
  const parsed = new URL(url);
  return `${parsed.host}${parsed.pathname}`;
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Best-effort, truncated body text for the FINAL failed attempt's error
 * message — restores the diagnostic a plain `if (!res.ok) throw new
 * Error(...res.status, await res.text())` had before this wrapper existed.
 * Swallows any read failure (missing/consumed body, a test double with no
 * `.text()`, …) — a diagnostic snippet is never worth failing the request
 * differently than the status/cause already dictate.
 */
async function readBodySnippet(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > MAX_BODY_SNIPPET_LENGTH
      ? `${text.slice(0, MAX_BODY_SNIPPET_LENGTH)}…`
      : text;
  } catch {
    return "";
  }
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

/** `undefined` if none are set; the lone signal if exactly one is; `AbortSignal.any(...)` otherwise. */
function combineSignals(signals: (AbortSignal | null | undefined)[]): AbortSignal | undefined {
  const present = signals.filter((s): s is AbortSignal => s != null);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return AbortSignal.any(present);
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
 * Bearer auth. See the module header for the full policy. Both `init.signal`
 * (if the caller set one) AND the separate `externalSignal` param cancel the
 * WHOLE policy — in-flight attempts AND queued backoff sleeps — not just a
 * single attempt.
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
  // init.signal is folded in here (not spread through per-attempt below) so
  // it gates retries/backoff exactly like externalSignal, instead of being
  // silently dropped by the `{ ...init, signal }` override per attempt.
  const combinedExternalSignal = combineSignals([externalSignal, init.signal]);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = combinedExternalSignal
      ? AbortSignal.any([timeoutSignal, combinedExternalSignal])
      : timeoutSignal;

    let status: number | undefined;
    let bodySnippet: string | undefined;
    let cause: unknown;
    let serverRetryDelay: number | undefined;
    try {
      const response = await doFetch(url, { ...init, headers, signal });
      if (response.ok || !isRetryableStatus(response.status)) return response;
      status = response.status;
      serverRetryDelay = retryAfterMs(response);
      if (attempt === retries) {
        bodySnippet = await readBodySnippet(response);
      } else {
        // Doomed to be retried — discard rather than read, so this
        // response's connection/socket isn't held open for a body nobody
        // will consume. `.catch()` is mandatory here: an errored stream's
        // `cancel()` returns a REJECTED promise, and a bare `void` on that
        // is an unhandled rejection — process-fatal in Node — triggered by
        // exactly the degraded-upstream condition this wrapper exists to
        // survive.
        void response.body?.cancel().catch(() => {});
      }
    } catch (err) {
      if (combinedExternalSignal?.aborted) throw err;
      cause = err;
    }

    if (attempt === retries) {
      const statusDetail =
        status !== undefined
          ? `last status ${status}${bodySnippet ? ` — ${bodySnippet}` : ""}`
          : undefined;
      const detail = statusDetail ?? causeMessage(cause);
      throw new FetchPolicyError(
        `fetchWithPolicy: ${describeTarget(url)} failed after ${attempt + 1} attempt(s) — ${detail}`,
        { status, bodySnippet, cause, attempts: attempt + 1 },
      );
    }
    await sleep(serverRetryDelay ?? backoffMs(retryDelayMs, attempt), combinedExternalSignal);
  }

  // Unreachable: the loop above always returns or throws on its final
  // (attempt === retries) iteration — this satisfies the compiler only.
  throw new FetchPolicyError(`fetchWithPolicy: ${describeTarget(url)} exhausted retries`, {
    attempts: retries + 1,
  });
}
