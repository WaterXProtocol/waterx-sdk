/**
 * Best-effort helpers for interpreting `signAndExecuteTransaction` responses across SDK versions.
 */
export function transactionEffectsPayload(result: unknown): Record<string, unknown> | undefined {
  const r = result as Record<string, unknown>;
  const tx = (r.Transaction ?? r.transaction) as Record<string, unknown> | undefined;
  const effects = (tx?.effects ?? tx?.Effects) as Record<string, unknown> | undefined;
  return effects;
}

export function objectChangesFromResult(result: unknown): unknown[] {
  const effects = transactionEffectsPayload(result);
  if (!effects) return [];
  const raw = (effects.objectChanges as unknown[]) ?? (effects.object_changes as unknown[]) ?? [];
  return Array.isArray(raw) ? raw : [];
}

function transactionPayload(result: unknown): Record<string, unknown> | undefined {
  const r = result as Record<string, unknown>;
  const tx = (r.Transaction ?? r.transaction) as Record<string, unknown> | undefined;
  return tx;
}

function objectTypesFromResult(result: unknown): Record<string, string> {
  const tx = transactionPayload(result);
  const raw = tx?.objectTypes;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, string>;
}

function changedObjectsFromResult(result: unknown): Record<string, unknown>[] {
  const effects = transactionEffectsPayload(result);
  const raw = effects?.changedObjects ?? effects?.changed_objects;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

export function transactionDigest(result: unknown): string | undefined {
  const r = result as Record<string, unknown>;
  const direct = r.digest;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const tx = transactionPayload(result);
  const nested = tx?.digest;
  if (typeof nested === "string" && nested.length > 0) return nested;
  const effects = transactionEffectsPayload(result);
  const fromEffects = effects?.transactionDigest ?? effects?.transaction_digest;
  return typeof fromEffects === "string" && fromEffects.length > 0 ? fromEffects : undefined;
}

function eventsFromResult(result: unknown): unknown[] {
  const tx = transactionPayload(result);
  const raw = tx?.events;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw as Record<string, unknown>);
  return [];
}

/** Registry account id from `events::AccountCreated` (not the dynamic-field wrapper object id). */
export function registryAccountIdFromAccountCreated(
  result: unknown,
  packageId?: string,
): string | undefined {
  const suffix = packageId ? `${packageId}::events::AccountCreated` : "::events::AccountCreated";

  for (const ev of eventsFromResult(result)) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as Record<string, unknown>;
    const eventType = String(e.eventType ?? e.type ?? "");
    if (!eventType.endsWith(suffix) && !eventType.includes("::events::AccountCreated")) continue;
    const json = (e.json ?? e.parsedJson ?? e.parsed_json) as Record<string, unknown> | undefined;
    const addr = json?.account_object_address;
    if (typeof addr === "string" && addr.startsWith("0x")) return addr;
  }
  return undefined;
}

function typeMatches(typ: string, typeSubstring: string, exactSuffix: boolean): boolean {
  if (exactSuffix) {
    if (typeSubstring.startsWith("::")) return typ.endsWith(typeSubstring);
    return typ === typeSubstring || typ.endsWith(`::${typeSubstring}`);
  }
  return typ.includes(typeSubstring);
}

export function findObjectIdByType(
  result: unknown,
  typeSubstring: string,
  options?: { exactSuffix?: boolean },
): string | undefined {
  const exactSuffix = options?.exactSuffix ?? false;
  for (const ch of objectChangesFromResult(result)) {
    if (!ch || typeof ch !== "object") continue;
    const o = ch as Record<string, unknown>;
    const typ = String(o.objectType ?? o.object_type ?? "");
    if (!typeMatches(typ, typeSubstring, exactSuffix)) continue;
    const id = o.objectId ?? o.object_id;
    if (typeof id === "string") return id;
  }

  const objectTypes = objectTypesFromResult(result);
  for (const ch of changedObjectsFromResult(result)) {
    const id = ch.objectId ?? ch.object_id;
    if (typeof id !== "string") continue;
    const op = ch.idOperation ?? ch.id_operation;
    if (op === "Deleted") continue;
    const typ = objectTypes[id] ?? "";
    if (typeMatches(typ, typeSubstring, exactSuffix)) return id;
  }

  for (const [id, typ] of Object.entries(objectTypes)) {
    if (typeMatches(typ, typeSubstring, exactSuffix)) return id;
  }

  return undefined;
}

export function assertSuccessfulExecution(result: unknown): void {
  const r = result as Record<string, unknown>;
  if (r.$kind === "FailedTransaction") {
    const msg = JSON.stringify(r.FailedTransaction ?? r.failedTransaction ?? r);
    throw new Error(`Transaction failed: ${msg}`);
  }
  const tx = (r.Transaction ?? r.transaction) as Record<string, unknown> | undefined;
  const effects = tx?.effects as Record<string, unknown> | undefined;
  const status = effects?.status as Record<string, unknown> | undefined;
  if (status && status.success === false) {
    throw new Error(`Transaction effects.status.success is false: ${JSON.stringify(status)}`);
  }
}
