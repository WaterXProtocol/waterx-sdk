/**
 * Bounded-parallelism `map`: at most `limit` calls of `fn` in flight at once,
 * results in input order, the first rejection propagating. For fan-outs over a
 * caller-sized list against ONE upstream (the canonical reader's per-symbol
 * fallback), where an unbounded `Promise.all` would open as many connections
 * as there are tickers — through a browser's per-origin connection limit, that
 * serialises them anyway and makes a slow upstream slower to surface.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  };
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
