/**
 * `buildIncreasePositionTx` — top up an existing position with more
 * collateral + size. `acceptablePrice` caps slippage on the incremental
 * fill (same side as the position).
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_POSITION_ID=3 \
 *     pnpm exec tsx examples/actions/action-increase-position.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildIncreasePositionTx, rawPrice } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.creditType();

  const tx = await buildIncreasePositionTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    positionId: BigInt(requireEnv("WATERX_POSITION_ID")),
    collateralAmount: BigInt(process.env.WATERX_COLLATERAL ?? "1000000"),
    size: BigInt(process.env.WATERX_SIZE ?? rawPrice(0.00005).toString()),
    acceptablePrice: rawPrice(Number(process.env.WATERX_ACCEPTABLE_USD ?? "200000")),
  });

  await simThenMaybeExecute(client, tx, "increasePosition", keypair);
});
