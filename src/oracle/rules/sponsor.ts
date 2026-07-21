/**
 * `pyth_sponsor_rule` — pay Pyth update fees from a shared sponsor pool AND
 * attach the `PythSponsorRule` witness to a `TradingRequest`. Required when the
 * market's `request_checklist` contains `PythSponsorRule`.
 *
 * Flow: {@link openPythSponsorFund} opens a `Fund` hot potato; the caller wraps
 * the returned `{ fund, packageId }` into an `OracleFeeSource` (`{ kind:
 * 'sponsor', fund, packageId }`) and passes that to the Pyth update path (it
 * draws per-feed fees via `pyth_sponsor_rule::split`); then
 * {@link reimbursePythSponsor} consumes the `Fund`, returns leftover SUI, and
 * attaches the witness.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import {
  reimburse as sponsorReimburse,
  request as sponsorRequest,
} from "../../generated/pyth_sponsor_rule/pyth_sponsor_rule.ts";
import type { OracleHost } from "../host.ts";

/**
 * Opens a `Fund` hot potato from the shared PythSponsor pool. Wrap the
 * returned `{ fund, packageId }` into an `OracleFeeSource`
 * (`{ kind: 'sponsor', fund, packageId }`) and pass that to
 * `refreshOraclePrices` as `feeSource`, then {@link reimbursePythSponsor} once
 * the TradingRequest is built.
 */
export function openPythSponsorFund(
  tx: Transaction,
  host: OracleHost,
): { fund: TransactionArgument; packageId: string } {
  const entry = host.config.packages.pyth_sponsor_rule;
  if (!entry?.published_at || !entry.pyth_sponsor) {
    throw new Error(
      "pyth_sponsor_rule.{published_at,pyth_sponsor} missing — sponsor flow unavailable",
    );
  }
  const [fund] = sponsorRequest({
    package: entry.published_at,
    arguments: { self: tx.object(entry.pyth_sponsor) },
  })(tx);
  return { fund: fund as unknown as TransactionArgument, packageId: entry.published_at };
}

/**
 * Consumes the `Fund` hot potato from {@link openPythSponsorFund}, returns any
 * leftover SUI to the sponsor pool, and attaches the `PythSponsorRule` witness to
 * the given `TradingRequest<C_TOKEN>` so `trading::execute` can satisfy a
 * checklist that includes `PythSponsorRule`.
 */
export function reimbursePythSponsor(
  tx: Transaction,
  host: OracleHost,
  fund: TransactionArgument,
  tradingRequest: TransactionArgument,
  collateralType: string,
): void {
  const entry = host.config.packages.pyth_sponsor_rule;
  if (!entry?.published_at || !entry.pyth_sponsor) {
    throw new Error("pyth_sponsor_rule missing from config");
  }
  sponsorReimburse({
    package: entry.published_at,
    arguments: {
      self: tx.object(entry.pyth_sponsor),
      fund: fund as unknown as TransactionArgument,
      tradingReq: tradingRequest as unknown as TransactionArgument,
    },
    typeArguments: [collateralType],
  })(tx);
}
