import type { PredictClient } from "@waterx/sdk/prediction/client";

import type { EventFieldContract } from "../contract/event-fields.ts";
import type { SuiEventEnvelope } from "./events.ts";

function jsonRpcUrl(client: PredictClient): string {
  const base = client.config.grpcUrl ?? "https://fullnode.testnet.sui.io:443";
  return base.replace(/\/$/, "");
}

function parseEventRow(raw: Record<string, unknown>): SuiEventEnvelope | undefined {
  const type = String(raw.type ?? raw.eventType ?? "");
  if (!type) return undefined;
  const json = (raw.parsedJson ?? raw.parsed_json ?? raw.json) as
    | Record<string, unknown>
    | undefined;
  return { type, json: json ?? {} };
}

export function predictionEventType(client: PredictClient, suffix: string): string {
  const normalized = suffix.startsWith("::") ? suffix : `::${suffix}`;
  return `${client.packageId()}${normalized}`;
}

/**
 * Paginated `suix_queryEvents` for a Move event type (newest pages first until enough rows).
 */
export async function queryPredictionEvents(
  client: PredictClient,
  eventSuffix: string,
  opts?: { maxPages?: number; pageSize?: number },
): Promise<SuiEventEnvelope[]> {
  const eventType = predictionEventType(client, eventSuffix);
  const maxPages = opts?.maxPages ?? 25;
  const pageSize = opts?.pageSize ?? 50;
  const url = jsonRpcUrl(client);
  const out: SuiEventEnvelope[] = [];

  let cursor: string | null | undefined = null;
  for (let page = 0; page < maxPages; page += 1) {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: [{ MoveEventType: eventType }, cursor, pageSize, false],
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`suix_queryEvents HTTP ${res.status} for ${eventType}`);
    }
    const json = (await res.json()) as {
      result?: {
        data?: Record<string, unknown>[];
        nextCursor?: string | null;
        hasNextPage?: boolean;
      };
      error?: { message?: string };
    };
    if (json.error) {
      throw new Error(`suix_queryEvents failed: ${json.error.message ?? "unknown"}`);
    }
    for (const row of json.result?.data ?? []) {
      const ev = parseEventRow(row);
      if (ev) out.push(ev);
    }
    if (!json.result?.hasNextPage) break;
    cursor = json.result.nextCursor ?? null;
  }
  return out;
}

export async function findChainEventByOrderId(
  client: PredictClient,
  contract: EventFieldContract,
  orderId: bigint,
): Promise<SuiEventEnvelope | undefined> {
  const want = String(orderId);
  const events = await queryPredictionEvents(client, contract.suffix);
  return events.find((e) => String(e.json.order_id) === want);
}

export async function findChainEventByPositionId(
  client: PredictClient,
  contract: EventFieldContract,
  positionId: bigint,
): Promise<SuiEventEnvelope | undefined> {
  const want = String(positionId);
  const events = await queryPredictionEvents(client, contract.suffix);
  return events.find((e) => String(e.json.position_id) === want);
}
