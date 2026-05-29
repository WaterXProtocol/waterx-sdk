/**
 * Run async work in fixed-size chunks so at most `concurrency` tasks are in flight.
 * Preserves result order (same index as `items`).
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const c = Math.max(1, Math.min(32, Math.floor(concurrency)));
  const out: R[] = [];
  for (let i = 0; i < items.length; i += c) {
    const chunk = items.slice(i, i + c);
    out.push(...(await Promise.all(chunk.map((item) => fn(item)))));
  }
  return out;
}
