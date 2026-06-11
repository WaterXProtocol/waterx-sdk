/** Sui tx event helpers (no Vitest — safe for tsx CLI scripts). */

export interface SuiEventEnvelope {
  type: string;
  json: Record<string, unknown>;
}

function pickPayload(result: unknown): Record<string, unknown> | undefined {
  const r = result as Record<string, unknown>;
  return ((r.Transaction ?? r.transaction) as Record<string, unknown> | undefined) ?? r;
}

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
