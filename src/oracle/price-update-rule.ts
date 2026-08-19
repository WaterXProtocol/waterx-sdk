/**
 * `PriceUpdateRule` — the strategy port for one oracle rule generation: fetch
 * its off-chain update payload and emit the PTB calls that verify/push that
 * update on-chain (e.g. Lazer's single signature-verify step). Feeding the
 * refreshed price into an oracle `PriceCollector` is a separate step that
 * stays in `aggregate.ts` — this port covers fetch + verify/push only
 * (`buildUpdateCalls` may hand the feed step a PTB value via
 * {@link RuleUpdateHandle}). Implementations: `PythLazerRule` (Lazer signed
 * updates) and `WaterxRule` (quote-center ed25519). `ConstantRule` and
 * `SupraRule` do NOT implement this port — they remain plain collector-feed
 * helpers wired directly into `aggregate.ts`.
 *
 * This file defines the port only — routing IS wired: `aggregate.ts`'s
 * `refreshOraclePrices` resolves a concrete rule per `host.oracleSources`
 * entry via `rule-registry.ts`, then drives fetch + `buildUpdateCalls`
 * through this port; `aggregate.ts` stays the sole orchestrator.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { OracleHost } from "./host.ts";

export type PriceUpdateRuleKind =
  | "pyth_lazer_rule"
  | "supra_rule"
  | "constant_rule"
  | "waterx_rule";

/**
 * The canonical list of selectable oracle sources — the SINGLE authority the
 * {@link OracleSource} union derives from (the value-list→union derive
 * idiom of `unified-client.ts`'s `NON_CLIENT_FIRST`, plus `Object.freeze`
 * so the immutability is RUNTIME truth: `as const` alone would let a JS
 * consumer push into the array and desync the membership Set built from it
 * in `source-list.ts`). Runtime membership checks and the `ORACLE_SOURCE`
 * env parser live there, on `isOracleSource` / `parseOracleSourceList`.
 * Only sources belong here: `supra_rule` and `constant_rule` are auxiliary
 * rules fed alongside whichever sources are selected (see
 * `aggregateTicker`), not sources themselves — the `satisfies` keeps
 * entries inside `PriceUpdateRuleKind` but adding an auxiliary rule to this
 * list is an (incorrect) editorial decision this comment exists to prevent.
 *
 * `pyth_rule` (Pyth Core, Hermes VAA) was RETIRED in 5.0.0 — it is no longer
 * a `PriceUpdateRuleKind` at all; `parseOracleSourceList` names the
 * retirement when an env string still carries it.
 */
export const ORACLE_SOURCES = Object.freeze([
  "pyth_lazer_rule",
  "waterx_rule",
] as const satisfies readonly PriceUpdateRuleKind[]);

/**
 * The kinds listable in a client's `oracleSource` create option (see
 * `OracleHost.oracleSources`) — i.e. rules that can serve as the on-chain
 * price *update* leg `refreshOraclePrices` runs before aggregating. Derived
 * from {@link ORACLE_SOURCES}. The SDK never reads `process.env` — consumers
 * resolve their own env var to this type.
 */
export type OracleSource = (typeof ORACLE_SOURCES)[number];

/**
 * Off-chain payload fetched by a rule, tagged by `kind` so a caller holding
 * several rules' results can tell them apart. `payload` is `unknown` here —
 * each rule implementation narrows it to its own shape (e.g. `PythLazerRule`'s
 * `{ update: Uint8Array; feedIds: number[] }`). `null` for rules with no
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
 *    shape, so checking shape first would let a wrong-kind payload silently
 *    pass as this rule's own.
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
 *   shape-mismatch error (e.g. `"{ update: Uint8Array; feedIds: number[] }"`).
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
 * *within the same PTB*. The Lazer rule returns the verified-update result of
 * its network's verify entry — one signature verification covers every feed
 * in the payload, and `pyth_lazer_rule::feed` takes it by reference per
 * ticker (see `aggregateTicker`'s `lazerUpdate` arg). `WaterxRule` needs none
 * (its verify+feed is bundled into the per-ticker collect call), so it
 * returns `void`.
 */
export type RuleUpdateHandle = {
  readonly kind: "pyth_lazer_rule";
  /**
   * Opaque result of this network's `LAZER_INFRA.verify_entry` in this PTB,
   * passed straight to `pyth_lazer_rule::feed`. The Move type is
   * network-dependent and never named here: mainnet's
   * `pyth_lazer::parse_and_verify_le_ecdsa_update_v2` yields
   * `pyth_lazer::update_v2::Update`, testnet's v1
   * `…_le_ecdsa_update` yields `pyth_lazer::update::Update`, and each
   * network's `pyth_lazer_rule` is published bound to the matching one.
   */
  readonly update: TransactionArgument;
};

/**
 * Options for {@link PriceUpdateRule.buildUpdateCalls}. Currently EMPTY — the
 * Pyth-Core-specific `cache` / `feeSource` fields died with the `pyth_rule`
 * retirement (5.0.0): neither remaining rule reads any on-chain state before
 * building nor charges an update fee. The parameter (and this named type)
 * stay on the port so a future rule that needs per-build options has a seam
 * to grow into without re-touching every implementation's signature.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberate empty extension point (see doc above)
export interface BuildUpdateOpts {}

/**
 * Injectable update-data cache seam for `refreshOraclePrices` (`aggregate.ts`).
 * A BE consumer (e.g. a prefetch cache that polls Lazer/quote-center
 * out-of-band and keeps a hot in-memory/Redis entry per source) implements
 * this and passes it as `refreshOraclePrices`'s `updateDataProvider` opt; the
 * SDK itself never implements one. `get` is checked before the rule's own live
 * `fetchUpdateData` for that group of tickers — a `null` return means "no
 * cached data, fetch live" (mirrors {@link RuleUpdateData}'s own `null`
 * variant: there is no separate signal for "the cache legitimately has
 * nothing" vs "go fetch live", they're the same instruction to the caller).
 *
 * A non-null hit MAY be a payload for a WIDER ticker set than `tickers` — a
 * provider is free to cache one whole-universe payload per source and return
 * it verbatim; `refreshOraclePrices` narrows it down to exactly the requested
 * tickers via the rule's {@link PriceUpdateRule.narrowUpdateData} before use,
 * so an implementer need not (and should not) subset it by hand. The only
 * hard requirement on a hit is that its `kind` matches the requested
 * `source`'s rule — a mismatch is a routing bug and throws.
 */
export interface UpdateDataProvider {
  get(source: OracleSource, tickers: string[]): Promise<RuleUpdateData | null>;
}

/** The credential kinds a rule can declare via {@link PriceUpdateRule.requiredCredential}. */
export type OracleCredentialKind = "pyth_api_key";

/**
 * Caller-supplied credential values keyed BY {@link OracleCredentialKind} —
 * the one shape both enforcement points check against, so neither has to
 * branch on the kind. `refreshOraclePrices` builds it from a live
 * `OracleHost` ({@link oracleCredentialsFromHost}); `missingOracleCredentials`
 * builds it from a consumer's raw env values. Adding a kind means extending
 * the union above plus those two adapters — never an `if` chain at a check
 * site.
 */
export type OracleCredentials = Partial<Record<OracleCredentialKind, string>>;

/** The credentials a live client carries, in {@link OracleCredentials} shape. */
export function oracleCredentialsFromHost(host: OracleHost): OracleCredentials {
  return { pyth_api_key: host.pyth.api_key };
}

export interface PriceUpdateRule {
  /**
   * `OracleSource`, not the wider `PriceUpdateRuleKind`: only selectable
   * sources implement this port (`supra_rule`/`constant_rule` are plain
   * collector-feed helpers), and the narrower type is what lets
   * `refreshOraclePrices`'s per-source carry step switch exhaustively —
   * adding a source without deciding its carry becomes a compile error.
   */
  readonly kind: OracleSource;

  /**
   * The caller-supplied credential this rule's `fetchUpdateData` cannot run
   * without, or absent for a credential-free rule. `PythLazerRule` sets
   * `"pyth_api_key"` (Lazer is auth-first: `host.pyth.api_key` Bearer);
   * `WaterxRule` sets nothing (the quote-center read surface is public).
   *
   * Two consumers key off this instead of hardcoding per-rule knowledge:
   * `refreshOraclePrices`'s credential pre-check (`aggregate.ts` — a
   * non-empty group whose rule requires a key the host doesn't carry throws
   * BEFORE any fetch or PTB mutation) and `missingOracleCredentials`
   * (`validate.ts` — consumers' boot-time env asserts). Neither branches on
   * the kind: both resolve it through {@link OracleCredentials}.
   */
  readonly requiredCredential?: OracleCredentialKind;

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
   * Narrow a payload previously produced by {@link fetchUpdateData} — typically
   * for a superset of tickers (e.g. a consumer's whole-universe prefetch cache)
   * — down to exactly `tickers`, without any re-fetch. Each rule owns its
   * payload's divisibility semantics, so consumers must never subset a payload
   * themselves (that knowledge branching on `kind` in a consumer is exactly the
   * altitude violation this method removes):
   *
   * - A non-null result MUST be valid {@link buildUpdateCalls} input covering
   *   exactly `tickers` — a divisible payload (waterx's per-symbol leaves)
   *   returns a subset; an indivisible payload (Lazer's single signed message,
   *   waterx's batch envelope) returns the whole payload iff every requested
   *   ticker is covered.
   * - A ticker this payload cannot serve → `null` (miss), NEVER a silent
   *   partial. `null` mirrors {@link UpdateDataProvider.get}'s convention: the
   *   caller falls back to a live {@link fetchUpdateData} for those tickers.
   * - An empty `tickers` list → `null`, mirroring {@link fetchUpdateData}'s own
   *   empty-list convention (nothing to build); `data === null` → `null`.
   * - `data` must be this rule's own payload: kind/shape are enforced via
   *   {@link assertRuleUpdateData}, so a wrong-`kind` payload throws (a routing
   *   bug), it does not miss.
   */
  narrowUpdateData(host: OracleHost, data: RuleUpdateData, tickers: string[]): RuleUpdateData;

  /**
   * The per-symbol single-use identity of a payload's signed data, or `null`
   * when this rule's updates carry no replay-guarded identity (then the
   * method may also be absent entirely). This is the rule-owned key of the
   * on-chain F-014 replay guard: submitting the SAME identity twice for a
   * symbol is at best a paid-for abstain (the dual-rule collect entries) and
   * at worst an `EReplayedSignature` abort (the single-rule feed entries) —
   * so a consumer serving cached update data (e.g. a BE serve-at-most-once
   * cache) keys its guard off this map instead of re-implementing each
   * rule's payload anatomy.
   *
   * `WaterxRule`: leaves → `symbol → signed_timestamp_ms`; envelope →
   * `symbol → timestamp_ms` (per item; the envelope's one signing timestamp
   * is every covered symbol's identity). `PythLazerRule` does not implement
   * it — a Lazer verify is not identity-replay-guarded on-chain.
   */
  updateIdentityBySymbol?(data: RuleUpdateData): Map<string, bigint> | null;

  /**
   * Emit verify/update moveCalls + any per-rule setup into the PTB. Returns a
   * {@link RuleUpdateHandle} when the rule's collector-feed leg needs a PTB
   * value from this step (Lazer's verified `Update`); rules whose feed leg
   * needs nothing from it return `void`. Takes no `tickers` param —
   * every implementation derives everything it needs from `data.payload`
   * (the tickers a group covers were already fixed when `fetchUpdateData`
   * built that payload).
   */
  buildUpdateCalls(
    tx: Transaction,
    host: OracleHost,
    data: RuleUpdateData,
    opts?: BuildUpdateOpts,
  ): Promise<RuleUpdateHandle | void> | RuleUpdateHandle | void;
}
