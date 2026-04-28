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
    m.includes("etimedout")
  );
}

export function isGrpcTransientError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const o = err as { code?: string; message?: string };
  if (o.code === "RESOURCE_EXHAUSTED") return true;
  if (o.code === "UNAVAILABLE") return true;
  if (o.code === "DEADLINE_EXCEEDED") return true;
  const msg = String((o as Error).message ?? "");
  return isTransientRpcErrorMessage(msg);
}
