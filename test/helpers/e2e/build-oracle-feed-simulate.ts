/**
 * Mirrors the internal `buildOracleFeed` in `src/tx-builders.ts` for simulate-only PTBs.
 * Pyth-only in v2 (Supra not wired in the current deployment).
 */
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../src/client.ts";
import { aggregate as aggregateCall } from "../../../src/generated/bucket_v2_oracle/aggregator.ts";
import { _new as collectorNewCall } from "../../../src/generated/bucket_v2_oracle/collector.ts";
import { feedPythRule } from "../../../src/utils/pyth.ts";

export function buildOracleFeedForSimulate(
  client: WaterXClient,
  tx: Transaction,
  tokenType: string,
  aggregatorId: string,
  priceInfoObjectId: string,
): TransactionArgument {
  const cfg = client.config;
  const oraclePkg = cfg.bucketOraclePackageId!;

  const [collector] = collectorNewCall({
    package: oraclePkg,
    typeArguments: [tokenType],
  })(tx);

  feedPythRule(tx, collector, {
    pythRulePackageId: cfg.pythRulePackageId!,
    pythRuleConfigId: cfg.pythRuleConfigId!,
    pythStateId: cfg.pythConfig!.pythStateId,
    tokenType,
    priceInfoObjectId,
  });

  const [priceResult] = aggregateCall({
    package: oraclePkg,
    arguments: { self: aggregatorId, collector },
    typeArguments: [tokenType],
  })(tx);

  return priceResult;
}
