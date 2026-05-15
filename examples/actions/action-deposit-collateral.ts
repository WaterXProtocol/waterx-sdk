/**
 * `buildDepositCollateralTx` — add more collateral to an existing
 * position without changing size (de-levers it).
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_POSITION_ID=3 \
 *     pnpm exec tsx examples/actions/action-deposit-collateral.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildDepositCollateralTx } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.getPoolTokenType("USDCUSD");

  const tx = await buildDepositCollateralTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    positionId: BigInt(requireEnv("WATERX_POSITION_ID")),
    collateralAmount: BigInt(process.env.WATERX_AMOUNT ?? "1000000"),
  });

  await simThenMaybeExecute(client, tx, "depositCollateral", keypair);
});
