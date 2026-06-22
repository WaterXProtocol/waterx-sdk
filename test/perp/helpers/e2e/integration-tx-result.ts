/** Result of {@link normalizeIntegrationTxResult} (integration `execTx`). */
export type NormalizedIntegrationTxResult = ReturnType<typeof normalizeIntegrationTxResult>;

/** Normalize gRPC `signAndExecuteTransaction` result to JSON-RPC-shaped effects/events. */
export function normalizeIntegrationTxResult(raw: unknown): {
  digest: string;
  effects: Record<string, unknown> & {
    status: { status: string; error?: string };
  };
  events: Array<Record<string, unknown> & { type: string; parsedJson: unknown }>;
} {
  const r = raw as {
    $kind?: string;
    Transaction?: Record<string, unknown>;
    FailedTransaction?: Record<string, unknown>;
  };
  const inner =
    r.$kind === "Transaction"
      ? r.Transaction
      : r.$kind === "FailedTransaction"
        ? r.FailedTransaction
        : null;
  if (!inner || typeof inner.digest !== "string") {
    throw new Error("Unexpected gRPC transaction result shape");
  }

  const success = (inner.status as { success?: boolean } | undefined)?.success === true;
  const events = ((inner.events as unknown[]) ?? []).map((e) => {
    const ev = e as Record<string, unknown>;
    return {
      ...ev,
      type: String(ev.type ?? ev.eventType ?? ""),
      parsedJson: ev.parsedJson ?? ev.json ?? null,
    };
  });

  const err = formatGrpcExecError((inner.status as { error?: unknown } | undefined)?.error);

  return {
    digest: inner.digest,
    effects: {
      ...(typeof inner.effects === "object" && inner.effects !== null
        ? (inner.effects as object)
        : {}),
      status: {
        status: success ? "success" : "failure",
        ...(err !== undefined ? { error: err } : {}),
      },
    },
    events,
  };
}

function formatGrpcExecError(err: unknown): string | undefined {
  if (err == null) return undefined;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
