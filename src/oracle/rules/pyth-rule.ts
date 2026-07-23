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
import { resolveCorePythInfra } from "../pyth.ts";

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
      // ALWAYS the Core pyth state — a property of the deployed RULE, not of
      // the client's infra selection: the on-chain pyth_rule package is
      // compiled against the Core pyth dependency, so its `&PythState`
      // parameter is the Core-package-qualified type. Passing the
      // infra-selected `host.pyth.state_id` here was correct only by
      // coincidence under 'core' — under 'pro' it aborted EVERY tx-build with
      // CommandArgumentError{arg 3, TypeMismatch} (mainnet, 2026-07-22). The
      // config's price_info_object entries are Core objects to match.
      // resolveCorePythInfra keeps the whole pyth_rule path (this feed leg
      // AND the update leg in pyth.ts) on the same Core infra, while still
      // honoring a config-supplied Core override under 'core'.
      pythState: tx.object(resolveCorePythInfra(host).state_id),
      pythPriceInfo: tx.object(priceInfoObjectId),
    },
  })(tx);
}
