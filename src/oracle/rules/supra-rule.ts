/**
 * `supra_rule::feed` — feed Supra as a second weighted rule on the same
 * `PriceCollector` as Pyth, before `aggregate`.
 *
 * `maybeFeedSupra` is a no-op unless the deployment has supra enabled + wired
 * (see {@link OracleHost.getSupraRule}), so Pyth-only deployments are unchanged.
 * On-chain the rule abstains for symbols it has no pair for.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { feed as supraRuleFeed } from "../../generated/waterx_supra_rule/supra_rule.ts";
import type { OracleHost } from "../host.ts";

export function maybeFeedSupra(
  tx: Transaction,
  host: OracleHost,
  collector: TransactionArgument,
): void {
  const supra = host.getSupraRule();
  if (!supra) return;
  supraRuleFeed({
    package: supra.published_at,
    arguments: {
      collector,
      config: tx.object(supra.config),
      oracleHolder: tx.object(supra.oracle_holder),
    },
  })(tx);
}
