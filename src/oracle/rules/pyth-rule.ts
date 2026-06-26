/**
 * `pyth_rule::feed` — feed a refreshed Pyth `PriceInfoObject` into an oracle
 * `PriceCollector`. The rule resolves the on-chain feed by ticker via its
 * `Config.identifier_map`, so it is not typed `<T>`.
 *
 * Caller must run the Pyth on-chain update first (see `../pyth.ts`) so the
 * `PriceInfoObject` is fresh.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { feed as pythRuleFeed } from "../../generated/waterx_pyth_rule/pyth_rule.ts";
import type { OracleHost } from "../host.ts";

export function feedPythRule(
  tx: Transaction,
  host: OracleHost,
  collector: TransactionArgument,
  priceInfoObjectId: string,
): void {
  pythRuleFeed({
    package: host.config.packages.pyth_rule.published_at,
    arguments: {
      collector,
      config: tx.object(host.config.packages.pyth_rule.config),
      pythState: tx.object(host.pyth.state_id),
      pythPriceInfo: tx.object(priceInfoObjectId),
    },
  })(tx);
}
