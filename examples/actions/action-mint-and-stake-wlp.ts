/**
 * `buildMintAndStakeWlpTx` — deposit USDC from a wxa account, mint WLP, and
 * stake the freshly-minted WLP into the WLP staking pool, all in ONE atomic
 * PTB. The mint's `lp_amount` return is piped straight into the stake deposit,
 * so there's no rounding/dust between the two steps and no un-staked WLP is
 * ever left sitting idle in the account's `Balance<WLP>` slot.
 *
 * This is the "deposit USD and earn rewards" flow. To do the two steps
 * separately instead, see `action-mint-wlp.ts` + `action-stake.ts`.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_AMOUNT=30000000 \
 *     pnpm exec tsx examples/actions/action-mint-and-stake-wlp.ts
 *
 * Env:
 *   WATERX_ACCOUNT_ID  (required) — your wxa account object id
 *   WATERX_AMOUNT      collateral to deposit, raw units (default 30000000 = 30 USDC)
 *   WATERX_MIN_LP      slippage floor on minted WLP, raw units (default 0 = no floor)
 *   WATERX_STAKE_ALIAS staking pool alias in waterx_staking.pools (default "WLP")
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildMintAndStakeWlpTx } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const usdcType = client.creditType();

  const tx = await buildMintAndStakeWlpTx(client, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    depositTokenType: usdcType,
    depositTicker: "USDCUSD",
    depositAmount: BigInt(process.env.WATERX_AMOUNT ?? "30000000"),
    minLpAmount: BigInt(process.env.WATERX_MIN_LP ?? "0"),
    stakeAlias: process.env.WATERX_STAKE_ALIAS ?? "WLP",
    rewarderTypes: [], // current WLP pool has no rewarders; drop this to auto-fill from config
  });

  await simThenMaybeExecute(client, tx, "mintAndStakeWlp", keypair);
});
