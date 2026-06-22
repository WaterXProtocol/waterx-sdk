import { decodeEnumVariant } from "@waterx/sdk/prediction/bcs";
import { expect } from "vitest";

import type { EventFieldContract, JsonFieldKind } from "../contract/event-fields.ts";

export interface SuiEventEnvelope {
  /** Fully-qualified Move type, e.g. `0xPKG::events::OrderPlaced`. */
  type: string;
  /** Parsed JSON payload (field names match the Move struct). */
  json: Record<string, unknown>;
}

function pickPayload(result: unknown): Record<string, unknown> | undefined {
  const r = result as Record<string, unknown>;
  return ((r.Transaction ?? r.transaction) as Record<string, unknown> | undefined) ?? r;
}

/**
 * Extract events from a `signAndExecuteTransaction` or `getTransaction` response, normalising
 * across the two common SDK shapes (`{ transaction: { events } }` vs flat `{ events }`).
 */
export function eventsFromResult(result: unknown): SuiEventEnvelope[] {
  const payload = pickPayload(result);
  const raw = payload?.events;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  const out: SuiEventEnvelope[] = [];
  for (const ev of list) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as Record<string, unknown>;
    const type = String(e.eventType ?? e.type ?? "");
    if (!type) continue;
    const json = (e.json ?? e.parsedJson ?? e.parsed_json) as Record<string, unknown> | undefined;
    out.push({ type, json: json ?? {} });
  }
  return out;
}

/** Match by exact type suffix (with `::` prefix to avoid `Order` matching `OrderPlaced`). */
function typeMatches(eventType: string, suffix: string): boolean {
  const prefixed = suffix.startsWith("::") ? suffix : `::${suffix}`;
  return eventType.endsWith(prefixed) || eventType === suffix;
}

export function findEvent(
  events: SuiEventEnvelope[],
  suffix: string,
): SuiEventEnvelope | undefined {
  return events.find((e) => typeMatches(e.type, suffix));
}

export function findAllEvents(events: SuiEventEnvelope[], suffix: string): SuiEventEnvelope[] {
  return events.filter((e) => typeMatches(e.type, suffix));
}

/** Loose equality that treats bigints / numeric strings / numbers as equal when their bigint values match. */
function looseEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (typeof expected === "bigint" || typeof actual === "bigint") {
    try {
      return (
        BigInt(actual as string | number | bigint) === BigInt(expected as string | number | bigint)
      );
    } catch {
      return false;
    }
  }
  if (typeof expected === "number" && typeof actual === "string") {
    return Number(actual) === expected;
  }
  if (typeof expected === "string" && typeof actual === "number") {
    return String(actual) === expected;
  }
  return false;
}

/**
 * Assert that at least one event of the given type was emitted, optionally matching the listed fields.
 * Returns the first matching event for further inspection.
 */
export function expectEvent(
  result: unknown,
  suffix: string,
  expected?: Record<string, unknown>,
): SuiEventEnvelope {
  const events = eventsFromResult(result);
  const matches = findAllEvents(events, suffix);
  expect(
    matches.length,
    `Expected at least one event matching "${suffix}" but found ${events.length} events: ${events
      .map((e) => e.type)
      .join(", ")}`,
  ).toBeGreaterThan(0);
  if (!expected) return matches[0]!;
  const mismatchReports: string[] = [];
  for (const m of matches) {
    const failures: string[] = [];
    for (const [key, value] of Object.entries(expected)) {
      if (!looseEqual(m.json[key], value)) {
        failures.push(
          `  ${key}: expected ${JSON.stringify(value)} got ${JSON.stringify(m.json[key])}`,
        );
      }
    }
    if (failures.length === 0) return m;
    mismatchReports.push(`Event ${m.type}:\n${failures.join("\n")}`);
  }
  throw new Error(
    `No "${suffix}" event matched expected fields.\n${mismatchReports.join("\n---\n")}`,
  );
}

export function expectNoEvent(result: unknown, suffix: string): void {
  const events = eventsFromResult(result);
  const matches = findAllEvents(events, suffix);
  expect(matches, `Expected no event "${suffix}" but found ${matches.length}.`).toHaveLength(0);
}

function isU64Json(value: unknown): boolean {
  if (typeof value === "bigint") return value >= 0n;
  if (typeof value === "number") return Number.isInteger(value) && value >= 0;
  if (typeof value === "string") return /^\d+$/.test(value);
  return false;
}

function isAddressJson(value: unknown): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
}

function assertFieldKind(value: unknown, kind: JsonFieldKind, key: string): void {
  switch (kind) {
    case "u64":
      expect(isU64Json(value), `${key} should be a u64 JSON value`).toBe(true);
      return;
    case "address":
      expect(isAddressJson(value), `${key} should be a 0x-prefixed address`).toBe(true);
      return;
    case "bool":
      expect(typeof value).toBe("boolean");
      return;
    case "enum":
      expect(value !== undefined && value !== null).toBe(true);
      return;
    case "bytes":
      expect(typeof value === "string" || Array.isArray(value) || value instanceof Uint8Array).toBe(
        true,
      );
      return;
    default:
      return;
  }
}

/** Assert parsed JSON carries every field the indexer anti-corruption layer expects. */
export function expectEventShape(event: SuiEventEnvelope, contract: EventFieldContract): void {
  for (const key of contract.required) {
    expect(event.json[key], `missing ${key} on ${contract.suffix}`).toBeDefined();
    expect(event.json[key], `${key} should not be null`).not.toBeNull();
    const kind = contract.kinds?.[key];
    if (kind !== undefined) {
      assertFieldKind(event.json[key], kind, key);
    }
  }
}

/** Normalise Move enum wire shapes (`"YES"`, `{ Yes: true }`, `{ "@variant": "Yes" }`, etc.). */
export function normalizeEnumField(value: unknown): string {
  try {
    return decodeEnumVariant(value).toUpperCase();
  } catch {
    return String(value).toUpperCase();
  }
}
