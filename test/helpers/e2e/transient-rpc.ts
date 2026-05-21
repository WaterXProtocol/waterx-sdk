/**
 * Heuristics for flaky public RPC / gRPC (rate limits, timeouts, transient UNAVAILABLE).
 * Single source for simulate retries and the e2e gRPC proxy wrapper.
 */
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

/** gRPC / Hermes / generic `fetch()` blips during e2e (not Move logic failures). */
export function isInfrastructureTransientError(err: unknown): boolean {
  if (isGrpcTransientError(err)) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return isTransientRpcErrorMessage(msg);
}
