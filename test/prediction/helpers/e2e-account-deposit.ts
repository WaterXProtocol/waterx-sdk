/**
 * Compose predict account deposit PTBs for E2E simulate (direct USD or PSM MOCK_USDC).
 */
import { Transaction } from "@mysten/sui/transactions";
import { transferCoinToAccount } from "~predict/account.ts";
import type { PredictClient } from "~predict/client.ts";

import { appendPsmDeposit, appendWalletUsdDeposit } from "./account-funding.ts";
import { E2E_WALLET_COIN_MIN_BALANCE, type DiscoveredWalletCoin } from "./wallet-coin-discovery.ts";

export function appendE2eAccountDeposit(
  client: PredictClient,
  tx: Transaction,
  params: {
    accountId: string;
    walletCoin: DiscoveredWalletCoin;
    amount?: bigint;
  },
): void {
  const amount = params.amount ?? E2E_WALLET_COIN_MIN_BALANCE;
  if (params.walletCoin.source === "mock-usdc") {
    appendPsmDeposit(client, tx, {
      accountId: params.accountId,
      mockUsdcCoinId: params.walletCoin.objectId,
      amount,
    });
    return;
  }
  appendWalletUsdDeposit(client, tx, {
    accountId: params.accountId,
    usdCoinId: params.walletCoin.objectId,
    amount,
  });
}

export function appendE2eTransferCoinToAccount(
  client: PredictClient,
  tx: Transaction,
  params: {
    accountId: string;
    walletCoin: DiscoveredWalletCoin;
    amount?: bigint;
  },
): void {
  const amount = params.amount ?? 1n;
  const [coin] = tx.splitCoins(tx.object(params.walletCoin.objectId), [amount]);
  transferCoinToAccount(client, tx, {
    accountId: params.accountId,
    coin,
    coinType: params.walletCoin.coinType,
  });
}
