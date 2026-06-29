/**
 * `buildAddPreOrderTx` — attach an additional TP or SL leg to an
 * already-resting main order. Pre-orders must remain reduce-only,
 * opposite side, no collateral, no linked position. Per-market cap is
 * `MarketConfig.max_pre_orders` (default 2).
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_MAIN_ORDER_ID=12 \
 *     pnpm exec tsx examples/actions/action-add-pre-order.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildAddPreOrderTx, rawPrice } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.creditType();

  const tx = await buildAddPreOrderTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    mainOrderId: BigInt(requireEnv("WATERX_MAIN_ORDER_ID")),
    preOrder: {
      isLong: false, // opposite side of main LONG
      isStopOrder: false,
      reduceOnly: true,
      size: BigInt(process.env.WATERX_SIZE ?? rawPrice(0.0001).toString()),
      triggerPrice: rawPrice(Number(process.env.WATERX_TRIGGER_USD ?? "90000")),
      acceptablePrice: undefined,
      collateralAmount: 0n,
    },
  });

  await simThenMaybeExecute(client, tx, "addPreOrder", keypair);
});
