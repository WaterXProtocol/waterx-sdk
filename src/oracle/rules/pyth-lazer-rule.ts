/**
 * `PythLazerRule` — `PriceUpdateRule` for Pyth Lazer (Pyth Pro) signed
 * updates, plus `feedLazerRule`, the collector-feed leg `aggregateTicker`
 * appends per lazer-routed ticker. Fetches one `leEcdsa` payload for all
 * requested integer feed ids from the Lazer HTTP API (Bearer-authenticated
 * via the `pythApiKey` create option), verifies it ONCE on-chain via
 * `pyth_lazer`'s verify entry for that network (see `LAZER_INFRA`), and hands the
 * resulting `Update` PTB value back through a `RuleUpdateHandle` for the feed
 * calls.
 */

import { fromHex } from "@mysten/bcs";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { Network } from "../../constants.ts";
import type { PythFetchPolicy, PythLazerRulePackage } from "../config.ts";
import type { OracleHost } from "../host.ts";
import {
  assertRuleUpdateData,
  type BuildUpdateOpts,
  type PriceUpdateRule,
  type RuleUpdateData,
  type RuleUpdateHandle,
} from "../price-update-rule.ts";
import { fetchWithPolicy, joinEndpointPath, rethrowExhaustedFetch } from "../update-fetch.ts";

/**
 * Pyth Lazer (Pyth Pro) external infra — owned by THIS source, by network.
 * Per-network constants for infrastructure Pyth operates (not part of the
 * `waterx-config` JSON), co-located with the only rule that reads them —
 * no other oracle source ever touches a Lazer endpoint or verifier.
 *
 * - `endpoint` — Lazer HTTP API base; signed updates come from
 *   `POST /v1/latest_price` (Bearer-authenticated). The service is
 *   network-agnostic (one signed payload verifies on any chain that trusts the
 *   Lazer signers), so both networks share the production host.
 * - `verifier_package` / `verify_entry` — the Sui package carrying the verify
 *   call, and which entry to call. These track what `pyth_lazer_rule` binds on
 *   that network, so they move together:
 *   - **mainnet** — the v2 package `0xefbfd064…` and the **v2** entry. The rule
 *     was republished v2-bound after a 2026-08-05 mainnet probe: the ORIGINAL
 *     package `0x7b502c…` now aborts `EDifferentVersion` (`state::current_cap`)
 *     for any payload — the shared `State` has been migrated past that code —
 *     and its v1 entry aborts `EInvalidChannel` on `fixed_rate@1000ms`, the only
 *     channel WaterX's Pyth Pro grant permits.
 *   - **testnet** — still the original v1 publish, which has no `update_v2`
 *     module at all, so the v1 entry is the only one that exists there.
 *   Both entries take `(state, clock, bytes)` and accept the same `leEcdsa`
 *   payload. Values mirror the contract repo's `pyth_lazer_rule/Move.toml`
 *   published-at pins.
 */
export const LAZER_INFRA: Record<
  Network,
  { endpoint: string; verifier_package: string; verify_entry: LazerVerifyEntry; channel: string }
> = {
  MAINNET: {
    endpoint: "https://pyth-lazer.dourolabs.app",
    verifier_package: "0xefbfd064480777699fd9c557a5804d72ace7bc82661fdc8d1f1a44ea6d92ee10",
    verify_entry: "parse_and_verify_le_ecdsa_update_v2",
    channel: "fixed_rate@1000ms",
  },
  TESTNET: {
    endpoint: "https://pyth-lazer.dourolabs.app",
    verifier_package: "0xf5bd2141967507050a91b58de3d95e77c432cd90d1799ee46effc27430a68c21",
    verify_entry: "parse_and_verify_le_ecdsa_update",
    channel: "fixed_rate@200ms",
  },
};

/**
 * The `pyth_lazer` verify entry a network's deployed rule consumes. `_v2`
 * returns `update_v2::Update`; the v1 entry returns `update::Update`, and the
 * two are NOT interchangeable — the rule's `feed` takes one concrete type.
 */
export type LazerVerifyEntry =
  | "parse_and_verify_le_ecdsa_update"
  | "parse_and_verify_le_ecdsa_update_v2";

/** `pyth_lazer_rule`'s narrowed `RuleUpdateData.payload` shape. */
export interface PythLazerUpdatePayload {
  /** One signed `leEcdsa` message carrying every requested feed. */
  readonly update: Uint8Array;
  /** Integer Lazer feed ids the update was requested for (debug/audit trail). */
  readonly feedIds: number[];
}

/**
 * Signed-update request pins, mirroring what the on-chain rule consumes:
 * - `properties` — `price` + `exponent` are REQUIRED by
 *   `pyth_lazer_rule::price_or_abstain` (a missing exponent abstains);
 *   `confidence` is optional on-chain but requested so the rule's
 *   fail-closed confidence gate actually engages (a payload without
 *   confidence passes the gate unchecked).
 * - `channel` — `fixed_rate@200ms`, NOT `real_time`: Lazer rejects a request
 *   whose channel is faster than ANY requested feed's `min_channel`, and it
 *   rejects the WHOLE batch (`400 Feeds do not support channel …`). Only the
 *   majors (BTC/ETH/SOL/USDC/DOGE/XRP/BNB/HYPE + EUR/JPY FX) publish
 *   `real_time`; the other 19 of the 29 configured feeds — including SUIUSD
 *   and every xStock — are `min_channel: fixed_rate@200ms` (Lazer symbol
 *   registry, verified 2026-07-22: the same 29-feed batch 400s at
 *   `real_time`/`50ms` and serves 200 with the leEcdsa blob at `200ms`).
 *   The channel is therefore per-network (`LAZER_INFRA[network].channel`), and
 *   it is bounded from BOTH sides — by what the feeds publish and by what the
 *   grant allows:
 *   - **mainnet: `fixed_rate@1000ms`.** WaterX's Pyth Pro grant no longer
 *     permits anything faster ("Channel fixed_rate@200ms violates rate limit.
 *     Minimum allowed channel is 1000ms", measured 2026-08-05), and the
 *     mainnet rule is v2-bound, so it accepts that channel.
 *   - **testnet: `fixed_rate@200ms`.** Its rule is still v1-bound, and the v1
 *     on-chain `channel::from_u8` aborts on the 1000ms channel.
 * - `formats: leEcdsa` + `jsonBinaryEncoding: hex` — the Sui verifier takes
 *   the `leEcdsa` framing; hex matches `fromHex` below.
 */
const LAZER_LATEST_PRICE_REQUEST = {
  properties: ["price", "exponent", "confidence"],
  formats: ["leEcdsa"],
  jsonBinaryEncoding: "hex",
} as const;

/**
 * Shape check ONLY — the `kind` discriminant is checked separately by the
 * caller before this runs (mirrors `PythCoreRule`'s guard split), so a
 * same-shaped payload from a different rule can never silently pass.
 */
function isPythLazerUpdatePayloadShape(payload: unknown): payload is PythLazerUpdatePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { update?: unknown }).update instanceof Uint8Array &&
    Array.isArray((payload as { feedIds?: unknown }).feedIds)
  );
}

/**
 * Thrown by {@link PythLazerRule.fetchUpdateData} when `pyth_lazer_rule` is
 * deployed in config but no `pythApiKey` was supplied at client init — the
 * Lazer HTTP API requires a Bearer token and the SDK never reads
 * `process.env` to find one. `instanceof`-able (mirrors
 * `OracleFeeSourceUnavailableError` in `pyth.ts`) so a consumer can branch on
 * the failure type directly instead of string-matching `error.message`.
 */
export class LazerApiKeyMissingError extends Error {
  constructor() {
    super(
      "LazerApiKeyMissing: pyth_lazer_rule requires a Pyth Lazer access token — " +
        "pass `pythApiKey` when creating the client (the SDK never reads process.env)",
    );
    this.name = "LazerApiKeyMissingError";
  }
}

/** The `pyth_lazer_rule` deployment entry; throws when the config carries none. */
function requireLazerPackage(host: OracleHost): PythLazerRulePackage {
  const entry = host.config.packages.pyth_lazer_rule;
  if (!entry) {
    throw new Error("pyth_lazer_rule package is not deployed in this config");
  }
  return entry;
}

/**
 * Fetch one signed `leEcdsa` update for `feedIds` from the Lazer HTTP API.
 * Goes through the shared `fetchWithPolicy` (`../update-fetch.ts`) — same
 * retry/timeout/Bearer policy as `fetchPriceFeedsUpdateData`, unified so
 * both oracle sources fail the same way under upstream degradation.
 */
async function fetchLazerSignedUpdate(
  endpoint: string,
  channel: string,
  apiKey: string,
  feedIds: number[],
  fetchOpts?: PythFetchPolicy,
): Promise<Uint8Array> {
  // joinEndpointPath preserves any base path on the endpoint — the same
  // leading-slash `new URL` footgun that 404'd every feed on the Pyth Pro
  // Hermes endpoint (see update-fetch.ts). Defensive here: the default
  // Lazer endpoint has no base path, but a config override may.
  const url = joinEndpointPath(endpoint, "v1/latest_price");
  let res: Response;
  try {
    res = await fetchWithPolicy(
      url.toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceFeedIds: feedIds, ...LAZER_LATEST_PRICE_REQUEST, channel }),
      },
      { apiKey, ...fetchOpts },
    );
  } catch (err) {
    rethrowExhaustedFetch(
      err,
      (e) => `Lazer price fetch failed: ${e.status}${e.bodySnippet ? ` ${e.bodySnippet}` : ""}`,
    );
  }
  if (!res.ok) throw new Error(`Lazer price fetch failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { leEcdsa?: { data?: string } };
  const hex = json.leEcdsa?.data;
  if (typeof hex !== "string" || hex.length === 0) {
    throw new Error("Lazer returned no leEcdsa update data");
  }
  return fromHex(hex);
}

/**
 * `pyth_lazer_rule::feed(collector, config, clock, &update)` — contribute the
 * verified Lazer price for `collector.symbol()` to the collector. `update` is
 * the `RuleUpdateHandle` value from {@link PythLazerRule.buildUpdateCalls} in
 * the SAME PTB; one verified update serves every ticker's feed call. On-chain
 * the rule abstains (records `none`) instead of aborting when the symbol is
 * unconfigured, the feed is absent from the update, the value is degenerate,
 * or the Lazer timestamp is stale.
 */
export function feedLazerRule(
  tx: Transaction,
  host: OracleHost,
  collector: TransactionArgument,
  update: TransactionArgument,
): void {
  const lazer = requireLazerPackage(host);
  tx.moveCall({
    target: `${lazer.published_at}::pyth_lazer_rule::feed`,
    arguments: [collector, tx.object(lazer.config), tx.object.clock(), update],
  });
}

export const PythLazerRule: PriceUpdateRule = {
  kind: "pyth_lazer_rule",

  // Verification is a flat signature check with no Coin argument — no
  // update fee — see `PriceUpdateRule.requiresFeeSource`.
  requiresFeeSource: false,

  /** Tickers with a `pyth_lazer_rule.feeds` entry (integer Lazer feed ids). */
  supportedTickers(host: OracleHost): string[] {
    return Object.keys(host.config.packages.pyth_lazer_rule?.feeds ?? {});
  },

  /** Resolves integer feed ids for `tickers`, then fetches one signed `leEcdsa` update. */
  async fetchUpdateData(host: OracleHost, tickers: string[]): Promise<RuleUpdateData> {
    if (tickers.length === 0) return null;
    // Package-level check first: a config without the deployment must say so,
    // not fail per ticker as if only that feed were missing.
    const { feeds } = requireLazerPackage(host);
    const feedIds = tickers.map((ticker) => {
      const feedId = feeds[ticker];
      if (feedId === undefined) {
        throw new Error(`No pyth_lazer_rule feed listed for ticker: ${ticker}`);
      }
      return feedId;
    });
    const apiKey = host.pyth.api_key;
    if (!apiKey) {
      throw new LazerApiKeyMissingError();
    }
    const update = await fetchLazerSignedUpdate(
      LAZER_INFRA[host.network].endpoint,
      LAZER_INFRA[host.network].channel,
      apiKey,
      feedIds,
      host.pyth.fetch,
    );
    return { kind: "pyth_lazer_rule", payload: { update, feedIds } };
  },

  /**
   * A Lazer payload is ONE signed `leEcdsa` message covering every feed it was
   * fetched for — verification is a single flat signature check over the whole
   * message (one `parse_and_verify_le_ecdsa_update*` call, no per-feed cost), so the
   * payload is indivisible: it can only be served whole. Returns the whole
   * payload iff every requested ticker's integer feed id is packed in THIS
   * payload's `feedIds`; any coverage gap (unlisted ticker, or a feed this
   * payload does not carry) → `null` (miss), never a silent partial.
   */
  narrowUpdateData(host: OracleHost, data: RuleUpdateData, tickers: string[]): RuleUpdateData {
    const payload = assertRuleUpdateData(
      data,
      "pyth_lazer_rule",
      isPythLazerUpdatePayloadShape,
      "{ update: Uint8Array; feedIds: number[] }",
    );
    if (!payload || tickers.length === 0) return null;
    const packedFeedIds = new Set(payload.feedIds);
    for (const ticker of tickers) {
      const feedId = host.config.packages.pyth_lazer_rule?.feeds?.[ticker];
      if (feedId === undefined || !packedFeedIds.has(feedId)) return null;
    }
    return { kind: "pyth_lazer_rule", payload };
  },

  /**
   * Appends the single `parse_and_verify_le_ecdsa_update*(state, clock, bytes)`
   * call — one secp256k1 signature check covering every feed in the payload —
   * and returns its `Update` result as the handle the per-ticker feed leg
   * consumes. `opts.cache` / `opts.feeSource` are Pyth-Core-specific and
   * ignored (Lazer verification charges no update fee).
   *
   * The entry name comes from `LAZER_INFRA[network].verify_entry`: mainnet's
   * rule binds `update_v2`, testnet's is still the v1 publish. Both take
   * `(state, clock, bytes)` and accept the same `leEcdsa` payload.
   */
  buildUpdateCalls(
    tx: Transaction,
    host: OracleHost,
    data: RuleUpdateData,
    _opts?: BuildUpdateOpts,
  ): RuleUpdateHandle | undefined {
    const payload = assertRuleUpdateData(
      data,
      "pyth_lazer_rule",
      isPythLazerUpdatePayloadShape,
      "{ update: Uint8Array; feedIds: number[] }",
    );
    if (!payload) return undefined;
    const lazer = requireLazerPackage(host);
    const infra = LAZER_INFRA[host.network];
    const [update] = tx.moveCall({
      target: `${infra.verifier_package}::pyth_lazer::${infra.verify_entry}`,
      arguments: [tx.object(lazer.state), tx.object.clock(), tx.pure.vector("u8", payload.update)],
    });
    return { kind: "pyth_lazer_rule", update };
  },
};
