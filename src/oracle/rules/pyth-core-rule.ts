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
import type { BuildUpdateOpts, PriceUpdateRule, RuleUpdateData } from "../price-update-rule.ts";
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

  /** Appends the wormhole/pyth update PTB block for the payload from {@link fetchUpdateData}. */
  async buildUpdateCalls(
    tx: Transaction,
    host: OracleHost,
    data: RuleUpdateData,
    _tickers: string[],
    opts?: BuildUpdateOpts,
  ): Promise<void> {
    if (!data) return;
    if (data.kind !== "pyth_rule") {
      throw new Error(
        `PythCoreRule.buildUpdateCalls received a payload of kind '${data.kind}', expected 'pyth_rule'`,
      );
    }
    if (!isPythCoreUpdatePayloadShape(data.payload)) {
      throw new Error(
        "PythCoreRule.buildUpdateCalls received a 'pyth_rule' payload with an unexpected shape " +
          "(expected { updates: Uint8Array[]; feedIds: string[] })",
      );
    }
    await buildPythPriceUpdateCalls(
      tx,
      host,
      data.payload.updates,
      data.payload.feedIds,
      opts?.cache,
      opts?.sponsorFund,
      opts?.allowGasFee,
    );
  },
};
