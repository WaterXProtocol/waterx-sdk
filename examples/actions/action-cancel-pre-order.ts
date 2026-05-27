/**
 * `buildCancelPreOrderTx` — drop a single TP or SL leg from an
 * already-filled position. Both ids are the order ids, not position id.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_MAIN_ORDER_ID=12 WATERX_PRE_ORDER_ID=13 \
 *     pnpm exec tsx examples/actions/action-cancel-pre-order.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildCancelPreOrderTx } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.creditType();

  const tx = await buildCancelPreOrderTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    mainOrderId: BigInt(requireEnv("WATERX_MAIN_ORDER_ID")),
    preOrderId: BigInt(requireEnv("WATERX_PRE_ORDER_ID")),
  });

  await simThenMaybeExecute(client, tx, "cancelPreOrder", keypair);
});
