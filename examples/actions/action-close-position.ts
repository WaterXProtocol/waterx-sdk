/**
 * `buildClosePositionTx` — direct user-side close. Single PTB composes
 * oracle refresh + `close_position_request` + `execute`. Fills at the
 * live oracle. `acceptablePrice` is the slippage floor (LONG close needs
 * fill ≥ floor; SHORT close needs fill ≤ floor).
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_POSITION_ID=3 \
 *     pnpm exec tsx examples/actions/action-close-position.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildClosePositionTx, rawPrice } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.creditType();

  const tx = await buildClosePositionTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    positionId: BigInt(requireEnv("WATERX_POSITION_ID")),
    acceptablePrice: rawPrice(Number(process.env.WATERX_ACCEPTABLE_USD ?? "1")),
  });

  await simThenMaybeExecute(client, tx, "closePosition", keypair);
});
