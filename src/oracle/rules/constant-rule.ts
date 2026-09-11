/**
 * `constant_rule::feed` — feed a constant-pinned price into the collector. Used
 * for constant tickers ({@link OracleHost.isConstantTicker}); the price comes
 * from the on-chain `constant_rule::Config`, so no source update is needed for
 * a constant-only ticker.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { rulePackageId } from "../../config.ts";
import { feed as constantRuleFeed } from "../../generated/waterx_constant_rule/constant_rule.ts";
import type { OracleHost } from "../host.ts";

export function feedConstantRule(
  tx: Transaction,
  host: OracleHost,
  collector: TransactionArgument,
): void {
  const rule = host.config.oracle_rules.constant;
  constantRuleFeed({
    package: rulePackageId(host.config, rule),
    arguments: { collector, config: tx.object(rule.rule_config_object) },
  })(tx);
}
