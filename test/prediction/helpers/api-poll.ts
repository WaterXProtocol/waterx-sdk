export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  label?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_INTERVAL_MS = 2_000;

/**
 * Poll until `predicate` returns true or timeout. Throws on timeout (for integration cross-checks).
 */
export async function pollUntil(
  predicate: () => boolean | Promise<boolean>,
  options: PollOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const label = options.label ?? "condition";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`pollUntil timed out after ${timeoutMs}ms waiting for ${label}`);
}
