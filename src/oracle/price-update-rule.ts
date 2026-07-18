/**
 * `PriceUpdateRule` — the strategy port for one oracle rule generation: fetch
 * its off-chain update payload and emit the PTB calls that verify/push that
 * update on-chain (e.g. Pyth's wormhole-verify + price-feed-update block).
 * Feeding the refreshed price into an oracle `PriceCollector` is a separate
 * step that stays in `aggregate.ts` — this port covers fetch + verify/push
 * only (`buildUpdateCalls` may hand the feed step a PTB value via
 * {@link RuleUpdateHandle}). Implementations: `PythCoreRule` (Hermes VAA) and
 * `PythLazerRule` (Lazer signed updates), with `WaterxRule` (ed25519) to
 * follow. `ConstantRule` and `SupraRule` do NOT implement this port — they
 * remain plain collector-feed helpers wired directly into `aggregate.ts`.
 *
 * This file defines the port only — routing IS wired: `aggregate.ts`'s
 * `refreshOraclePrices` selects the concrete rule per `host.oracleSource` via
 * `rule-registry.ts`, then drives fetch + `buildUpdateCalls` through this
 * port; `aggregate.ts` stays the sole orchestrator.
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
 * Shared null → kind → shape guard ladder for a `PriceUpdateRule.buildUpdateCalls`
 * payload — every rule's `buildUpdateCalls` needs the exact same three checks,
 * in the exact same order, before it can trust `data.payload`:
 *
 * 1. `data === null` passes straight through as `null` — the no-op case (an
 *    empty ticker list upstream produced nothing to build).
 * 2. `data.kind !== kind` throws BEFORE the shape check runs. This order is
 *    load-bearing, not stylistic: two rules' payloads can share an identical
 *    shape (e.g. Pyth Core's `{ updates, feedIds }` also satisfies a
 *    hypothetical same-shaped rule), so checking shape first would let a
 *    wrong-kind payload silently pass as this rule's own.
 * 3. `!isShape(data.payload)` throws for a same-`kind` payload whose shape
 *    doesn't match this rule's own (e.g. a hand-built test double).
 *
 * Returns `data.payload` narrowed to `T` once both checks pass.
 *
 * @param data - The `RuleUpdateData` handed to `buildUpdateCalls`.
 * @param kind - This rule's own {@link PriceUpdateRuleKind} — the only `kind`
 *   `data` may carry past step 2.
 * @param isShape - Type predicate narrowing `data.payload` to `T`.
 * @param shapeDescription - Human-readable shape, quoted verbatim into the
 *   shape-mismatch error (e.g. `"{ updates: Uint8Array[]; feedIds: string[] }"`).
 */
export function assertRuleUpdateData<T>(
  data: RuleUpdateData,
  kind: PriceUpdateRuleKind,
  isShape: (payload: unknown) => payload is T,
  shapeDescription: string,
): T | null {
  if (!data) return null;
  if (data.kind !== kind) {
    throw new Error(
      `assertRuleUpdateData: received a payload of kind '${data.kind}', expected '${kind}'`,
    );
  }
  if (!isShape(data.payload)) {
    throw new Error(
      `assertRuleUpdateData: received a '${kind}' payload with an unexpected shape ` +
        `(expected ${shapeDescription})`,
    );
  }
  return data.payload;
}

/**
 * PTB value handle a rule's {@link PriceUpdateRule.buildUpdateCalls} may
 * return when its collector-feed leg needs a value produced by the update leg
 * *within the same PTB*. Pyth Core needs none (its feed leg reads the shared
 * `PriceInfoObject` the update leg refreshed), so it returns `void`. The Lazer
 * rule returns the verified `pyth_lazer::update::Update` result — one
 * signature verification covers every feed in the payload, and
 * `pyth_lazer_rule::feed` takes it by reference per ticker (see
 * `aggregateTicker`'s `lazerUpdate` arg).
 */
export type RuleUpdateHandle = {
  readonly kind: "pyth_lazer_rule";
  /** Result of `pyth_lazer::parse_and_verify_le_ecdsa_update` in this PTB. */
  readonly update: TransactionArgument;
};

/**
 * Options for {@link PriceUpdateRule.buildUpdateCalls}. Mirrors the existing
 * `buildPythPriceUpdateCalls` / `updatePythPrices` parameter shapes in
 * `./pyth.ts` — `cache` shares on-chain Pyth state reads across builders,
 * `sponsorFund` draws the per-feed update fee from an open sponsor pool
 * instead of `tx.gas` (see `./rules/sponsor.ts`), `allowGasFee` explicitly
 * opts into the `tx.gas` fallback when no `sponsorFund` is available — see
 * `OracleFeeSourceUnavailable` in `./pyth.ts`. All three fields are
 * Pyth-Core-specific mechanics; `refreshOraclePrices` passes the same
 * `BuildUpdateOpts` to every rule uniformly, so a non-Pyth-Core rule (e.g.
 * `PythLazerRule`, which charges no update fee) simply ignores whichever
 * fields it has no use for.
 */
export interface BuildUpdateOpts {
  readonly cache?: PythCache;
  readonly sponsorFund?: { fund: TransactionArgument; packageId: string };
  readonly allowGasFee?: boolean;
}

/**
 * Injectable update-data cache seam for `refreshOraclePrices` (`aggregate.ts`).
 * A BE consumer (e.g. a prefetch cache that polls Hermes/Lazer out-of-band and
 * keeps a hot in-memory/Redis entry per source) implements this and passes it
 * as `refreshOraclePrices`'s `updateDataProvider` opt; the SDK itself never
 * implements one. `get` is checked before the rule's own live
 * `fetchUpdateData` for that group of tickers — a `null` return means "no
 * cached data, fetch live" (mirrors {@link RuleUpdateData}'s own `null`
 * variant: there is no separate signal for "the cache legitimately has
 * nothing" vs "go fetch live", they're the same instruction to the caller).
 */
export interface UpdateDataProvider {
  get(source: OracleSource, tickers: string[]): Promise<RuleUpdateData | null>;
}

export interface PriceUpdateRule {
  readonly kind: PriceUpdateRuleKind;

  /**
   * `true` when this rule's on-chain update leg charges a per-update fee
   * that must be paid from either a sponsor fund or `tx.gas` (Pyth Core:
   * `true`, via `pyth::update_single_price_feed`'s `base_update_fee`).
   * `false` for a fee-free update leg (Lazer: signature verification only,
   * no `Coin` argument). `refreshOraclePrices` (`aggregate.ts`) reads this
   * BEFORE fetching any group's off-chain payload — for every group whose
   * rule sets it `true`, a `sponsorFund` or `allowGasFee` must already be
   * available, or the whole call throws `OracleFeeSourceUnavailable` before
   * any group builds (mixed-shape atomicity: a fee-free group ordered
   * ahead of a fee-charging one in the same PTB must never get to mutate
   * `tx` while the fee-charging group is left unpayable). A referential
   * check against a specific rule instance (e.g. `=== PythCoreRule`) would
   * silently stop protecting a future fee-charging rule, or a test double
   * standing in for one — this field is the honest, extensible signal.
   */
  readonly requiresFeeSource: boolean;

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

  /**
   * Emit verify/update moveCalls + any per-rule setup into the PTB. Returns a
   * {@link RuleUpdateHandle} when the rule's collector-feed leg needs a PTB
   * value from this step (Lazer's verified `Update`); rules whose feed leg
   * reads shared on-chain objects return `void`.
   */
  buildUpdateCalls(
    tx: Transaction,
    host: OracleHost,
    data: RuleUpdateData,
    tickers: string[],
    opts?: BuildUpdateOpts,
  ): Promise<RuleUpdateHandle | void> | RuleUpdateHandle | void;
}
