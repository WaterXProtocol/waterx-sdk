/**
 * `PythCoreRule` — `PriceUpdateRule` wrapper around the existing Pyth Core
 * (Hermes VAA) source in `../pyth.ts`. Delegates to `fetchPriceFeedsUpdateData`
 * / `buildPythPriceUpdateCalls` verbatim; this file only adapts them to the
 * `PriceUpdateRule` port shape (fetch → build) so a future router can select
 * across rules by `kind`. Mechanical wrap only — no on-chain/off-chain logic
 * changes vs `../pyth.ts` / `./pyth-rule.ts`.
 */

import type { Transaction } from "@mysten/sui/transactions";

import type { OracleHost } from "../host.ts";
import {
  assertRuleUpdateData,
  type BuildUpdateOpts,
  type PriceUpdateRule,
  type RuleUpdateData,
} from "../price-update-rule.ts";
import { buildPythPriceUpdateCalls, fetchPriceFeedsUpdateData } from "../pyth.ts";

/** `pyth_rule`'s narrowed `RuleUpdateData.payload` shape. */
export interface PythCoreUpdatePayload {
  readonly updates: Uint8Array[];
  readonly feedIds: string[];
}

/**
 * Shape check ONLY — the `kind` discriminant is checked separately by the
 * caller before this runs, since a same-shaped payload from a different rule
 * (e.g. a hypothetical Lazer payload also carrying `updates`/`feedIds`) must
 * not silently pass as a Pyth Core VAA block.
 */
function isPythCoreUpdatePayloadShape(payload: unknown): payload is PythCoreUpdatePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as { updates?: unknown }).updates) &&
    Array.isArray((payload as { feedIds?: unknown }).feedIds)
  );
}

export const PythCoreRule: PriceUpdateRule = {
  kind: "pyth_rule",

  // Charges a per-feed `base_update_fee` via `pyth::update_single_price_feed` —
  // see `PriceUpdateRule.requiresFeeSource`.
  requiresFeeSource: true,

  /** Tickers with a `pyth_rule.feeds` entry (mirrors `refreshOraclePrices`'s filter). */
  supportedTickers(host: OracleHost): string[] {
    return Object.keys(host.config.packages.pyth_rule?.feeds ?? {});
  },

  /** Resolves feed ids for `tickers`, then fetches their Hermes accumulator update. */
  async fetchUpdateData(host: OracleHost, tickers: string[]): Promise<RuleUpdateData> {
    if (tickers.length === 0) return null;
    const feedIds = tickers.map((ticker) => host.getPythFeed(ticker).feed_id);
    const updates = await fetchPriceFeedsUpdateData(host.pyth.hermes_endpoint, feedIds, {
      apiKey: host.pyth.api_key,
      fetch: host.pyth.fetch,
    });
    return { kind: "pyth_rule", payload: { updates, feedIds } };
  },

  /**
   * Subsets a (typically whole-universe) payload from {@link fetchUpdateData}
   * down to exactly `tickers`. Pyth Core charges a per-feed update fee (one
   * `update_single_price_feed` moveCall per `feedIds` entry — see
   * `buildPythPriceUpdateCalls`), so serving a full all-registry payload for a
   * 2-ticker build would multiply both the fee and the PTB size ~N× — a
   * per-feed subset is valid input by construction. Narrows `feedIds` only:
   * the single combined Hermes accumulator blob in `updates` already covers
   * every packed feed and needs no re-slicing. A ticker with no
   * `pyth_rule.feeds` entry, or whose feed id is not packed in THIS payload's
   * `feedIds`, is a coverage gap → `null` (miss), never a silent partial.
   */
  narrowUpdateData(host: OracleHost, data: RuleUpdateData, tickers: string[]): RuleUpdateData {
    const payload = assertRuleUpdateData(
      data,
      "pyth_rule",
      isPythCoreUpdatePayloadShape,
      "{ updates: Uint8Array[]; feedIds: string[] }",
    );
    if (!payload || tickers.length === 0) return null;
    const packedFeedIds = new Set(payload.feedIds);
    const feedIds: string[] = [];
    for (const ticker of tickers) {
      // Same lookup as `host.getPythFeed(ticker)` minus its throw — an
      // unlisted ticker is a miss here, not an error.
      const feedId = host.config.packages.pyth_rule?.feeds?.[ticker]?.feed_id;
      if (feedId === undefined || !packedFeedIds.has(feedId)) return null;
      feedIds.push(feedId);
    }
    return { kind: "pyth_rule", payload: { updates: payload.updates, feedIds } };
  },

  /** Appends the wormhole/pyth update PTB block for the payload from {@link fetchUpdateData}. */
  async buildUpdateCalls(
    tx: Transaction,
    host: OracleHost,
    data: RuleUpdateData,
    opts?: BuildUpdateOpts,
  ): Promise<void> {
    const payload = assertRuleUpdateData(
      data,
      "pyth_rule",
      isPythCoreUpdatePayloadShape,
      "{ updates: Uint8Array[]; feedIds: string[] }",
    );
    if (!payload) return;
    await buildPythPriceUpdateCalls(tx, host, payload.updates, payload.feedIds, {
      cache: opts?.cache,
      feeSource: opts?.feeSource,
    });
  },
};
