/**
 * `PythLazerRule` — `PriceUpdateRule` for Pyth Lazer (Pyth Pro) signed
 * updates, plus `feedLazerRule`, the collector-feed leg `aggregateTicker`
 * appends per lazer-routed ticker. Fetches one `leEcdsa` payload for all
 * requested integer feed ids from the Lazer HTTP API (Bearer-authenticated
 * via `config.pyth.api_key`), verifies it ONCE on-chain via
 * `pyth_lazer::parse_and_verify_le_ecdsa_update`, and hands the resulting
 * `Update` PTB value back through a `RuleUpdateHandle` for the feed calls.
 */

import { fromHex } from "@mysten/bcs";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { LAZER_DEFAULTS, type PythLazerRulePackage } from "../config.ts";
import type { OracleHost } from "../host.ts";
import type {
  BuildUpdateOpts,
  PriceUpdateRule,
  RuleUpdateData,
  RuleUpdateHandle,
} from "../price-update-rule.ts";
import { FetchPolicyError, fetchWithPolicy } from "../update-fetch.ts";

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
 * - `channel` — `real_time`: the deployed rule binds the v1 Lazer API, whose
 *   `channel::from_u8` aborts on the 1000ms fixed-rate channel; real_time /
 *   50ms / 200ms are the safe subscriptions, and for an on-demand pull
 *   real_time is the freshest.
 * - `formats: leEcdsa` + `jsonBinaryEncoding: hex` — the Sui verifier takes
 *   the `leEcdsa` framing; hex matches `fromHex` below.
 */
const LAZER_LATEST_PRICE_REQUEST = {
  properties: ["price", "exponent", "confidence"],
  formats: ["leEcdsa"],
  jsonBinaryEncoding: "hex",
  channel: "real_time",
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
  apiKey: string,
  feedIds: number[],
  fetchOpts?: { timeoutMs?: number; retries?: number },
): Promise<Uint8Array> {
  const url = new URL("/v1/latest_price", endpoint);
  let res: Response;
  try {
    res = await fetchWithPolicy(
      url.toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceFeedIds: feedIds, ...LAZER_LATEST_PRICE_REQUEST }),
      },
      { apiKey, ...fetchOpts },
    );
  } catch (err) {
    // Mirrors fetchPriceFeedsUpdateData's reframing: a retryable status that
    // never recovered carries `status` on the FetchPolicyError — reformat
    // into this function's own message shape; a network-level exhaustion
    // (no status) propagates as-is.
    if (err instanceof FetchPolicyError && err.status !== undefined) {
      const body = err.bodySnippet ? ` ${err.bodySnippet}` : "";
      throw new Error(
        `Lazer price fetch failed: ${err.status}${body} (retries exhausted after ${err.attempts} attempts)`,
        { cause: err },
      );
    }
    throw err;
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
      throw new Error(
        "LazerApiKeyMissing: pyth_lazer_rule requires a Pyth Lazer access token — " +
          "set `pyth.api_key` in the client config (the SDK never reads process.env)",
      );
    }
    const update = await fetchLazerSignedUpdate(
      LAZER_DEFAULTS[host.network].endpoint,
      apiKey,
      feedIds,
      host.pyth.fetch,
    );
    return { kind: "pyth_lazer_rule", payload: { update, feedIds } };
  },

  /**
   * Appends the single `parse_and_verify_le_ecdsa_update(state, clock, bytes)`
   * call — one secp256k1 signature check covering every feed in the payload —
   * and returns its `Update` result as the handle the per-ticker feed leg
   * consumes. `opts.cache` / `opts.sponsorFund` / `opts.allowGasFee` are
   * Pyth-Core-specific and ignored (Lazer verification charges no update fee).
   */
  buildUpdateCalls(
    tx: Transaction,
    host: OracleHost,
    data: RuleUpdateData,
    _tickers: string[],
    _opts?: BuildUpdateOpts,
  ): RuleUpdateHandle | undefined {
    if (!data) return undefined;
    if (data.kind !== "pyth_lazer_rule") {
      throw new Error(
        `PythLazerRule.buildUpdateCalls received a payload of kind '${data.kind}', expected 'pyth_lazer_rule'`,
      );
    }
    if (!isPythLazerUpdatePayloadShape(data.payload)) {
      throw new Error(
        "PythLazerRule.buildUpdateCalls received a 'pyth_lazer_rule' payload with an unexpected shape " +
          "(expected { update: Uint8Array; feedIds: number[] })",
      );
    }
    const lazer = requireLazerPackage(host);
    const [update] = tx.moveCall({
      target: `${LAZER_DEFAULTS[host.network].verifier_package}::pyth_lazer::parse_and_verify_le_ecdsa_update`,
      arguments: [
        tx.object(lazer.state),
        tx.object.clock(),
        tx.pure.vector("u8", data.payload.update),
      ],
    });
    return { kind: "pyth_lazer_rule", update };
  },
};
