/**
 * `buildMintWlpTx` — convert USDC inside a wxa account into WLP LP
 * tokens. `minLpAmount` is the slippage floor; pass `0n` for "no floor"
 * if you're OK with whatever quote the pool gives.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_AMOUNT=30000000 \
 *     pnpm exec tsx examples/actions/action-mint-wlp.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildMintWlpTx } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const usdcType = client.getPoolTokenType("USDCUSD");

  const tx = await buildMintWlpTx(client, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    depositTokenType: usdcType,
    depositTicker: "USDCUSD",
    depositAmount: BigInt(process.env.WATERX_AMOUNT ?? "30000000"),
    minLpAmount: BigInt(process.env.WATERX_MIN_LP ?? "0"),
  });

  await simThenMaybeExecute(client, tx, "mintWlp", keypair);
});
