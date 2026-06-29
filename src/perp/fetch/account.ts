/**
 * wxa account reads (`waterx_account`) — work on credit-only deployments
 * (which have no `waterx_perp_view`). Plus the inclusive spendable-credit read.
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  probeAddressCreditBalance,
  probeParkedBackingAssets,
  sumParkedBackingAsCreditRaw,
  type ParkedBackingAssetBalance,
} from "../../account/funding/balance.ts";
import {
  accountBalance as accountBalanceCall,
  accountIds as accountIdsCall,
} from "../../generated/waterx_account/account.ts";
import type { PerpClient } from "../client.ts";
import { COLLATERAL_DECIMALS } from "../constants.ts";
import { simulateAndExtract } from "./simulate.ts";

/**
 * List the wxa account IDs owned by `owner` (`account::account_ids`).
 * Returns `[]` when the owner has never created an account. Use this to
 * resolve the `account_id` a cross-chain deposit must target before
 * filling the EVM `suiRecipient` field.
 */
export async function getAccountsByOwner(client: PerpClient, owner: string): Promise<string[]> {
  const tx = new Transaction();
  accountIdsCall({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      owner,
    },
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.vector(bcs.Address).parse(bytes);
}

/**
 * A wxa account's stored `Balance<T>` (`account::account_balance<T>`).
 * `coinType` defaults to the deployment's CREDIT type — i.e. the bridged
 * balance available to withdraw. Returns `0n` for an unknown coin type.
 */
export async function getAccountBalance(
  client: PerpClient,
  accountId: string,
  coinType?: string,
): Promise<bigint> {
  const tx = new Transaction();
  accountBalanceCall({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId,
    },
    typeArguments: [coinType ?? client.creditType()],
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return BigInt(bcs.u64().parse(bytes));
}

/**
 * Inclusive wxUSD credit an account can spend after the default async tx-builder
 * pre-sweep (`appendConsolidateForSpend`).
 *
 * - `internalRaw` — stored `Balance<CREDIT>` (`getAccountBalance`).
 * - `pendingBackingRaw` — native-custody backing assets (USDC, USDSUI, …)
 *   parked at the account's Sui address, rescaled to CREDIT decimals at the
 *   1:1 PSM peg (same probe as `appendConsolidateToUsd`).
 * - `pendingCreditAtAddressRaw` — CREDIT at the account address (accumulator +
 *   owned coins). Swept into the internal slot by `appendConsolidateAddressCredit`
 *   via `consumeDepositDirect`.
 * - `totalRaw` — sum of the three components; matches post-
 *   `appendConsolidateForSpend` spendable balance for predict / perp
 *   builders with `consolidateToUsd: true` (default).
 */
export interface SpendableCreditBalance {
  internalRaw: bigint;
  pendingBackingRaw: bigint;
  pendingCreditAtAddressRaw: bigint;
  totalRaw: bigint;
  /** Per-asset breakdown for the backing-asset probe (empty when nothing parked). */
  parkedBacking: ParkedBackingAssetBalance[];
}

export async function getSpendableCreditBalance(
  client: PerpClient,
  accountId: string,
): Promise<SpendableCreditBalance> {
  const creditType = client.creditType();
  const [internalRaw, parkedBacking, addressCredit] = await Promise.all([
    getAccountBalance(client, accountId, creditType),
    probeParkedBackingAssets(client, accountId),
    probeAddressCreditBalance(client, accountId),
  ]);
  const pendingBackingRaw = sumParkedBackingAsCreditRaw(parkedBacking, COLLATERAL_DECIMALS);
  const pendingCreditAtAddressRaw = addressCredit.fundsRaw + addressCredit.coinsRaw;
  const totalRaw = internalRaw + pendingBackingRaw + pendingCreditAtAddressRaw;
  return {
    internalRaw,
    pendingBackingRaw,
    pendingCreditAtAddressRaw,
    totalRaw,
    parkedBacking,
  };
}
