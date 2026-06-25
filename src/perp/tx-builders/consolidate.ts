/**
 * Consolidate parked backing assets → USD credit (pre-action sweep).
 *
 * Drains every backing asset (and address-owned CREDIT) parked at a wxa
 * account's address into spendable wxUSD, so the subsequent trading / WLP /
 * predict action can debit the internal slot. Empty buckets are skipped via
 * gRPC probes, so the sweep is safe to run on any account.
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { consumeDepositDirect } from "../../generated/waterx_account/direct_rule.ts";
import {
  probeAddressCreditBalance,
  probeParkedBackingAssets,
} from "../../utils/consolidate-balance.ts";
import type { PerpClient } from "../client.ts";
import { requestDepositFromFunds, requestDepositFromReceivings } from "../user/account.ts";
import { mintCreditFromRequest } from "../user/custody.ts";

/**
 * For every backing asset registered on `native_custody`, append two drain
 * legs to `tx`:
 *
 *   `requestDepositFromFunds<T>`      → `mintCreditFromRequest<T, USD>` → `consumeDepositDirect<USD>`
 *   `requestDepositFromReceivings<T>` → `mintCreditFromRequest<T, USD>` → `consumeDepositDirect<USD>`
 *
 * Empty legs are skipped — the on-chain `mint` rejects zero-amount deposits.
 * Returns the number of drain legs added (useful for logging / early-out).
 *
 * Silently no-ops when `native_custody` / `waterx_credit` aren't configured
 * for the loaded deployment.
 */
export async function appendConsolidateToUsd(
  client: PerpClient,
  tx: Transaction,
  accountId: string,
): Promise<number> {
  const parked = await probeParkedBackingAssets(client, accountId);
  let legs = 0;
  for (const row of parked) {
    if (row.fundsRaw > 0n) {
      const fromFunds = requestDepositFromFunds(client, tx, {
        accountId,
        coinType: row.assetType,
      });
      foldDepositRequestToUsd(client, tx, fromFunds, row.assetType);
      legs += 1;
    }

    if (row.coinsRaw > 0n) {
      const coins = (await client.listCoins({
        owner: accountId,
        coinType: row.assetType,
      })) as { objects?: { objectId?: string; version?: string; digest?: string }[] };
      const refs = (coins.objects ?? []).filter(
        (c): c is { objectId: string; version: string; digest: string } =>
          !!c.objectId && !!c.version && !!c.digest,
      );
      if (refs.length === 0) continue;
      const receivings = refs.map((c) =>
        tx.receivingRef({ objectId: c.objectId, version: c.version, digest: c.digest }),
      ) as unknown as TransactionArgument[];
      const fromReceivings = requestDepositFromReceivings(client, tx, {
        accountId,
        coinType: row.assetType,
        receivings,
      });
      foldDepositRequestToUsd(client, tx, fromReceivings, row.assetType);
      legs += 1;
    }
  }
  return legs;
}

/**
 * Drain CREDIT parked at `accountId`'s Sui address (funds accumulator +
 * owned `Coin<CREDIT>`) into the wxa internal slot via
 * `consumeDepositDirect<CREDIT>`. Complements {@link appendConsolidateToUsd}
 * for address-owned wxUSD that predict / perp actions debit from the internal
 * balance.
 */
export async function appendConsolidateAddressCredit(
  client: PerpClient,
  tx: Transaction,
  accountId: string,
): Promise<number> {
  if (!client.config.packages.waterx_credit?.credit_type) return 0;

  const creditType = client.creditType();
  const { fundsRaw, coinsRaw } = await probeAddressCreditBalance(client, accountId);
  let legs = 0;

  if (fundsRaw > 0n) {
    const fromFunds = requestDepositFromFunds(client, tx, {
      accountId,
      coinType: creditType,
    });
    consumeDepositRequest(client, tx, fromFunds, creditType);
    legs += 1;
  }

  if (coinsRaw > 0n) {
    const coins = (await client.listCoins({
      owner: accountId,
      coinType: creditType,
    })) as { objects?: { objectId?: string; version?: string; digest?: string }[] };
    const refs = (coins.objects ?? []).filter(
      (c): c is { objectId: string; version: string; digest: string } =>
        !!c.objectId && !!c.version && !!c.digest,
    );
    if (refs.length > 0) {
      const receivings = refs.map((c) =>
        tx.receivingRef({ objectId: c.objectId, version: c.version, digest: c.digest }),
      ) as unknown as TransactionArgument[];
      const fromReceivings = requestDepositFromReceivings(client, tx, {
        accountId,
        coinType: creditType,
        receivings,
      });
      consumeDepositRequest(client, tx, fromReceivings, creditType);
      legs += 1;
    }
  }

  return legs;
}

/**
 * Full pre-action sweep: backing assets → wxUSD credit (PSM) plus address
 * CREDIT → internal slot. Used by async tx-builders when `consolidateToUsd`
 * is enabled (default).
 */
export async function appendConsolidateForSpend(
  client: PerpClient,
  tx: Transaction,
  accountId: string,
): Promise<number> {
  const backingLegs = await appendConsolidateToUsd(client, tx, accountId);
  const creditLegs = await appendConsolidateAddressCredit(client, tx, accountId);
  return backingLegs + creditLegs;
}

function consumeDepositRequest(
  client: PerpClient,
  tx: Transaction,
  depositRequest: TransactionArgument,
  coinType: string,
): void {
  consumeDepositDirect({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      req: depositRequest as unknown as TransactionArgument,
    },
    typeArguments: [coinType],
  })(tx);
}

function foldDepositRequestToUsd(
  client: PerpClient,
  tx: Transaction,
  depositRequest: TransactionArgument,
  assetType: string,
): void {
  const usdReq = mintCreditFromRequest(client, tx, {
    depositRequest,
    assetType,
  });
  consumeDepositRequest(client, tx, usdReq as unknown as TransactionArgument, client.creditType());
}

/**
 * Standalone PTB that drains every backing asset parked at the account's
 * address into USD credit under the account — see {@link appendConsolidateToUsd}.
 *
 * Returns an empty `Transaction` when nothing is parked. Callers can
 * `client.simulate(tx)` to detect a no-op before submitting.
 */
export async function buildConsolidateToUsdTx(
  client: PerpClient,
  accountId: string,
  tx?: Transaction,
): Promise<Transaction> {
  const txOut = tx ?? new Transaction();
  await appendConsolidateToUsd(client, txOut, accountId);
  return txOut;
}
