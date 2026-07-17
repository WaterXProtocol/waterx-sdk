/**
 * `PriceUpdateRule` — the strategy port for one oracle rule generation: fetch
 * its off-chain update payload and emit the PTB calls that verify/push that
 * update on-chain (e.g. Pyth's wormhole-verify + price-feed-update block).
 * Feeding the refreshed price into an oracle `PriceCollector` is a separate
 * step that stays in `aggregate.ts` — this port covers fetch + verify/push
 * only. Implementations: `PythCoreRule` (Hermes VAA), `PythLazerRule` (Lazer
 * signed updates), `ConstantRule`, `SupraRule`, later `WaterxRule` (ed25519).
 *
 * This file defines the port only — no routing. `aggregate.ts` stays the sole
 * orchestrator until a later task wires rule selection through it.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { OracleHost } from "./host.ts";
import type { PythCache } from "./pyth.ts";

export type PriceUpdateRuleKind =
  | "pyth_rule"
  | "pyth_lazer_rule"
  | "supra_rule"
  | "constant_rule"
  | "waterx_rule";

/**
 * The subset of `PriceUpdateRuleKind`s selectable via a client's `oracleSource`
 * create option (see `OracleHost.oracleSource`) — i.e. rules that can serve as
 * the on-chain price *update* leg `refreshOraclePrices` runs before aggregating.
 * `supra_rule` and `constant_rule` are auxiliary rules fed alongside whichever
 * source is selected (see `aggregateTicker`), not sources themselves;
 * `waterx_rule` has no `PriceUpdateRule` implementation yet. The SDK never
 * reads `process.env` — consumers resolve their own env var to this type.
 */
export type OracleSource = "pyth_rule" | "pyth_lazer_rule";

/**
 * Off-chain payload fetched by a rule, tagged by `kind` so a caller holding
 * several rules' results can tell them apart. `payload` is `unknown` here —
 * each rule implementation narrows it to its own shape (e.g. `PythCoreRule`'s
 * `{ updates: Uint8Array[]; feedIds: string[] }`). `null` for rules with no
 * off-chain fetch (e.g. `ConstantRule`) or when there is nothing to fetch.
 */
export type RuleUpdateData = { kind: PriceUpdateRuleKind; payload: unknown } | null;

/**
 * Options for {@link PriceUpdateRule.buildUpdateCalls}. Mirrors the existing
 * `buildPythPriceUpdateCalls` / `updatePythPrices` parameter shapes in
 * `./pyth.ts` — `cache` shares on-chain Pyth state reads across builders,
 * `sponsorFund` draws the per-feed update fee from an open sponsor pool
 * instead of `tx.gas` (see `./rules/sponsor.ts`).
 */
export interface BuildUpdateOpts {
  readonly cache?: PythCache;
  readonly sponsorFund?: { fund: TransactionArgument; packageId: string };
}

export interface PriceUpdateRule {
  readonly kind: PriceUpdateRuleKind;

  /** Tickers this rule can serve in this environment (from config feeds + enabled). */
  supportedTickers(host: OracleHost): string[];

  /**
   * Fetch the off-chain payload for these tickers (no-op rules return null).
   * `tickers` must already be a subset of {@link supportedTickers} — an
   * unsupported ticker's feed lookup throws and that throw propagates
   * uncaught; callers pre-filter via `supportedTickers`, this method does not
   * re-validate.
   */
  fetchUpdateData(host: OracleHost, tickers: string[]): Promise<RuleUpdateData>;

  /** Emit verify/update moveCalls + any per-rule setup into the PTB. */
  buildUpdateCalls(
    tx: Transaction,
    host: OracleHost,
    data: RuleUpdateData,
    tickers: string[],
    opts?: BuildUpdateOpts,
  ): Promise<void> | void;
}
