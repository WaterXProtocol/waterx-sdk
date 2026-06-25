/**
 * `buildWithdrawCollateralTx` — pull collateral out of an existing
 * position without changing size (re-levers it). Aborts if it would
 * push leverage past the market cap.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_POSITION_ID=3 WATERX_AMOUNT=500000 \
 *     pnpm exec tsx examples/actions/action-withdraw-collateral.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildWithdrawCollateralTx } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.creditType();

  const tx = await buildWithdrawCollateralTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    positionId: BigInt(requireEnv("WATERX_POSITION_ID")),
    amount: BigInt(requireEnv("WATERX_AMOUNT")),
  });

  await simThenMaybeExecute(client, tx, "withdrawCollateral", keypair);
});
