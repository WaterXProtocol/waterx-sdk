#!/usr/bin/env tsx
import { getOrder, getPosition } from "~predict/fetch.ts";

import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import {
  findChainEventByOrderId,
  queryPredictionEvents,
} from "../helpers/query-prediction-events.ts";

loadRepoEnvFiles();

const orderId = BigInt(process.argv[2] ?? "0");

async function main(): Promise<void> {
  const client = await createE2eClient();
  const placed = await findChainEventByOrderId(client, EVENT_CONTRACT.OrderPlaced, orderId);
  const filled = await findChainEventByOrderId(client, EVENT_CONTRACT.OrderFilled, orderId);
  console.log("orderId:", orderId.toString());
  console.log("OrderPlaced:", placed ? JSON.stringify(placed.json, null, 2) : "NOT FOUND");
  console.log("OrderFilled:", filled ? JSON.stringify(filled.json, null, 2) : "NOT FOUND");

  try {
    console.log("getOrder:", JSON.stringify(await getOrder(client, { orderId }), null, 2));
  } catch (e) {
    console.log("getOrder error:", e instanceof Error ? e.message : e);
  }

  const posIds = [filled?.json.position_id, orderId.toString()].filter(
    (v, i, a) => v !== undefined && a.indexOf(v) === i,
  );
  for (const raw of posIds) {
    const positionId = BigInt(String(raw));
    try {
      const pos = await getPosition(client, { positionId });
      console.log(`position ${positionId}:`, JSON.stringify(pos, null, 2));
    } catch (e) {
      console.log(`position ${positionId} error:`, e instanceof Error ? e.message : e);
    }
  }

  const recent = await queryPredictionEvents(client, EVENT_CONTRACT.OrderFilled.suffix, {
    maxPages: 3,
  });
  const hits = recent.filter((e) => String(e.json.order_id) === orderId.toString());
  console.log(`recent OrderFilled pages matching order_id=${orderId}:`, hits.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
