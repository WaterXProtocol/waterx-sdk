/**
 * Own-key record lookup. Ticker-keyed config records (`feeds`, `markets`,
 * `aggregators`) are indexed with caller-supplied strings; a bare bracket
 * read — like the `in` operator — walks the prototype chain, so a ticker
 * named like an `Object.prototype` key ("toString", "constructor", …) reads
 * as an inherited Function instead of "absent" and leaks into batches sent
 * to the network. Every such lookup funnels through here so the answer is
 * own-keys-only, everywhere, instead of per-site `Object.hasOwn` guards
 * that drift.
 */

/** `record[key]` iff `key` is an OWN key — `undefined` for an absent record, an absent key, or a prototype-chain hit. */
export function ownEntry<T extends Record<string, unknown>>(
  record: T | undefined,
  key: string,
): T[string] | undefined {
  // The `T extends Record<...>` form (rather than `Record<string, V>`) keeps
  // union-typed records inferable; TS then resolves `record[key]` only to the
  // constraint's `unknown`, so restate the definitionally-true index type.
  return record !== undefined && Object.hasOwn(record, key)
    ? (record[key] as T[string])
    : undefined;
}

/**
 * {@link ownEntry}, but throwing when the key is absent — the single shape for
 * "read a config-keyed map, fail loudly on a miss". `path` names the CONFIG
 * location (e.g. `objects.perp.markets`), so the message points at the document
 * a deployer must fix rather than at SDK internals.
 */
export function requireEntry<T extends Record<string, unknown>>(
  record: T | undefined,
  key: string,
  path: string,
): NonNullable<T[string]> {
  const value = ownEntry(record, key);
  if (value === undefined || value === null) {
    throw new Error(`waterx-config missing ${path}.${key}`);
  }
  return value as NonNullable<T[string]>;
}
