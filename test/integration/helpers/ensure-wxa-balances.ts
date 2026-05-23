/**
 * Integration wxa balance floors shared by WLP / staking gap-coverage tests.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import type { WaterXClient } from "../../../src/client.ts";
import { getAccountBalance } from "../../../src/fetch.ts";
import { buildMintWlpTx } from "../../../src/tx-builders.ts";
import type { NormalizedIntegrationTxResult } from "../../helpers/e2e/integration-tx-result.ts";
import { buildDepositUsdcFromWalletTx } from "./account-bootstrap.ts";
import { E2E_PERSISTENT_WLP } from "./e2e-persistent-state.ts";
import { integrationGasBudget } from "./integration-gas.ts";

type ExecTx = (
  tx: import("@mysten/sui/transactions").Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
) => Promise<NormalizedIntegrationTxResult>;

type ExecBuilt = (
  build: () => Promise<import("@mysten/sui/transactions").Transaction>,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number; cooldownTickers?: readonly string[] },
) => Promise<NormalizedIntegrationTxResult>;

export async function ensureIntegrationMinWlpBalance(args: {
  client: WaterXClient;
  trader: Ed25519Keypair;
  owner: string;
  accountId: string;
  minWlp: bigint;
  execTx: ExecTx;
  execBuiltTxWithCooldownRetries: ExecBuilt;
  assertSuccess: (r: NormalizedIntegrationTxResult) => void;
}): Promise<bigint> {
  const wlpType = args.client.wlpType();
  let wlpBal = await getAccountBalance(args.client, args.accountId, wlpType);
  if (wlpBal >= args.minWlp) return wlpBal;

  const usdcType = args.client.getPoolTokenType("USDCUSD");
  const { mintPullUsdc } = E2E_PERSISTENT_WLP;
  let usdcFree = await getAccountBalance(args.client, args.accountId, usdcType);
  const needFree = mintPullUsdc + 5_000_000n;
  if (usdcFree < needFree) {
    const depTx = await buildDepositUsdcFromWalletTx(
      args.client,
      args.owner,
      args.accountId,
      needFree - usdcFree,
    );
    const depResult = await args.execTx(depTx, args.trader, {
      gasBudget: integrationGasBudget("default"),
    });
    args.assertSuccess(depResult);
    usdcFree = await getAccountBalance(args.client, args.accountId, usdcType);
  }

  const mintResult = await args.execBuiltTxWithCooldownRetries(
    () =>
      buildMintWlpTx(args.client, {
        accountId: args.accountId,
        depositTokenType: usdcType,
        depositTicker: "USDCUSD",
        depositAmount: mintPullUsdc,
        minLpAmount: 1n,
        skipOraclePriceRefresh: false,
      }),
    args.trader,
    { gasBudget: integrationGasBudget("wlp") },
  );
  args.assertSuccess(mintResult);
  wlpBal = await getAccountBalance(args.client, args.accountId, wlpType);
  return wlpBal;
}
