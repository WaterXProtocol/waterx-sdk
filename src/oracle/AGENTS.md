# src/oracle

## Oracle: the fed set is derived, never declared

Which price-update sources run is derived from the config (`deriveOracleSources`,
`src/oracle/source-list.ts`): a source is fed when its rule serves at least one ticker —
`PriceUpdateRule.supportedTickers(config)` is the definition of "wired" (`oracle_rules.pyth_lazer.lazer_feed_ids`
for Lazer, `oracle_rules.waterx.feeds` for the quote-center; the `symbols` universe is never a served set).
There is no `oracleSource` create option and no `ORACLE_SOURCE` env var, so the fed set and per-ticker
routing cannot disagree. The reason it is derived: the chain's per-ticker weight tables arbitrate —
over-feeding is dropped on-chain, while starving a weighted rule aborts `EMissingPriceSource` in
`aggregator::remove_outliers` — so the maximal wired set is the fail-safe direction. `ORACLE_SOURCES` is
exactly `["pyth_lazer_rule", "waterx_rule"]` plus the auxiliary `constant_rule`; `supra_rule` is never fed.
`USDCUSD` is the one constant pin and is deliberately not in `symbols`.

There is **no cross-source fallback**: a ticker no derived source serves is skipped by
`refreshOraclePrices` (`OracleRefreshSummary.skipped`; constant-pinned tickers need no leg), and the
`build*Tx` composers then fail closed with `OracleTickerUnservedError` on the tickers their action needs
(traded ticker + collateral; every pool asset for WLP) unless `allowUnrefreshedPrices` is set. Construction
throws only when the config wires no source at all; a present-but-wrong feed id is left to abort at dry-run.
`WaterxRule.supportedTickers = Object.keys(oracle_rules.waterx.feeds)`, so the document — not a live
probe — is what promises the quote-center serves a symbol; keep that list to what the deployed quote-center
signs. To fail at boot instead of at the first trade: `assertOracleWriteCoverage(client.perp, tickers)`;
to check on-chain weights against the fed set during a weight migration: `assertOracleWeightCoverage`
(`src/oracle/weight-coverage.ts`); `pnpm oracle:aggregates:testnet` prints the per-ticker table.

PTB refresh per ticker is one `feed` leg per rule the ticker is configured for, then one `aggregate`
(`oracle/aggregate.ts::refreshOraclePrices`). The `waterx_rule` leg pulls one signed Merkle **leaf** per
ticker and verifies + feeds in a single `collect_single_with_proof`. The fetch walks `WATERX_LEAF_ROUTES`:
`GET /v1/sign/bbo/consensus`, then `GET /v1/quotes/leaves` (same shape at the pre-rename path), and only
when no leaf route answers falls back to the indivisible batch envelope `GET /v1/quotes/update` fed through
`collect_batch_latest`, which rebuilds every item in-PTB to use one symbol's price. A 404 counts as "route
missing" only when its body names neither an error `code` nor a symbol; every other status throws (see
`fetchWaterxSignedLeaves`). A response that does not cover every requested ticker is rejected at fetch.

**Replay disposition** (the `waterx_rule` module in `waterx-contract`): on the `collect_*` paths a replayed
per-symbol signed timestamp **abstains** (`WaterxRuleDeclined { reason: Replay }`) — the chain already
holds a price at least that fresh — and `remove_outliers` drops the abstention, so two concurrent builds may
share one snapshot where another weighted rule can price the ticker. Where `waterx_rule` is the only
weighted rule (testnet today), the second build's `aggregate` aborts `ETotalWeightNotEnough`. No path aborts
with a replay-specific code (there is no `EReplayedSignature` in the contract); fetch a fresh snapshot per build.

## Price reads are canonical, never a leg

The signed leaves and the Lazer read are LEGS of `oracle::aggregate` (production weights the waterx leg at 0
on every market but DOGE). The price a consumer shows, sizes an order with, or stores is the quote-center's
CANONICAL plane — its off-chain replica of the aggregate. `readCanonicalPrices({ endpoint, tickers, fetch? })`
→ `Map<ticker, CanonicalQuote>` (every requested ticker is a key; `status !== "ok"` carries a `reason` and
zeroed price fields) and `openCanonicalStream({ endpoint, tickers, onFrame, onConnection?, headers?, backoff? })`
→ `{ stop, reconnectNow, snapshot }` have signatures FIXED by the cross-repo canonical plan: the backend and
frontend code against them, so add only optional fields and never change a shape. `readQuoteCenterPrices` /
`readLazerPrices` are `@deprecated` for price reads; the tx-build leg fetchers are not.

- One parser (`canonical/frame.ts::parseCanonicalQuote`) serves REST items and stream frames. `*_scaled` are
  exact decimal strings: a plain parse first, the source-token reviver (`utils/json-exact.ts`) only when a
  literal exceeds 2^53, and a `CanonicalPrecisionError` rather than invented digits where the runtime has no
  reviver source access.
- The REST reader falls back to `GET /v1/canonical/{symbol}` (at most 8 in flight) only when the batch route
  is absent, decided by the shared `classifyQuoteCenter404` (`quote-center-error.ts`). Timestamps are judged
  against the clock when EACH response arrives, never the call's start.
- The stream has no route ladder and no SSE. `headers` dial the optional peer `ws` through a bundler-opaque
  dynamic import; everything else dials the global `WebSocket`. The redial is scheduled before
  `onConnection` runs. Its tests run against a real loopback `ws` server
  (`test/perp/helpers/fake-canonical-stream-server.ts`).
