/**
 * Heuristics for flaky public RPC / gRPC (rate limits, timeouts, transient UNAVAILABLE).
 * Single source for simulate retries and the e2e gRPC proxy wrapper.
 */
import { QUOTE_CENTER_FALLBACK_MARKER } from "../../../../src/oracle/rules/waterx-rule.ts";

export function isTransientRpcErrorMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("too many requests") ||
    m.includes("resource_exhausted") ||
    m.includes("rate limit") ||
    m.includes("rate-limit") ||
    m.includes("429") ||
    m.includes("503") ||
    m.includes("service unavailable") ||
    m.includes("unavailable") ||
    m.includes("deadline exceeded") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("etimedout") ||
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("network request failed") ||
    m.includes("network error") ||
    m.includes("rpcerror")
  );
}

export function isGrpcTransientError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const o = err as { code?: string; message?: string; name?: string };
  if (o.code === "RESOURCE_EXHAUSTED") return true;
  if (o.code === "UNAVAILABLE") return true;
  if (o.code === "DEADLINE_EXCEEDED") return true;
  const msg = String((o as Error).message ?? "");
  if (isTransientRpcErrorMessage(msg)) return true;
  const name = String(o.name ?? "");
  return name === "RpcError" && isTransientRpcErrorMessage(msg);
}

/** Network-related `TypeError` from `fetch()` / undici — not arbitrary JS bugs. */
function isNetworkTypeError(err: TypeError): boolean {
  const msg = err.message ?? "";
  if (isTransientRpcErrorMessage(msg)) return true;
  const m = msg.toLowerCase();
  return m.includes("fetch") || m.includes("network");
}

/**
 * Oracle source failures that are environment-dependent (not SDK regressions):
 * off-chain source REST blips — the Lazer POST / quote-center GET throw before
 * the tx builds when the upstream returns 5xx/429 or empty data — infra
 * transients, so callers skip instead of hard-failing.
 *
 * EXCLUDES a quote-center 404 that exhausted every route (the `fell back from`
 * clause). That is not a blip: it means the SDK is requesting paths the service
 * does not serve, so every build on that network is broken. Swallowing it here
 * is half of why the 2026-09-04 route rename shipped green (PR #94) — see
 * `isExhaustedQuoteCenterRoute` in `./simulate-assertions.ts` for the other half.
 */
/**
 * A quote-center failure raised only after every rung of the leaf ladder was
 * tried — never an environment blip. A per-feed 404 ("Price ids not found": one
 * feed id absent from a gateway's registry) is a deployment mismatch worth
 * skipping past; an exhausted ladder means the SDK is asking for paths the
 * service does not serve, so every money-path build on that network is broken.
 *
 * THE single definition. It previously existed twice, here as a bare
 * `fell back from` substring and in `./simulate-assertions.ts` additionally
 * requiring /quote-center.*fetch failed/ — which disagreed on the over-the-cap
 * batch error, since that one carries the marker without those words. Keyed on
 * {@link QUOTE_CENTER_FALLBACK_MARKER} so the coupling to the emitter breaks at
 * compile time rather than silently.
 */
export function isExhaustedQuoteCenterRoute(msg: string): boolean {
  return msg.includes(QUOTE_CENTER_FALLBACK_MARKER);
}

export function isOracleTransientFailureMessage(msg: string): boolean {
  if (isExhaustedQuoteCenterRoute(msg)) return false;
  return (
    msg.includes("Lazer price fetch failed") ||
    msg.includes("Lazer returned no leEcdsa update data") ||
    msg.includes("WaterX quote-center fetch failed") ||
    msg.includes("WaterX quote-center leaf fetch failed")
  );
}

/** gRPC / source REST / explicit network blips during e2e (not Move logic or SDK TypeErrors). */
export function isInfrastructureTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // FIRST, and ahead of every arm: the exhausted-ladder message contains the
  // bare substring "fetch failed", which `isTransientRpcErrorMessage` matches.
  // Suites call `skipIfOracleFetchUnavailable` and then
  // `skipIfTransientInfrastructureError` on the SAME error, so one helper
  // refusing the outage achieves nothing while the other still skips green.
  if (isExhaustedQuoteCenterRoute(msg)) return false;
  if (isGrpcTransientError(err)) return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof TypeError && isNetworkTypeError(err)) return true;
  return isTransientRpcErrorMessage(msg);
}
