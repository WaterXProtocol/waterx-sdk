import { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../../../../src/client.ts";
import type { CollateralAsset } from "../../../../src/constants.ts";
import { buildMintWlpTx } from "../../../../src/tx-builders.ts";
import { getWlpMinDepositForCollateral } from "./fetch-read-helpers-for-tests.ts";

/** One wallet-level `Coin<T>` row from `PerpClient.listCoins`. */
export type WalletCollateralCoin = { objectId: string; balance: bigint };

function sortCoinsByBalanceDesc(coins: WalletCollateralCoin[]): WalletCollateralCoin[] {
  return [...coins].sort((a, b) => (a.balance === b.balance ? 0 : a.balance < b.balance ? 1 : -1));
}

/**
 * Merge wallet `Coin<T>` rows (Mysten `Transaction.mergeCoins`), split off the pool's on-chain
 * {@link getWlpMinDepositForCollateral}, then append `buildMintWlpTx`.
 */
export async function buildMintWlpSimulateTx(
  client: PerpClient,
  args: {
    recipient: string;
    collateral: CollateralAsset;
    walletCoins: readonly WalletCollateralCoin[];
    gasBudget?: number;
  },
): Promise<Transaction> {
  const minDeposit = await getWlpMinDepositForCollateral(client, args.collateral);
  if (minDeposit <= 0n) {
    throw new Error(
      `buildMintWlpSimulateTx: invalid pool min_deposit ${minDeposit} for ${args.collateral}`,
    );
  }
  const sorted = sortCoinsByBalanceDesc(
    args.walletCoins.filter((c) => c.balance > 0n && c.objectId.length > 0),
  );
  if (sorted.length === 0) {
    throw new Error("buildMintWlpSimulateTx: need at least one coin with balance > 0");
  }
  const total = sorted.reduce((s, c) => s + c.balance, 0n);
  if (total < minDeposit) {
    throw new Error(
      `buildMintWlpSimulateTx: merged wallet total ${total} < pool min_deposit ${minDeposit} for ${args.collateral}`,
    );
  }
  const splitAmount = minDeposit;

  const tx = new Transaction();
  tx.setGasBudget(args.gasBudget ?? 250_000_000);
  tx.setSender(args.recipient);

  const primary = tx.object(sorted[0]!.objectId);
  if (sorted.length > 1) {
    tx.mergeCoins(
      primary,
      sorted.slice(1).map((c) => tx.object(c.objectId)),
    );
  }
  const [depositCoin] = tx.splitCoins(primary, [splitAmount]);
  await buildMintWlpTx(client, {
    depositCoin,
    recipient: args.recipient,
    collateral: args.collateral,
    tx,
  });
  return tx;
}
