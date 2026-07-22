# Changelog

All notable changes to `@waterx/sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries
reference the PR that introduced them.

## [Unreleased]

### Fixed

- **Pyth Hermes fetch dropped the endpoint's base path — EVERY feed 404'd
  under Pyth Pro (all trading tx-builds broken).** `fetchPriceFeedsUpdateData`
  built its request URL with `new URL("/v2/updates/price/latest", endpoint)`;
  the leading slash makes the path **absolute**, so it replaced the endpoint's
  own path instead of appending to it. Harmless for Pyth Core
  (`https://hermes.pyth.network`, no base path) but it silently dropped the
  `/hermes` prefix of the Pyth Pro compat endpoint
  (`https://pyth.dourolabs.app/hermes`), hitting `…app/v2/…` → **404 on every
  feed**, on the money path of every order/position/WLP tx-build. Now the path
  is concatenated onto the (de-slashed) endpoint so any base path survives.
  Regression test asserts the built URL keeps the base path (existing tests all
  used path-less endpoints, so none caught it). Shipped latent in 4.0.0 —
  surfaced only when the Pyth Pro endpoint (with its `/hermes` subpath) came
  into use.

- **Pyth HTTP fetch drops genuinely endpoint-missing feeds — tx-builds no
  longer 404 on the two feeds Pyth Pro lacks.** With the URL fixed,
  `fetchPriceFeedsUpdateData` still survives Pyth's all-or-nothing `404` —
  returned when ANY requested id is unknown to the endpoint, i.e. the mainnet
  `WTIUSD`/`BRENTUSD` feeds (Commodities USOILSPOT/UKOILSPOT) that are absent
  from the Pyth Pro compat endpoint (verified 404 per-feed; the other 29
  configured feeds serve 200). The
  404 body that names the bad ids is NOT reliably delivered to `fetch`
  (Cloudflare returns `content-length: 0` to node's undici even though curl
  sees it), so the unknown ids are isolated by **bisection**, memoized
  per-endpoint (`missingFeedIdsByEndpoint`), and the survivors re-fetched as one
  clean batch (a single combined accumulator blob, which
  `buildPythPriceUpdateCalls` requires). Steady state: once discovered, missing
  feeds are filtered up front and no batch 404s. `PythCoreRule.fetchUpdateData`
  aligns its returned `feedIds` with the served set via the new exported
  `endpointSupportedFeedIds(endpoint, feedIds)`, so the payload never lists a
  feed the blob doesn't cover. A ticker whose feed is genuinely absent just
  isn't priced (its on-chain aggregate abstains/aborts — correct). Mirrors the
  oracle service's WS missing-feed self-heal.

- **Lazer requests pin `channel: 'fixed_rate@200ms'` — `real_time` rejected
  19 of the 29 configured feeds.** Lazer 400s the WHOLE batch when any
  requested feed's `min_channel` is slower than the requested channel, and
  only the majors (BTC/ETH/SOL/USDC/DOGE/XRP/BNB/HYPE + EUR/JPY) publish
  `real_time` — the other 19, including SUIUSD and every xStock, are
  `min_channel: fixed_rate@200ms`. Verified live: the same 29-feed batch 400s
  at `real_time`/`50ms` and serves 200 (with the leEcdsa blob) at `200ms`,
  which the deployed on-chain rule accepts (`channel::from_u8` aborts only on
  the 1000ms channel).

- **Base-path-safe URL join shared by both oracle fetches; `endpointSupportedFeedIds`, `probeMissingFeeds`, `fetchWithPolicy` and `joinEndpointPath` exported from the oracle barrel.** `probeMissingFeeds(endpoint, ids, opts)` is the discovery-only bisection entry for consumers that fetch Hermes themselves and just observed a whole-batch 404 (no survivor data fetched); the missing-feed memo key is normalized (trailing slashes trimmed) so differently-spelled endpoints share one entry; and the internal bisection no longer re-probes a batch its caller already watched 404. The Lazer fetch had the same latent leading-slash `new URL` footgun that 404'd the Pro Hermes endpoint (harmless today only because the default Lazer endpoint has no base path); both fetches now build URLs through one `joinEndpointPath` helper (`update-fetch.ts`). The oracle barrel additionally exports `endpointSupportedFeedIds` so consumers implementing their own Hermes readers (e.g. the BE's parsed latest-price bootstrap) can reuse the per-endpoint missing-feed memo instead of re-discovering it.

### Added

- **Fail-fast when `pythGeneration: 'pro'` would tx-build against a
  core-compiled `pyth_rule`.** The two knobs are deliberately separate axes
  (`oracleSource` picks the RULE, `pythGeneration` the Pyth Core INFRA
  generation) — but the pro-generation × today's-deployed-rule cell is
  invalid for tx-building: Move types are package-qualified, so the
  core-compiled `pyth_rule::feed` rejects the Pro `PythState` on-chain with a
  cryptic `CommandArgumentError { TypeMismatch }` (verified on mainnet
  2026-07-22, under BOTH oracle sources — the config-driven feed leg puts
  `pyth_rule::feed` in every PTB). `refreshOraclePrices` now throws
  `PythGenerationMismatchError` BEFORE any fetch or PTB mutation whenever a
  pro-generation client requests a `pyth_rule`-fed ticker. The gate is
  UNCONDITIONAL on the config — only two rule packages exist (`pyth_rule`,
  `pyth_lazer_rule`) and every deployed `pyth_rule` is Core-compiled; there
  is deliberately no config marker to lift it (a Pro-compiled rule would be
  a new package needing new SDK bindings, so the SDK release that binds it
  removes the gate). Deliberately NOT enforced at client creation:
  data-plane-only 'pro' clients (price reads, prefetch caches) keep working
  — only tx-building is refused.

- **Fail-fast when a client selects an `oracleSource` the network doesn't
  configure.** `PerpClient.create` (and thus `WaterXClient.create`) now calls
  the new `assertOracleSourceConfigured(network, packages, source)`
  (`rule-registry.ts`): a non-default `oracleSource` (i.e. anything other than
  `pyth_rule`) whose rule package is missing/empty in the loaded config throws
  `OracleSourceNotConfiguredError` at creation. Without it, e.g.
  `oracleSource: 'pyth_lazer_rule'` on mainnet (which has no `pyth_lazer_rule`
  config) would NOT error — `PythLazerRule.supportedTickers` returns `[]` and
  `refreshOraclePrices` silently routes every ticker through the `pyth_rule`
  fallback, so the client runs entirely on Pyth Core while believing it is on
  the selected source. Now that misconfiguration fails loudly at boot.
  (`pythGeneration: 'pro'` — Pyth Pro, the upgraded Pyth *Core* — is unaffected:
  it's a knob on the always-present `pyth_rule` path, orthogonal to
  `oracleSource`, and needs no Lazer config.)

_Both entries release as `4.0.1` (patch); `package.json` stays at the last
released version per the repo's release-tagging rule._

## [4.0.0] - 2026-07-21

_All entries in this section were introduced by [#76](https://github.com/WaterXProtocol/waterx-sdk/pull/76) — the SDK phase of the cross-repo price-stack refactor (Pyth Core→Pro migration groundwork). Released as the next **major** (`4.0.0`) because the change set carries several **BREAKING** changes (see `### Changed`): the config-driven fee-source rework, the `buildPythPriceUpdateCalls`/`updatePythPrices` positional-args → options-object collapse, and the `OracleFeeSource` consolidation._

### Added

- **`narrowUpdateData` on the `PriceUpdateRule` port — rules own payload
  subsetting.** New `narrowUpdateData(host, data, tickers)` method: narrows a
  payload previously produced by `fetchUpdateData` (typically a consumer's
  whole-universe prefetch cache) down to exactly `tickers`, without a re-fetch.
  Each rule owns its own divisibility — `PythCoreRule` subsets its per-feed
  entries; `PythLazerRule`'s single signed message is indivisible, so it passes
  through whole iff every requested ticker is covered and misses (`null`)
  otherwise. `refreshOraclePrices` now narrows every `updateDataProvider` cache
  hit through this method before building, so a whole-universe hit updates and
  charges the on-chain fee for ONLY the group's tickers (not every cached feed),
  and a hit that cannot cover the group falls through to a live fetch instead of
  shipping the wrong payload. Consumers therefore never branch on rule `kind` to
  subset a payload — that knowledge lives in the rule.

- **`PYTH_PRO_DEFAULTS` + `pythGeneration` client option — Pyth Pro
  (Core-upgrade) infra selectable per environment.** New per-network constant
  set `PYTH_PRO_DEFAULTS: Record<Network, PythInfraConfig>`
  (`src/oracle/config.ts`, re-exported from `@waterx/sdk/perp`) carrying the
  post-2026-08-18 Pro-compatible contracts from Pyth's Core-Upgrade docs
  (https://docs.pyth.network/price-feeds/core/upgrade/contracts, Sui section
  — package revs `sui-pro-compatible-contract-mainnet` / `-testnet`; all four
  state ids verified on-chain as shared `state::State` objects under the
  docs' upgraded package ids) plus the Hermes-compatible endpoint
  `https://pyth.dourolabs.app/hermes` (auth-first — pair with `pyth.api_key`).
  Kept as a flat sibling of `PYTH_DEFAULTS` (not a nested
  `PYTH_INFRA[network][generation]`) because `PYTH_DEFAULTS` is a published
  export with external consumers — the additive map is the smallest honest
  surface. Selection: a new `pythGeneration?: 'core' | 'pro'` create option
  (default `'core'`) on `PerpClient.create` / `WaterXClient.create` picks
  which set feeds `client.pyth` when the config JSON has no explicit `pyth`
  block; an explicit `config.pyth` override still wins wholesale (unchanged
  precedence). Orthogonal to `oracleSource` — this flips the Pyth-Core
  *infra* (state ids + endpoint), not which `PriceUpdateRule` routes tickers,
  so after the 2026-08-18 cutover
  (https://docs.pyth.network/price-feeds/core/upgrade) consumers set
  `pythGeneration: 'pro'` +
  `pyth.api_key` without touching their rule routing. New `PythGeneration`
  type exported alongside. The README gains an "Oracle sources & the Pyth
  Pro migration" section documenting the per-env staging-Pro/prod-Core
  pattern (env var per consumer, single SDK version everywhere) and an
  "Adding an oracle source" runbook (implement `PriceUpdateRule` incl.
  `requiresFeeSource`, register in `rule-registry.ts`, publish the on-chain
  rule package via the normal config deploy pipeline, add SDK infra
  constants if needed, flip `ORACLE_SOURCE` per environment — the path the
  in-house ed25519 `waterx_rule` will follow).
- **Resilient oracle fetch — retry policy, Bearer auth, injectable
  update-data provider.** The Hermes fetch (`fetchPriceFeedsUpdateData`) sits
  on the money path of every trading tx-build; it was one bare `fetch`, 15s
  timeout, no retry, no auth. New `fetchWithPolicy` (`src/oracle/update-fetch.ts`,
  re-exported from the `oracle`/`perp` barrels as `FetchPolicy` +
  `FetchPolicyError`) is a shared resilience wrapper now used by BOTH oracle
  fetches AND `loadConfig`:
  - Retries network errors, HTTP 429, and HTTP 5xx with exponential backoff
    (`retryDelayMs * 2^attempt`, capped at 2s; defaults: 15s per-attempt
    timeout, 2 retries, 250ms base delay). Other 4xx (401/400/403/404/…) are
    NOT retried — deterministic failures return immediately so callers keep
    their existing error text unchanged.
  - Attaches `Authorization: Bearer <apiKey>` iff the key is a non-empty
    string — absent/empty is byte-identical to today's keyless request (the
    Phase-0 invariant of the Pyth Pro migration).
  - Both `init.signal` (if the caller set one) and the separate
    `externalSignal` param cancel the WHOLE policy — in-flight attempt AND a
    queued backoff sleep, not just one attempt — via `AbortSignal.any`
    (folded together, so neither is silently dropped by the per-attempt
    `{ ...init, signal }` override).
  - On final failure throws `FetchPolicyError` naming the target's
    `host + pathname` (never the query string — feed ids are noise), the
    attempt count, and whichever of `status` (plus a ~200-char truncated
    response-body snippet, restoring the diagnostic a plain single-attempt
    `if (!res.ok) throw` used to carry) or `cause` applies; an INTERMEDIATE
    (non-final) retryable response's body is discarded via
    `response.body?.cancel()` instead of read, so a doomed-to-retry response
    doesn't pin its socket open. `fetchPriceFeedsUpdateData`,
    `PythLazerRule`'s Lazer fetch, and `loadConfig` each reformat a
    status-carrying `FetchPolicyError` (body snippet included, for the two
    oracle fetches) into their own existing message shape
    (`"Hermes price fetch failed: …"` / `"Lazer price fetch failed: …"` /
    `"loadConfig: HTTP …"`) so downstream consumers (e.g. the e2e
    transient-failure detector) see unchanged text.
  - **Worst-case latency note**: under the default policy (15s timeout, 2
    retries) a FULL outage now takes up to ~46s (3 × 15s + ~0.75s of
    backoff) to surface as a `FetchPolicyError`, vs ~15s pre-4.0.0's single
    bare-`fetch` attempt. Tunable per client via
    `config.pyth.fetch.{timeoutMs,retries}` for callers that need a
    tighter bound.

  `PythInfraConfig` gains an optional `fetch?: { timeoutMs?: number; retries?:
  number }` policy override (`src/oracle/config.ts`), threaded through by
  `fetchPriceFeedsUpdateData`'s new optional third param
  (`{ apiKey?, fetch? }`), `updatePythPrices`, `PythCoreRule.fetchUpdateData`,
  and `PythLazerRule.fetchUpdateData` — all existing call signatures stay
  backward-compatible.

  `refreshOraclePrices` (`src/oracle/aggregate.ts`) gains an
  `updateDataProvider?: UpdateDataProvider` opt (new port in
  `src/oracle/price-update-rule.ts`, re-exported from `oracle`/`perp`
  barrels) — the BE prefetch-cache seam. Per on-chain-update group, a
  configured provider's `get(source, tickers)` is checked before that
  group's live `rule.fetchUpdateData`: a matching-kind hit is used instead of
  fetching; a cache miss (`null`) or a provider throw falls back to the live
  fetch (a degraded/broken cache must never break the money path); a
  kind-mismatched hit throws (a caller bug, not a cache miss). Threaded
  through `CommonBuildOpts` → `wrapRequestAndExecute` → `refreshWlpPoolOracles`
  (`src/perp/tx-builders/common.ts`) so BE tx-builders can pass one.

  `perp/config.ts`'s `loadConfig` now retries a transient config-endpoint
  failure via the same `fetchWithPolicy` policy (2 retries) and, on a refresh
  failure — network exhaustion, a non-ok response, OR a 200 whose body fails
  to parse/validate — with a previously-validated config already cached for
  that URL, silently returns that last-known-good snapshot instead of
  throwing (the SDK never logs) — a config-endpoint blip must not crash a
  long-running process that already has a working deployment snapshot. A
  first-load failure (nothing cached yet) still throws. Known, deliberately
  deferred limitation: this treats a deterministic failure (404/403 — the URL
  moved, or access was revoked) the same as a transient blip, so a
  long-running process can keep serving a stale snapshot forever once it has
  one; disambiguating the two is a follow-up.

  **Follow-up (same 4.0.0, still unpublished): the opt-in `cache` map and the
  always-on last-known-good map are now ONE module map**, written
  unconditionally on every successful load; `opts.cache` only gates the
  early-return READ at the top of `loadConfig`, it no longer gates the write.
  `clearConfigCache` clears the single map. Deliberate, benign semantic
  refinement: a `cache: true` load can now hit an entry populated by an
  earlier `cache: false` load of the SAME url — that's fine, it's still that
  url's latest successfully-validated fetch, strictly FRESHER than any
  fallback read would have been, so a `cache: true` caller never observes
  staler data than before.

- **`PythLazerRule` — Lazer-generation price updates behind `oracleSource`
  routing.** `pyth_lazer_rule` now resolves to a real `PriceUpdateRule`
  (`src/oracle/rules/pyth-lazer-rule.ts`, exported as `PythLazerRule` +
  `PythLazerUpdatePayload`): it fetches ONE signed `leEcdsa` message for the
  routed tickers' integer Lazer feed ids (`packages.pyth_lazer_rule.feeds`)
  from the Lazer HTTP API (`POST /v1/latest_price`, endpoint from the new
  `LAZER_DEFAULTS` per-network map), authenticated with the new optional
  `pyth.api_key` config field (Lazer is auth-first; a missing key throws
  `LazerApiKeyMissing` at fetch time — the SDK never reads `process.env`), and
  verifies it on-chain ONCE via
  `pyth_lazer::parse_and_verify_le_ecdsa_update(state, clock, bytes)` (no
  update fee; `cache`/`sponsorFund` are Pyth-Core-specific and ignored).
  `buildUpdateCalls` may now return a `RuleUpdateHandle` (exported type)
  carrying the verified `Update` PTB value, and the collector-feed leg is
  rule-aware: each lazer-served ticker's `aggregateTicker` (new optional
  `lazerUpdate` arg) appends `pyth_lazer_rule::feed(collector, config, clock,
  update)` **in addition to** its unchanged `pyth_rule::feed` leg — required
  on-chain while `pyth_rule` stays in the ticker's weighted set
  (`remove_outliers` demands every weighted rule appear in the collector;
  `pyth_rule::feed` abstains on a stale `PriceInfoObject` rather than
  aborting, and an unweighted lazer contribution is silently dropped, so
  dual-registered tickers are safely lazer-routable ahead of the on-chain
  weight migration). `OracleHost` gains a `network` field (already satisfied
  by every client) for the per-network Lazer defaults.
- **`oracleSource` client create option — env-selected oracle rule routing.**
  `WaterXClient.create` / `PerpClient.create` accept a new `oracleSource?:
  OracleSource` option (`'pyth_rule' | 'pyth_lazer_rule'`, default
  `'pyth_rule'`) that selects which `PriceUpdateRule` `refreshOraclePrices`
  uses for the on-chain price-update leg before aggregating. Exposed
  read-only as `OracleHost.oracleSource` / `PerpClient.oracleSource`. Routing
  is driven **solely** by this option — never by a config JSON `enabled`
  flag and never by `process.env` (the SDK never reads it; consumers wire
  the option from their own env var, e.g. `ORACLE_SOURCE`).
  `refreshOraclePrices` groups tickers per rule: the selected rule serves
  every ticker in its `supportedTickers`, tickers it doesn't cover fall back
  to `pyth_rule` when they support it, and a ticker supported by neither is
  skipped from the update leg exactly as before (it's still aggregated via
  whichever rule `aggregateTicker` finds, e.g. `constant_rule`).
- **`PriceUpdateRule` port + `PythCoreRule`.** New strategy port
  (`src/oracle/price-update-rule.ts`, exported types `PriceUpdateRule`,
  `PriceUpdateRuleKind`, `RuleUpdateData`, `BuildUpdateOpts`, `OracleSource`)
  for one oracle rule generation: fetch its off-chain update payload, then
  emit the PTB calls that verify/push it on-chain. `PythCoreRule`
  (`src/oracle/rules/pyth-core-rule.ts`) wraps the existing Pyth Core
  (Hermes VAA) path mechanically — no logic change — and is the only rule
  registered today; a future `PythLazerRule` will register `'pyth_lazer_rule'`.
- **`pyth_lazer_rule` config typing.** `OraclePackages.pyth_lazer_rule?:
  PythLazerRulePackage` mirrors the deployed config JSON's `pyth_lazer_rule`
  entry (`config`, `state`, `enabled?`, `feeds: Record<string, number>`
  integer Lazer feed ids) for lossless round-tripping. Typed only — no SDK
  code reads `enabled` for routing (see `oracleSource` above), and
  `validateConfig` does not require the package.

### Changed

- **`loadConfig` in-memory cache is keyed by network + url, not url alone.**
  The same `waterxConfigUrl` can be requested for two networks (and
  `validateConfig` already enforces network/url coherence on the success path),
  so a url-only cache key let a testnet snapshot satisfy a mainnet request —
  both on the `cache: true` fast-path read and on the resilience fallback for a
  failed refresh — handing back wrong-CHAIN object ids to build transactions
  against. A wrong-network request now misses the cache and fetches fresh; a
  failing refresh with no same-network last-known-good throws rather than
  serving another network's config.
- **BREAKING: config-driven, fail-fast Pyth update-fee source (Enoki-safe by
  default).** `buildPythPriceUpdateCalls` used to silently fall back to
  `tx.gas` for the per-feed Pyth update fee whenever no `sponsorFund` was
  passed — Enoki-sponsored transactions reject any `tx.gas` draw, so BE
  callers had to hand-roll their own oracle refresh (skip
  `refreshOraclePrices` entirely and drive `aggregateTicker` directly) purely
  to dodge this trap, and a market whose `request_checklist` required the
  `PythSponsorRule` witness could fail ON-CHAIN instead of at build time. Fee
  source is now resolved once, before any PTB mutation, with three outcomes:
  - `sponsorFund` supplied → the fee is drawn from the sponsor pool
    (`pyth_sponsor_rule::split`), same as before. Takes priority over the new
    `allowGasFee` flag below — a fund, once opened, always wins.
  - No `sponsorFund` + `allowGasFee: true` (new opt) → the fee is drawn from
    `tx.gas`, exactly as the old implicit default did — now explicit.
  - Neither → throws `OracleFeeSourceUnavailable` naming both fixes (deploy
    `pyth_sponsor_rule` to config, or pass `allowGasFee: true`) instead of
    silently drawing from `tx.gas`.

  `updatePythPrices` fetches from Hermes and only THEN reaches
  `buildPythPriceUpdateCalls`'s own fee-source check, so a throw on that
  route still costs a wasted fetch — it just never leaves a stray
  `moveCall`/`splitCoins` behind. `refreshOraclePrices` does better: its
  check is hoisted ABOVE both its off-chain fetch AND its per-group build
  loop, keyed on the new `PriceUpdateRule.requiresFeeSource: boolean`
  (`true` on `PythCoreRule`, `false` on `PythLazerRule` — a fee-free rule
  never blocks the check) rather than waiting for a fetch to complete or
  checking referential identity against a specific rule instance — so for
  that route neither the network call nor any PTB command happens before
  the throw, and a future fee-charging rule (or a test double standing in
  for one) can't silently bypass the guarantee. This closes a mixed-shape
  gap the per-call guard alone couldn't: a fee-free Lazer group ordered
  ahead of a Pyth Core fallback group (`oracleSource: 'pyth_lazer_rule'`)
  could otherwise let the Lazer group's verify/feed calls land in `tx`
  before the Pyth Core group's own guard ever fired.

  The thrown error is now a real `OracleFeeSourceUnavailableError` class
  (`instanceof`-able, mirrors `FetchPolicyError`) exported from the oracle
  and perp barrels, not just an `Error` with a matching message — a
  consumer (e.g. a BE integration deciding its own `allowGasFee` policy)
  can `catch (e) { if (e instanceof OracleFeeSourceUnavailableError) … }`
  instead of string-matching.

  `wrapRequestAndExecute` (every order/position `build*Tx`) now opens (and
  reimburses) the sponsor fund purely from **config presence** —
  `client.config.packages.pyth_sponsor_rule` deployed ⇒ the fund is ALWAYS
  opened, regardless of caller flags. `CommonBuildOpts.useSponsor` is
  **deprecated** (kept accepted as a no-op so existing callers keep
  compiling — see its JSDoc) and no longer gates fund-opening; the new
  `CommonBuildOpts.allowGasFee` is the only caller lever left, and it only
  matters when config has no sponsor rule to open.

  `buildMintWlpTx` / `buildMintAndStakeWlpTx` / `buildUnstakeAndRequestRedeemWlpTx`
  (`mint_wlp` / `request_redeem` produce no `TradingRequest`, so there's
  nothing for `pyth_sponsor_rule::reimburse` to attach its witness to — the
  sponsor flow is structurally unavailable to them) now require
  `allowGasFee: true` when `skipOraclePriceRefresh` is left `false`; without
  it they throw `OracleFeeSourceUnavailable` at build time instead of
  quietly drawing gas that would break under Enoki. `refreshOraclePrices` /
  `refreshWlpPoolOracles` / `updatePythPrices` / `PriceUpdateRule.buildUpdateCalls`
  (`BuildUpdateOpts`) all gained the matching `allowGasFee?: boolean`
  pass-through; Lazer ignores it (no update fee).

  **Migration**: if you called `buildPlaceOrderTx` / `buildMintWlpTx` /
  `refreshOraclePrices` / `updatePythPrices` (etc.) with oracle refresh
  enabled and relied on the implicit `tx.gas` fallback (no `sponsorFund`, no
  prior error), pass `allowGasFee: true` to keep that behavior — the
  fallback is now explicit. If your client's config has `pyth_sponsor_rule`
  deployed, no change is needed for order/position flows (the fund now
  opens automatically); `useSponsor` can be dropped from call sites at your
  convenience. To detect the new failure mode at runtime, `instanceof
  OracleFeeSourceUnavailableError` — exported from `@waterx/sdk` (root),
  `@waterx/sdk/perp`, and `@waterx/sdk/oracle`.

  **Follow-up (same 4.0.0, still unpublished): `OracleFeeSource`
  consolidation.** The `sponsorFund` / `allowGasFee` pair above is now ONE
  resolved value, `OracleFeeSource` (new type, exported
  from the oracle barrel and re-exported from `@waterx/sdk` / `@waterx/sdk/perp`):

  ```ts
  type OracleFeeSource =
    | { kind: "sponsor"; fund: TransactionArgument; packageId: string }
    | { kind: "gas" };
  ```

  It is resolved exactly ONCE, at the edges — `wrapRequestAndExecute` and the
  WLP builders (`buildMintWlpTx` / `buildMintAndStakeWlpTx` /
  `buildUnstakeAndRequestRedeemWlpTx`) — from the same config-presence +
  `allowGasFee` decision described above, then threaded verbatim through
  `refreshOraclePrices` → `BuildUpdateOpts` → `PythCoreRule` →
  `buildPythPriceUpdateCalls`. The sponsor-beats-gas priority is now
  structural (decided once at resolution) instead of re-checked at every
  layer. **`BuildUpdateOpts.sponsorFund`/`allowGasFee` and
  `refreshOraclePrices`'s `opts.sponsorFund`/`opts.allowGasFee` are REMOVED**,
  replaced by a single `feeSource?: OracleFeeSource` field on both.
  **`PUBLIC BUILDER DX IS UNCHANGED`**: `CommonBuildOpts.allowGasFee` (used by
  every `build*Tx` composer) is still a plain `boolean` — callers of the
  high-level builders never construct an `OracleFeeSource` themselves; only
  direct callers of `refreshOraclePrices` / `BuildUpdateOpts` /
  `buildPythPriceUpdateCalls` see the new shape.

  **This retires the earlier "Signature note" plan** (originally: append
  `allowGasFee` as another ADDITIVE positional param, collapse to an options
  object only in a future major version) — `buildPythPriceUpdateCalls` /
  `updatePythPrices` now take ONE trailing options object,
  `{ cache?: PythCache; feeSource?: OracleFeeSource }`, replacing the
  positional `cache?, sponsorFund?, allowGasFee?` tail entirely (not just
  appending `allowGasFee` as another position, as originally planned). Both
  are pre-existing 3.1.x-exported symbols, so THIS PART is a real break for
  any positional caller — this is a breaking change and is covered by the
  `4.0.0` major release.

  **Migration (fee-source consolidation)**: a direct caller of
  `buildPythPriceUpdateCalls(tx, host, updates, feedIds, cache, sponsorFund,
  allowGasFee)` or `updatePythPrices(tx, host, feedIds, cache, sponsorFund,
  allowGasFee)` moves those trailing positionals into one options object:
  `{ cache, feeSource: sponsorFund ? { kind: 'sponsor', ...sponsorFund } :
  allowGasFee ? { kind: 'gas' } : undefined }`. A direct caller of
  `refreshOraclePrices(tx, host, tickers, { sponsorFund, allowGasFee })` makes
  the same substitution for `feeSource`. A caller of any `build*Tx` composer
  (`CommonBuildOpts.allowGasFee`) needs no change — the builder resolves
  `OracleFeeSource` internally.

  Also dropped: `PriceUpdateRule.buildUpdateCalls`'s unused `tickers`
  parameter (both `PythCoreRule` and `PythLazerRule` already derived
  everything from `data.payload`) — a 4.0.0-new port with zero external
  consumers, so this is a free removal, not a migration item. New signature:
  `buildUpdateCalls(tx, host, data, opts?)`.

## [3.1.1] - 2026-07-10

### Added

- **Prediction batch market/position views.** New `src/prediction/fetch.ts`
  helpers expose the on-chain `waterx_prediction::view` batch reads added in
  `waterx-contract#105`, so callers fetch all active exposure in a single
  `simulate`/`devInspect` instead of the N+1 cursor walk
  (`unresolved_market_cursor` → `market_by_key` → …): `getUnresolvedMarkets`
  (full walk, one call) plus paginated `getUnresolvedMarketsPage` /
  `getResolvedMarketsPage` / `getPositionsPage`. Pages take an optional
  `Option<u64>` `start` cursor (omit → from the front of the table) and return
  a `nextCursor` (`null` when exhausted). Adds `PageParams` / `MarketPage` /
  `PositionPage` to `src/prediction/types.ts`; reuses the existing
  `MarketView` / `PositionView` shapes and `mapMarketView` / `mapPositionView`
  mappers, so no new BCS types. Loading all active markets is now **one** RPC
  round-trip instead of N+1: measured read-only against staging (MAINNET) with
  57 unresolved markets, `getUnresolvedMarkets` / `getUnresolvedMarketsPage`
  (`limit=100`) returned in a single call (~0.2–1.6s, RPC-variance dependent)
  versus ~33s for the sequential `unresolved_market_cursor` + 57×
  `market_by_key` walk (58 serial round-trips) — roughly **20–140× faster**,
  and the gap widens as the market/position count grows. (`waterx-contract#105`)

### Changed

- **BREAKING — the config URL is supplied only via the `waterxConfigUrl` option.**
  `loadConfig` (both `perp/config.ts` and `prediction/config.ts`) reads the URL
  solely from `opts.waterxConfigUrl`, fetches it **as-is** (no `<network>.json` /
  git ref appended), and **throws** when unset. There is **no `WATERX_CONFIG_URL`
  env-var fallback and no built-in default** — the SDK never reads `process.env`.
  The load option was **renamed `configUrl` → `waterxConfigUrl`** across
  `loadConfig`, `PerpClient` / `PredictClient` `create` / `testnet` / `mainnet`,
  and `WaterXClient.create` (shared + per-line). The `defaultConfigUrl()` helper
  and the perp `configRef` option (removed in this cycle) stay gone; the
  `CONFIG_URL_ENV` export is also removed. Migrate by passing an explicit
  `waterxConfigUrl` (apps that want env-driven config read `process.env` themselves
  and pass it through, e.g.
  `create("TESTNET", { waterxConfigUrl: process.env.WATERX_CONFIG_URL })`). (#73)

## [3.1.0] - 2026-07-03

### Changed

- **Prediction view decoding now uses the generated codegen schemas directly.**
  `src/prediction/bcs.ts` no longer hand-defines the `*View` BCS structs / enums
  — it re-exports them from `src/generated/waterx_prediction/*` (regenerated by
  `pnpm codegen` from the deployed Move ABI) under the same `*Bcs` names, and
  keeps only the `map*` helpers that translate the raw parse output to the public
  camelCase view types. This removes the hand-written mirror that had silently
  drifted from the contract (cause of the `OrderView` / `RegistryView` bugs
  below); a future ABI change now flows in via codegen instead of needing a
  manual edit. Public surface (`@waterx/sdk/prediction/utils/bcs`,
  `OrderViewBcs`, `mapOrderView`, …) is unchanged. The `getChainOrderView` test
  helper, previously a second hand-written `OrderView` mirror, now delegates to
  `getOrder`. (#69)

### Fixed

- **`deriveGiftAddress` (prediction gift links) now survives a package
  upgrade.** The off-chain `gift_id` derivation built the `GiftKey` type tag
  from `packages.waterx_prediction_gift.published_at`, but Sui pins a struct's
  type identity to its defining package's _original_ id — the on-chain
  `derive_gift_address` always hashes `GiftKey` under that original id, which
  never advances across upgrades. So after the first gift-package upgrade (once
  `published_at` moved off `original_id`), `deriveGiftAddress` computed the
  wrong address for **every** gift — old share links and freshly created ones
  alike — even though on-chain state was fine. The type tag now resolves via a
  new `PredictClient.waterxPredictionGiftTypeOriginId()` (config `original_id`,
  falling back to `published_at` when absent), matching the existing
  `wlpType()` convention; moveCall targets correctly stay on `published_at`. A
  `giftTypeOriginId` override was added to `GiftBaseParams` for offline
  derivation against custom deployments. The share URL/seed was never affected
  (no package id in it). (#72)
- **Dual ESM + CJS exports so CommonJS consumers can `require()` the SDK.** The
  package was published ESM-only — the `exports` map declared only the `import`
  condition — so any `require("@waterx/sdk")` (e.g. a webpack/NestJS backend
  emitting CommonJS) crashed at resolution with `ERR_PACKAGE_PATH_NOT_EXPORTED`,
  even though it type-checked and built. The build now emits a real CommonJS
  output (`tsconfig.cjs.json` → `dist/cjs/`, with a `"type": "commonjs"` marker)
  alongside the ESM one, and every `exports` entry gains `require` + `default`
  conditions — each with its own CJS-flavored `.d.ts` — pointing at it. No public
  subpath or exported symbol changed; the only surface change is the added
  conditions. A `publint` + `@arethetypeswrong/cli` check runs in CI (`pnpm
check:exports`) so an import-only exports map can never ship again. (#71)
- **`getOrder` (prediction) BCS decode** — `OrderViewBcs` was missing the
  `receiver_account_id` field the deployed `view::OrderView` returns (between
  `account_id` and `market_id`), so every `getOrder` call aborted with
  "Offset is outside the bounds of the DataView". Added the field to the BCS
  struct, surfaced it as `OrderView.receiverAccountId`, and mapped it in
  `mapOrderView`. (#68)
- **`getRegistry` (prediction) silent mis-decode** — the deployed
  `view::RegistryView` has a `next_position_id` field (between `next_order_id`
  and `order_count`) that the hand-written `RegistryViewBcs` was missing, so
  `getRegistry` read `orderCount` / `positionCount` / `unresolvedMarketCount` /
  `resolvedMarketCount` from offsets shifted by one and returned wrong values
  without erroring. Fixed by decoding via the generated schema (which has the
  field) and surfaced as `RegistryView.nextPositionId`. (#69)

## [3.0.0] - 2026-06-30

### Added

- **Prediction config `configRef` (#65).** `prediction` `loadConfig` /
  `defaultConfigUrl` / `PredictClient.create` now accept `configRef?: string` to
  pin the canonical `waterx-config` JSON to a specific git ref (commit SHA, branch,
  or tag), reaching parity with the perp line. `configUrl` still takes precedence
  when both are set.
- **Prediction user-side position builders: `requestPartialClose`, `transferPosition`,
  `splitPosition`.** Fills the gap between the on-chain `waterx_prediction` user
  entrypoints and the SDK. `requestPartialClose` peels `closeShares` off a position
  into a new same-account position and runs the close (partial sell) flow on it,
  leaving the remainder `Open`. `transferPosition` moves an open position to another
  WXA account; `splitPosition` splits an open position into two independent positions
  with proportional cost basis for a recipient account. Exposed from
  `@waterx/sdk/prediction` (root, `user`, and `user.position` namespaces), matching
  the existing `requestClose` / `selfCancelClose` shape.

### Changed

- **Predict/perp E2E discovery prefers runnable fixtures over skip.** (#66) Wallet coin
  discovery falls back from settlement `::usd::USD` to MOCK_USDC + PSM deposit path;
  perp custody resolves canonical wxa rows; order/position scans walk recent cursors
  and upgrade to `filledShares >= 2` positions when available. Order reads in e2e/seed
  use a test-only `getChainOrderView` decoder (includes on-chain `receiver_account_id`)
  until the SDK `OrderView` BCS schema catches up in a separate release.

- **BREAKING — `WaterXClient` is now the umbrella entry point.** (#55) The class
  previously named `WaterXClient` (the perp product line) is renamed
  **`PerpClient`**; the unified facade previously named `Client` is renamed
  **`WaterXClient`** and is the single main entry. It exposes three namespaces:
  - `client.account` — the shared `waterx_account` framework **plus** funding
    (credit + custody) builders. Backed by the perp sub-client config (which
    carries the shared `AccountRegistry`, bridge, native_custody,
    withdrawal_queue, credit_registry).
  - `client.perp` — **is** the `PerpClient` instance with the perp builders/views
    grafted on (trading / orders / WLP / staking / referral). Signing & config
    methods (`signAndExecuteTransaction`, `simulate`, `getMarket`, …) sit on the
    same object. The credit/custody _high-level_ `build*Tx` wrappers
    (`buildRedeemVaaTx`, `buildRequestCreditWithdrawTx`, `buildExecuteWithdrawalTx`)
    remain here; only the low-level credit/custody builders move to `client.account`.
  - `client.predict` — **is** the `PredictClient` instance with the prediction
    builders/views grafted on. Generic account builders (`createAccount`,
    `requestDeposit`/`deposit`, `requestWithdraw`/`withdraw`, delegate add/remove,
    `transferCoinToAccount`, `consume*Direct`, `resolveRegistryAccountId`) are
    dropped from `client.predict`; prediction-specific account ops
    (`setDelegatePredictionPermission`, `whitelistPredictionProtocol`,
    `allow`/`disallowPredictionProtocolAsset`) are kept.
  - There are no longer separate `client.perpClient` / `client.predictClient`
    accessors — `client.perp` / `client.predict` are the clients.
  - `Client` remains as a deprecated alias of `WaterXClient` for one major cycle.
  - **No same-name alias for the old perp `WaterXClient`** — importers of the perp
    client must switch to `PerpClient` (flat at the root or `perp.PerpClient`).
  - **Cross-network caveat:** `client.account` follows the **perp** line; on
    split-network setups (`opts.perp.network !== opts.predict.network`), reach the
    predict line's generic account builders via the `prediction` namespace.
    `WaterXClient.create` now emits a `console.warn` in this case so it isn't
    a silent footgun.
- **Internal: shared transport extracted to `BaseLineClient`.** (#55)
  `PerpClient` and `PredictClient` no longer each duplicate the gRPC client
  construction, the read wrappers, `simulate` / `signAndExecuteTransaction`, and
  `packageIds()` — these now live on a shared `BaseLineClient` base; the perp
  config-schema lookups (`getMarket`, `wlpType`, `creditType`, …) move to a
  `PerpConfigView` that `PerpClient` composes. Public surface is unchanged
  (`PerpClient` / `PredictClient` keep all their methods); `PerpClient`'s
  `signAndExecuteTransaction` signature widens additively (now accepts the same
  generic `include` / `additionalSignatures` / `Uint8Array` form as the predict
  line). A new unit guard asserts no grafted builder name collides with a
  sub-client prototype method.
- **Internal: symmetric two-line source layout.** (#55) The perp product line
  moved from the `src/` root into `src/perp/` (`client.ts`, `config.ts`,
  `config-view.ts`, `constants.ts`, `fetch.ts`, `tx-builders.ts`, `index.ts`,
  `user/`), mirroring `src/prediction/`. The root now holds only the umbrella
  (`sdk.ts`, `unified-client.ts`), the shared `base-client.ts`, shared primitive
  `constants.ts`, and the shared `account/` / `utils/` / `core/` / `generated/`
  dirs. Public entry points are unchanged: `@waterx/sdk`, `@waterx/sdk/perp`, and
  `@waterx/sdk/perp/*` resolve as before (the `exports` map now points `./perp`
  at `dist/src/perp/`). Perp-domain enums split into `perp/constants.ts` (which
  re-exports the shared primitives), so `@waterx/sdk/perp/constants` is unchanged.
- **Internal: split the two oversized perp files by domain.** (#55)
  `perp/tx-builders.ts` (992 LOC) and `perp/fetch.ts` (915 LOC) became thin
  barrels over per-domain modules under `perp/tx-builders/`
  (common / consolidate / trading / wlp / rewards / credit) and `perp/fetch/`
  (simulate / market / positions / referral / account / custody / bridge), each
  ≤ ~285 LOC. The barrels re-export the full public surface unchanged
  (`@waterx/sdk/perp/tx-builders`, `@waterx/sdk/perp/fetch`, and the flat
  `@waterx/sdk/perp` namespace resolve as before).

- **Generic wxa builders are now line-agnostic (`WxaClientLike`) — shared by both
  the perp and prediction lines.** The shared `account/` create-account / delegate /
  alias builders were typed to the funding-capable `AccountClientLike`; they only
  need `waterx_account` + `bucket_framework`, so they are retyped to the narrower
  **`WxaClientLike`** (`account/client.ts`), which **both** `PerpClient` and
  `PredictClient` satisfy structurally (CI-enforced by `wxa-capability.test.ts`).
  `AccountConfig` / `AccountPackages` now extend `WxaConfig` / `WxaPackages`.
  The **entire generic wxa account framework** in prediction now **delegates to the
  shared `account/` builders** — `createAccount`, `addDelegate`, `removeDelegate`,
  `requestDeposit`, `requestWithdraw`, `transferCoinToAccount`,
  `requestDepositFromReceivings` (prediction keeps its public wrapper signatures +
  `settlementCoinType` defaulting). Since `waterx_account` is a single shared
  contract, these are the same on-chain calls; verified byte-equivalent by the PTB
  snapshot tests — the only delta is `Result` vs `NestedResult` for the
  sender-request handle on the request-signed ops, which is equivalent for a
  single-return Move call and is the form perp already ships. Only genuinely
  prediction-specific account ops stay line-side: the prediction-protocol permission
  config (`setDelegatePredictionPermission`, `whitelist`/`allow`/`disallow protocol
asset`) and the `direct_rule` same-coin consume helpers (thin wrappers over the
  shared generated `direct_rule`).
- **Account/funding config schema hoisted into `account/config.ts`; `account/`
  now imports nothing from `perp/`.** The account/funding/referral package
  interfaces (`BasePackageEntry`, `WxaAccountPackage`, `WaterxCreditPackage`,
  `NativeCustody*`, `WormholeBridgePackage`, `WithdrawalQueuePackage`,
  `WaterxReferralPackage`, `WormholeInfraConfig`) plus new `AccountPackages` /
  `AccountConfig` types now live in `src/account/config.ts`. `perp/config.ts`
  imports + re-exports them (so `@waterx/sdk/perp` type imports are unchanged) and
  `WaterXPackages extends AccountPackages`. `AccountClientLike` is now typed to
  `AccountConfig`, removing the last type-only `account → perp` edge — the base
  layer is fully decoupled (`PerpClient`'s `WaterXConfig` stays assignable to
  `AccountConfig`). Dependency direction is now strictly `perp → account`.
- **Single `generated/` root; `waterx_prediction` is now reproducible by
  `pnpm codegen`.** The prediction line had its own orphaned `src/prediction/generated/`
  (`waterx_prediction` + duplicate `bucket_v2_framework` / `waterx_account` / codegen
  runtime) that was **not** in `sui-codegen.config.mjs`, so `pnpm codegen` could not
  reproduce it. `waterx_prediction` is now registered in the codegen config +
  summaries script and emitted into the shared `src/generated/`; `src/prediction/`
  imports it from there and `src/prediction/generated/` is deleted. Also dropped a
  duplicate `native_custody` codegen entry and taught `scripts/fix-generated-imports.ts`
  to annotate the `Market` / `MarketView` structs (TS2883, they embed the `Outcome`
  MoveEnum). **Note:** regenerating brought all `generated/` packages up to the current
  contract ABI — this surfaces additive contract features (`pyth_rule` max-confidence-bps
  config, `waterx_account::isAccountOwner`, …) and drops unused `*ForTesting` bucket
  helpers; no SDK code referenced the removed symbols.
- **`account/` is now the real base layer; the prediction→perp dependency edge is
  cut.** The account framework + funding (credit / custody / bridge / consolidate /
  wormhole) previously lived under `perp/` and were typed to the concrete
  `PerpClient`, so `account/index.ts` re-exported **up** into `perp/user/*` and
  `prediction/tx-builders.ts` imported `perp/` for the wxUSD consolidate sweep
  (dependency arrows running backwards). The whole cluster now lives under
  `src/account/` (`account.ts`, `account-request.ts`, `waterx-account.ts`,
  `referral.ts`, `funding/{credit,custody,wormhole,balance,consolidate}.ts`) and is
  retyped to a new **`AccountClientLike`** capability interface (`account/client.ts`)
  that `PerpClient` satisfies structurally — no builder imports `PerpClient`
  anymore. `prediction/tx-builders.ts` imports the sweep from `account/funding/`
  and no longer imports `perp/` at all. The `@waterx/sdk/perp` barrel still surfaces
  all of these builders unchanged — `perp/user/index.ts` and `perp/index.ts` now
  re-export them from `account/` — so the main public entry is identical; only the
  un-advertised granular deep paths (`perp/user/<file>`, `utils/{wormhole,
account-request,consolidate-balance}`) moved. `src/core/waterx-account.ts` folded
  into `account/`. (The config-schema hoist and the single-`generated/`-root
  unification that this entry once deferred are now done — see the entries above.)

- **Oracle / rule code split out of `utils/pyth.ts` into a dedicated `src/oracle/`
  module.** The old `utils/pyth.ts` had fused four concerns into one file (Pyth
  Hermes/update PTB, the `pyth_sponsor_rule` flow, **and** `supra_rule` /
  `constant_rule` feeds via the aggregation orchestrator). It is now decomposed:
  - `oracle/pyth.ts` — Pyth as a price _source_ only (Hermes REST + on-chain
    update PTB + `PythCache`); imports **no** rule package.
  - `oracle/rules/{pyth-rule,supra-rule,constant-rule,sponsor}.ts` — one file per
    oracle rule (Pyth no longer "contains" Supra).
  - `oracle/aggregate.ts` — the single orchestrator that composes rules into a
    collector and aggregates (`aggregateTicker` / `refreshOraclePrices` / …).
  - `oracle/host.ts` — new `OracleHost` structural interface; the oracle code no
    longer depends on the concrete `PerpClient` (which satisfies `OracleHost`
    without an `implements` clause). The public API surface (`refreshOraclePrices`,
    `PythCache`, `openPythSponsorFund`, …) is re-exported unchanged from
    `oracle/index.ts`; only the internal import path moves
    (`utils/pyth.ts` → `oracle/`).
- **Oracle config hoisted into `oracle/config.ts`; the last base→product type
  edge is gone.** (#55) `oracle/host.ts` imported `WaterXConfig` / `PythInfraConfig`
  from `perp/config.ts`, leaving one residual oracle→perp type edge. The oracle-rule
  package schema (`PythRulePackage`, `PythSponsorRulePackage`, `SupraRulePackage`,
  `WaterxConstantRulePackage` + `ConstantFeedEntry` / `SupraFeedEntry`,
  `WaterxOraclePackage`) plus `PythInfraConfig` / `PYTH_DEFAULTS` and the new narrow
  `OracleConfig` / `OraclePackages` now live in `src/oracle/config.ts`.
  `OracleHost.config` is typed to `OracleConfig`, so the oracle layer imports
  **nothing** from `perp/`. `perp/config.ts` imports + re-exports them (so
  `@waterx/sdk/perp` type imports are unchanged) and `WaterXPackages extends
AccountPackages, OraclePackages`.
- **Referral reads consolidated under the `account/` base.** (#55) The referral
  queries (`getRefererFor` / `isValidReferralCode` / `referralCodeExists`) were
  split off from their builders and needlessly typed to `PerpClient` in
  `perp/fetch/referral.ts`. They move to `account/fetch/referral.ts` (co-located
  with the `account/referral.ts` builders) retyped to `WxaClientLike`, and the perp
  `fetch.ts` barrel re-exports them — the `@waterx/sdk` / `@waterx/sdk/perp` surface
  is unchanged. The generic simulate/decode plumbing also moves to the base
  (`account/fetch/simulate.ts`); `perp/fetch/simulate.ts` re-exports it and keeps
  only the perp-only `withLp`. `DRY_RUN_SENDER` (the zero-address simulate sender)
  is hoisted from `perp/constants.ts` to the shared `constants.ts` and re-exported
  for back-compat.

### Added

- **`@waterx/sdk/account` and `@waterx/sdk/oracle` subpath exports.** (#55) The
  shared base layer (account framework + funding + referral) and the oracle module
  are now part of the published surface via `./account`, `./account/*`, `./oracle`,
  and `./oracle/*` package exports.

## [2.4.1] - 2026-06-24

### Added

- **Staking permission bitmasks exported.** New `STAKING_PERM_DEPOSIT_STAKE` /
  `STAKING_PERM_REDEEM_STAKE` / `STAKING_PERM_CLAIM_REWARD` / `STAKING_PERM_ALL`
  constants (matching `waterx_staking.move`), re-exported from the package root.
  Lets delegate-scoping callers compose staking permission masks symbolically
  the same way they already can for perp and prediction. (#53)

## [2.4.0] - 2026-06-24

### Changed

- **Rule config schema: `constant_rule` / `supra_rule` now follow `pyth_rule.feeds`.**
  Every oracle-rule package uses a `feeds: { TICKER: { … } }` map of per-ticker
  objects instead of scalar maps. The `waterx_constant_rule` package key is renamed
  to **`constant_rule`** (matching `pyth_rule` / `supra_rule`): `prices` (ticker →
  price string) → `feeds` (ticker → `{ price }`). `supra_rule`: `pairs` (ticker →
  number) → `feeds` (ticker → `{ pair_id, tolerance_ms? }`). New `ConstantFeedEntry`
  / `SupraFeedEntry` exports.
- **Oracle routing unified — one `aggregateTicker`; `dual_feed` flag + the dual
  helper/predicates removed.** A ticker is fed by every rule it is configured for:
  Pyth if it has a `pyth_rule.feeds` entry, Supra when enabled, Constant when it is
  a constant ticker — "feed rule R for ticker T iff T ∈ R.feeds". "Dual-feed"
  (Pyth + Constant) and "constant-only" fall out of membership, so the `dual_feed`
  flag is gone and a constant ticker is dual while it still has a Pyth feed, then
  constant-only once removed from `pyth_rule.feeds`. **Removed** `aggregateTickerWithDual`,
  `WaterXClient.isDualFeedTicker`, `WaterXClient.isConstantOnlyTicker`; added
  `aggregateTicker`. `aggregateTickerWithPyth` / `aggregateTickerWithConstant` stay as
  thin wrappers. **Breaking config-schema + API change** — the `waterx-config` JSON +
  keeper parser must move in lockstep (parser-first). (#51)

### Added

- **`getSpendableCreditBalance`** — read helper returning internal wxUSD slot +
  parked backing assets (same probe as `appendConsolidateToUsd`) plus CREDIT at
  the account address; `totalRaw` matches post-`appendConsolidateForSpend`
  spendable balance. (#49)
- **`appendConsolidateForSpend` / `appendConsolidateAddressCredit`** — pre-sweep
  backing assets (PSM) plus address CREDIT into the internal wxa slot; used by
  async tx-builders when `consolidateToUsd` is enabled (default). (#49)
- **`@waterx/sdk/prediction` `buildPlaceOrderTx` / `buildBatchClaimTx`** — async
  prediction builders with the same optional pre-sweep (requires `WaterXClient` +
  `PredictClient`); unified `Client.buildPredictPlaceOrderTx` /
  `Client.buildPredictBatchClaimTx` wrap both line clients. (#49)
- **`src/utils/consolidate-balance.ts`** — shared probe/rescale helpers used by
  the read path and `appendConsolidateToUsd` (refactored to reuse the probe). (#49)

## [2.3.0] - 2026-06-21

### Added

- **Unified package `@waterx/sdk`.** Renamed from `@waterx/perp-sdk`; publish under the new
  name. Subpath exports: `@waterx/sdk`, `@waterx/sdk/perp`, `@waterx/sdk/prediction`.
  `@waterx/perp-sdk@<=2.2.2` remains on npm — deprecate after publish, do not overwrite.
- **Prediction markets merged in.** Former `@waterx/predict-sdk` API lives at
  `@waterx/sdk/prediction`; unified `Client` facade (`client.perp.*` / `client.predict.*`).
  Includes full `waterx_prediction_gift` / claimable-link runtime (`createGift`,
  `claimShare`, `buildCreateGiftFlow`, `getGift`, …) ported from `@waterx/predict-sdk`.
  Explicit `./prediction/user` and `./prediction/utils` package exports match the
  old `@waterx/predict-sdk/user` and `/utils` subpath contract.
- **Effective-collateral margin math.** Two offline helpers in `utils/math`:
  - `calcEffectiveCollateralUsd(...)` — mirrors `calculate_effective_collateral_amount`
    in `trading.move` (gross − borrow − trading fees − funding-when-owed − optional
    closing fee). This is the collateral the contract actually uses for leverage /
    min-collateral checks; displaying leverage or max-reducible off **gross**
    `collateral_amount` is the long-standing UI bug (a position reads e.g. 23.3x on
    gross while the contract sees ~24.9x on effective).
  - `calcMaxReducibleCollateralUsd(...)` — the true "最大可减少" for an adjust-margin
    UI, taking the min of all three post-withdrawal checks in
    `execute_withdraw_collateral` (max leverage, min collateral, not-liquidatable),
    all on effective collateral. Returns a USD figure; convert to the
    `withdrawCollateralRequest` `amount` via
    `floor((usd / collateralPriceUsd) * 10 ** collateralDecimal)`.
- **Dual-feed transition routing for constant tickers.** A new `waterx_constant_rule.dual_feed`
  list (subset of `prices`) marks tickers mid-migration: `refreshOraclePrices` feeds them via _both_
  `pyth_rule::feed` and `constant_rule::feed` into one collector (new `aggregateTickerWithDual`), so
  the aggregator can hold the `{Pyth, Constant}` weight set without an `EMissingPriceSource` window
  while rule weights are flipped (on-chain `aggregator::remove_outliers` requires every weighted rule
  present in the collector). New `WaterXClient.isDualFeedTicker` / `isConstantOnlyTicker`; dual
  tickers keep the Pyth update, constant-only tickers still skip it. Enables the zero-downtime
  (path A) rollout in the `waterx-contract` USDCUSD runbook. (#46)
- **`getBridgeFee(client, { evmDestinationChain, amount, creditType? })`** — one-shot read of the
  v4 `withdrawal_queue` bridge-fee estimate in a single `simulate`, returning a typed
  `BridgeFeeView` (`feeAmount` / `wouldExecute` / `effectiveRate` / `effectiveMinFee` /
  `netAmount`). Surface "estimated fee" UI off `wouldExecute`, not `feeAmount` alone. (#43)
- **`withdrawal_queue` v4 bindings** — regenerated for the bridge fee + per-chain min-fee floor. (#43, was #40)
- **`waterx_supra_rule` codegen + second-rule feed support.** (#43, was #42)

### Changed

- **Route the `USDCUSD` collateral ticker through `constant_rule` ($1) instead of Pyth** —
  `waterx_constant_rule` codegen plus `aggregateTickerWithConstant` wiring in
  client / config / pyth utils. (#43, was #41)

### Fixed

- **`WaterXClient.isConstantTicker()` now requires the constant rule to be fully wired**
  (`published_at` + `config`) before routing a ticker off Pyth. A half-populated
  `waterx_constant_rule` block (prices listed mid-rollout, before the rule is deployed)
  previously made the ticker skip Pyth and then threw in `aggregateTickerWithConstant`,
  aborting the whole price-refresh PTB; it now falls back to Pyth. Mirrors the keeper's
  all-or-nothing guard. (#43)

### Migration

| Old import              | New import                                     |
| ----------------------- | ---------------------------------------------- |
| `@waterx/perp-sdk`      | `@waterx/sdk` (flat perp re-export deprecated) |
| `@waterx/perp-sdk/perp` | `@waterx/sdk/perp`                             |
| `@waterx/predict-sdk`   | `@waterx/sdk/prediction`                       |
