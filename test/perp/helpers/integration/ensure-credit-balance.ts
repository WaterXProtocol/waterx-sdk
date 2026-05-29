/**
 * Integration helper: ensure wxa account holds at least `minCredit` CREDIT.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../../src/client.ts";
import { getAccountBalance } from "../../../../src/fetch.ts";
import { mintCreditToAccount } from "../../../../src/user/custody.ts";
import { selectWalletCoinsCoveringAmount } from "../../integration/helpers/account-bootstrap.ts";
import { integrationGasBudget } from "../../integration/helpers/integration-gas.ts";
import { isCreditPipelineConfigured } from "../e2e/e2e-custody.ts";
import type { NormalizedIntegrationTxResult } from "../e2e/integration-tx-result.ts";

type ExecTx = (
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
) => Promise<NormalizedIntegrationTxResult>;

export async function ensureIntegrationMinCreditBalance(args: {
  client: WaterXClient;
  trader: Ed25519Keypair;
  owner: string;
  accountId: string;
  minCredit: bigint;
  execTx: ExecTx;
  assertSuccess: (r: NormalizedIntegrationTxResult) => void;
}): Promise<bigint> {
  if (!isCreditPipelineConfigured(args.client)) {
    throw new Error("Credit pipeline not configured on this deployment");
  }

  const creditType = args.client.creditType();
  let bal = await getAccountBalance(args.client, args.accountId, creditType);
  if (bal >= args.minCredit) return bal;

  const assetType = args.client.getNativeAssets()[0]?.type;
  if (!assetType) {
    throw new Error("No native custody backing asset in config");
  }

  const need = args.minCredit - bal + 1_000n;
  const wallet = await selectWalletCoinsCoveringAmount(args.client, args.owner, assetType, need);
  if (wallet.totalBalance < need) {
    throw new Error(
      `Wallet backing asset insufficient for CREDIT mint: need ${need}, have ${wallet.totalBalance}`,
    );
  }

  const tx = new Transaction();
  const [part] = tx.splitCoins(tx.object(wallet.coins[0]!.objectId), [tx.pure.u64(need)]);
  mintCreditToAccount(args.client, tx, {
    accountId: args.accountId,
    assetCoin: part!,
    assetType,
  });

  const result = await args.execTx(tx, args.trader, {
    gasBudget: integrationGasBudget("custodyMint"),
  });
  args.assertSuccess(result);

  bal = await getAccountBalance(args.client, args.accountId, creditType);
  return bal;
}
