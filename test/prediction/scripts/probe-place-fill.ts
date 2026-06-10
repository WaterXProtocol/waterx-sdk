#!/usr/bin/env tsx
/**
 * Place one order on testnet and diagnose fill path: bypass broker vs resting OPEN vs keeper fillOrder.
 *
 * Usage: pnpm tsx test/prediction/scripts/probe-place-fill.ts
 */
import { getOrder, getOrderCursor, getPosition } from "~predict/fetch.ts";
import { fillOrder, placeOrder } from "~predict/prediction.ts";

import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import {
  INTEGRATION_FILLABLE_PRICE_CAP_BPS,
  INTEGRATION_MIN_FILL,
} from "../fixtures/ptb-params.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import {
  INTEGRATION_FAR_FUTURE,
  INTEGRATION_OPEN_MARKET_BYTES,
} from "../helpers/integration-positions.ts";
import { executeAndFetch, setupIntegration } from "../helpers/integration-setup.ts";
import { findChainEventByOrderId } from "../helpers/query-prediction-events.ts";

function eventsFromResult(result: unknown): Array<{ type: string; json: Record<string, unknown> }> {
  const r = result as Record<string, unknown>;
  const payload = ((r.Transaction ?? r.transaction) as Record<string, unknown> | undefined) ?? r;
  const raw = payload?.events;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  const out: Array<{ type: string; json: Record<string, unknown> }> = [];
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

function findEventSuffix(
  events: Array<{ type: string; json: Record<string, unknown> }>,
  suffix: string,
): { type: string; json: Record<string, unknown> } | undefined {
  const prefixed = suffix.startsWith("::") ? suffix : `::${suffix}`;
  return events.find((e) => e.type.endsWith(prefixed) || e.type === suffix);
}

loadRepoEnvFiles();

const BROKER_POLL_MS = 20_000;
const POLL_INTERVAL_MS = 2_000;

async function tryLoadOpenOrder(
  client: Awaited<ReturnType<typeof setupIntegration>>["client"],
  orderId: bigint,
): Promise<"OPEN" | "NOT_OPEN" | "MISSING"> {
  try {
    const order = await getOrder(client, { orderId });
    return order.kind === "OPEN" ? "OPEN" : "NOT_OPEN";
  } catch {
    return "MISSING";
  }
}

async function main(): Promise<void> {
  if (!hasWriteCredentials()) {
    console.error("SUI_PRIVATE_KEY not set");
    process.exit(1);
  }

  const ctx = await setupIntegration();
  console.log("═".repeat(72));
  console.log("Probe: placeOrder → observe fill path");
  console.log("═".repeat(72));
  console.log("owner:", ctx.ownerAddress);
  console.log("accountId:", ctx.accountId);
  console.log("keeper:", ctx.keeperAddress ?? "(none — manual fillOrder unavailable)");
  console.log("market label bytes:", Buffer.from(INTEGRATION_OPEN_MARKET_BYTES).toString("utf8"));
  console.log();

  const before = await getOrderCursor(ctx.client);
  const placeTx = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
    placeOrder(ctx.client, tx, {
      accountId: ctx.accountId,
      marketId: INTEGRATION_OPEN_MARKET_BYTES,
      selection: "YES",
      maxSpend: 1_000n,
      minShares: 1n,
      priceCapBps: INTEGRATION_FILLABLE_PRICE_CAP_BPS,
      expiryTs: INTEGRATION_FAR_FUTURE,
    });
  });

  const placeEvents = eventsFromResult(placeTx);
  const placed = findEventSuffix(placeEvents, EVENT_CONTRACT.OrderPlaced.suffix);
  const filledInSameTx = findEventSuffix(placeEvents, EVENT_CONTRACT.OrderFilled.suffix);

  const after = await getOrderCursor(ctx.client);
  const orderId =
    after.back ?? (before.back !== null ? before.back + 1n : (after.front ?? undefined));

  console.log("── placeOrder tx events ──");
  for (const ev of placeEvents) {
    const short = ev.type.split("::").slice(-2).join("::");
    console.log(`  ${short}:`, JSON.stringify(ev.json));
  }
  console.log();
  console.log("── placeOrder tx ──");
  console.log("orderId (cursor):", orderId?.toString() ?? "(unknown)");
  if (placed) {
    console.log("OrderPlaced:", JSON.stringify(placed.json, null, 2));
  } else {
    console.log("OrderPlaced: (not in tx events)");
  }
  console.log("OrderFilled in same tx:", filledInSameTx ? "YES" : "no");
  if (filledInSameTx) {
    console.log("OrderFilled:", JSON.stringify(filledInSameTx.json, null, 2));
  }
  console.log();

  if (orderId === undefined) {
    console.error("Could not infer orderId");
    process.exit(1);
  }

  console.log("── tight poll getOrder (6s) ──");
  const tightDeadline = Date.now() + 6_000;
  let orderState: "OPEN" | "NOT_OPEN" | "MISSING" = "MISSING";
  let sawOpen = false;
  while (Date.now() < tightDeadline) {
    orderState = await tryLoadOpenOrder(ctx.client, orderId);
    if (orderState === "OPEN") {
      sawOpen = true;
      console.log(
        `  ${new Date().toISOString()} getOrder=OPEN (resting book — real fillOrder path possible)`,
      );
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!sawOpen) {
    console.log(`  after 6s poll: getOrder=${orderState} (never saw OPEN)`);
  }
  console.log();

  let fillPath: "bypass-same-tx" | "broker" | "already-gone" | "keeper" | "still-open" =
    "still-open";
  let positionId: bigint | undefined;

  if (filledInSameTx) {
    fillPath = "bypass-same-tx";
    positionId = BigInt(String(filledInSameTx.json.position_id));
  } else if (orderState !== "OPEN") {
    fillPath = "already-gone";
    const chainFill = await findChainEventByOrderId(
      ctx.client,
      EVENT_CONTRACT.OrderFilled,
      orderId,
    );
    if (chainFill) {
      positionId = BigInt(String(chainFill.json.position_id));
      console.log("OrderFilled found on chain (post-place, pre-poll):");
      console.log(JSON.stringify(chainFill.json, null, 2));
    }
  } else {
    console.log(`── polling broker ~${BROKER_POLL_MS / 1000}s ──`);
    const deadline = Date.now() + BROKER_POLL_MS;
    while (Date.now() < deadline) {
      const chainFill = await findChainEventByOrderId(
        ctx.client,
        EVENT_CONTRACT.OrderFilled,
        orderId,
      );
      if (chainFill) {
        fillPath = "broker";
        positionId = BigInt(String(chainFill.json.position_id));
        console.log("broker filled — OrderFilled:");
        console.log(JSON.stringify(chainFill.json, null, 2));
        break;
      }
      orderState = await tryLoadOpenOrder(ctx.client, orderId);
      if (orderState !== "OPEN") {
        fillPath = "already-gone";
        break;
      }
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    console.log();
    console.log("after poll getOrder:", orderState);
    console.log();
  }

  if ((fillPath === "still-open" || sawOpen) && orderState === "OPEN") {
    if (!ctx.keeper) {
      console.log("VERDICT: resting OPEN order — no broker fill within poll window, no keeper key");
      process.exit(0);
    }
    console.log("── keeper fillOrder (manual) ──");
    const fillTx = await executeAndFetch(ctx.client, ctx.keeper, (tx) => {
      fillOrder(ctx.client, tx, { orderId, ...INTEGRATION_MIN_FILL });
    });
    const keeperFill = findEventSuffix(eventsFromResult(fillTx), EVENT_CONTRACT.OrderFilled.suffix);
    fillPath = "keeper";
    if (keeperFill) {
      positionId = BigInt(String(keeperFill.json.position_id));
      console.log("keeper OrderFilled:", JSON.stringify(keeperFill.json, null, 2));
    }
  }

  console.log("── verdict ──");
  const labels: Record<typeof fillPath, string> = {
    "bypass-same-tx":
      "BYPASS — OrderFilled in the same tx as placeOrder (broker/testnet instant fill; no resting book)",
    broker: "BROKER — off-chain bot called fill_order after place (real fill data on chain)",
    keeper: "KEEPER — order rested OPEN; local keeper executed fillOrder PTB",
    "already-gone": "FILLED (timing unclear) — order not OPEN; check OrderFilled event above",
    "still-open": "UNFILLED — order still OPEN after broker poll",
  };
  console.log(labels[fillPath]);

  if (positionId !== undefined) {
    console.log();
    console.log("── position view ──");
    try {
      const pos = await getPosition(ctx.client, { positionId });
      console.log(JSON.stringify(pos, null, 2));
    } catch (err) {
      console.log("getPosition failed:", err instanceof Error ? err.message : err);
    }
  }

  const orderIdFromFill =
    positionId !== undefined
      ? (await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId))?.json
      : undefined;
  if (orderIdFromFill) {
    const oid = BigInt(String(orderIdFromFill.order_id));
    const pid = BigInt(String(orderIdFromFill.position_id));
    if (oid !== pid) {
      console.log();
      console.log(
        `note: order_id (${oid}) ≠ position_id (${pid}) — typical of real fillOrder, not bypass`,
      );
    } else {
      console.log();
      console.log(`note: order_id === position_id (${oid}) — common on bypass testnet fills`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
