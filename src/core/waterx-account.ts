/**
 * Shared `waterx_account` PTB builders.
 *
 * Perp and prediction both create/operate accounts through the **same** on-chain
 * `waterx_account` system (same package + `AccountRegistry`), so the actual PTB
 * calls are assembled here once. Each product line resolves the deployment
 * coordinates (`WxaAccountRef`) and builds its own `senderRequest` (via its own
 * account-request helper), then delegates the moveCall to these functions.
 *
 * These builders are raw `tx.moveCall(...)` (no generated-bindings dependency),
 * so the module is shared by both `src/user/account.ts` (perp) and
 * `src/prediction/account.ts` (prediction) without coupling to either line's
 * generated code.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

/** Resolved `waterx_account` deployment coordinates (each line resolves these from its own client). */
export interface WxaAccountRef {
  /** `waterx_account` package id (`published_at`). */
  packageId: string;
  /** `AccountRegistry` shared-object id. */
  registry: string;
}

/**
 * `waterx_account::account::create_account`. Returns the new account id
 * (Move return value). `senderRequest` is the `account::request` hot-potato the
 * caller built with its own account-request helper.
 */
export function createAccountCall(
  tx: Transaction,
  ref: WxaAccountRef,
  params: { senderRequest: TransactionArgument; alias: string },
): TransactionArgument {
  const [accountId] = tx.moveCall({
    target: `${ref.packageId}::account::create_account`,
    arguments: [tx.object(ref.registry), params.senderRequest, tx.pure.string(params.alias)],
  });
  return accountId;
}
