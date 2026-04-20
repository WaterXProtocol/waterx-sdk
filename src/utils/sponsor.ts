import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import { reimburse as pythSponsorReimburseCall } from "../generated/pyth_sponsor_rule/pyth_sponsor_rule.ts";

/**
 * Reimburses the sponsor fund by adding the `PythSponsorRule` witness to
 * a `TradingRequest` and returning leftover balance to the `PythSponsor` pool.
 * No-op if `sponsorFund` is undefined.
 */
export function reimburseSponsorFund(
  client: WaterXClient,
  tx: Transaction,
  sponsorFund: TransactionArgument | undefined,
  tradingRequest: TransactionArgument,
  collateralTokenType: string,
): void {
  if (!sponsorFund) return;
  const cfg = client.config;
  pythSponsorReimburseCall({
    package: cfg.pythSponsorRulePackageId!,
    arguments: {
      self: cfg.pythSponsorId!,
      fund: sponsorFund,
      tradingReq: tradingRequest,
    },
    typeArguments: [collateralTokenType],
  })(tx);
}
