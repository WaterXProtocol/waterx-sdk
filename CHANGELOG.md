# Changelog

All notable changes to `@waterx/sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries
reference the PR that introduced them.

**Versioning policy — SemVer syntax, but NOT the SemVer compatibility promise.** Version
numbers are [Semantic Versioning](https://semver.org/spec/v2.0.0.html)-shaped, and this
package MAY ship a breaking change in a PATCH or MINOR release. Every consumer is
first-party and pins the SDK **exact**, so no consumer takes a break implicitly; a
`^`-range consumer would, and none exists. `4.0.1` and `4.3.3` shipped breaking as
patches; `4.1.0` and `4.3.0` as minors. Each such release NAMES its breaking changes at
the top of its section — read that note before upgrading, and do not infer compatibility
from the version number alone.

## [Unreleased]

_Slated as **4.4.0**. Ships **BREAKING** removals: **Pyth Core (`pyth_rule`) is gone from
the SDK**, and with it the entire on-chain update-fee apparatus. Read the Removed section
before upgrading. `pyth_lazer_rule` and `waterx_rule` are unaffected as WRITE sources._

#### First-party consumer migration

Both consumers pin exact, so nothing breaks until they bump. What each has to change:

- **`bucket-backend-mono`** (`apps/waterx`): `config.packages.pyth_rule.feeds` in
  `waterx-registry.service.ts` + `scripts/backfill-candles.ts` (use
  `configuredOracleRules` / a rule block that still exists); `perp.getPythFeed(...)` in
  `wlp/wlp-tx.service.ts`; `new PythCache()` + `refreshOraclePrices(..., { cache })` in
  `campaign/position/campaign-position.service.ts`; and any `ORACLE_SOURCE` still naming
  `pyth_rule`. A `bootWaterXSdk` feeds assert on `packages.pyth_rule` should be deleted —
  the SDK no longer fails on a missing rule block.
- **`waterx-fe`** (`src/libs/server`): `resolveHermesReadEndpoint` +
  `pythCoreHermesEndpoint` (`oracleSource.ts`, `pyth/hermesFetch.ts`, `pyth/hermes.ts`)
  and the `plane === 'hermes'` arm in `oraclePrices.ts`. Since `pyth_lazer_rule` is now
  write-only, **Lazer-priced tickers must be read from the quote-center** — route them
  through the `waterx_rule` plan instead of a Hermes fetch.

### Removed

- **Pyth Core (`pyth_rule`) — the source, the rule, and everything that existed only to
  serve it.** Deleted: `src/oracle/pyth.ts` (Hermes REST + the on-chain update PTB),
  `PythCoreRule`, `feedPythRule`, `src/oracle/rules/sponsor.ts`, and the generated
  `waterx_pyth_rule` / `pyth_sponsor_rule` bindings (also dropped from
  `sui-codegen.config.mjs` + `scripts/codegen-summaries.ts`). `ORACLE_SOURCES` is now
  exactly `pyth_lazer_rule | waterx_rule`, so a stale `ORACLE_SOURCE=pyth_rule` is
  rejected by `parseOracleSourceList` / the `PerpClient` ctor rather than silently
  routed. A config that still ships a `packages.pyth_rule` block is ignored.
  - **Deployment ordering:** the SDK can no longer emit a `pyth_rule::feed` leg, so an
    aggregator that still weights `PythRule` on chain will abort `EMissingPriceSource`.
    Drop those weights **before** shipping this version to that network.
- **The update-fee apparatus**, which only Pyth Core ever needed: `OracleFeeSource`,
  `OracleFeeSourceUnavailableError`, `PriceUpdateRule.requiresFeeSource`, `PythCache`,
  and the `allowGasFee` / `useSponsor` / `pythCache` build options on every `build*Tx`.
  `BuildUpdateOpts` is now empty (kept as the extension point).
  `refreshOraclePrices` no longer takes `cache` / `feeSource`. Every remaining source
  verifies a signature and pays nothing, so **a WLP mint no longer needs
  `allowGasFee: true`** and works inside an Enoki-sponsored transaction.
- **The Hermes read plane.** `PythRulePackage` (and `PythSponsorRulePackage`) left
  `OraclePackages`; `resolveHermesReadEndpoint`, `pythCoreHermesEndpoint`,
  `pythProHermesEndpoint`, `PYTH_PRO_HERMES_ENDPOINT`, `PYTH_CORE_INFRA`,
  `HermesEndpointRejectedAllFeedsError`, `fetchPriceFeedsUpdateData`,
  `endpointSupportedFeedIds`, `probeMissingFeeds`, `buildPythPriceUpdateCalls`, and
  `updatePythPrices` are all gone. `OracleReadPlan` loses its `"hermes"` arm.
  - **`pyth_lazer_rule` is now WRITE-ONLY.** It pushes with integer feed ids but every
    off-chain price READ was keyed by the hex ids `pyth_rule.feeds` carried, so
    `resolveOracleReadPlan(host, "pyth_lazer_rule", …)` returns `{ plane: "none" }` and
    reports every lazer-written ticker as `unreadable`. **A price facade reading Lazer
    prices through the SDK must move to the quote-center** (`waterx_rule`; on mainnet
    its feed set is a superset of Lazer's) or to its own source.
- `getPythFeed` (on `PerpClient`, `PerpConfigView`, and the `OracleHost` interface),
  `aggregateTickerWithPyth`, and `OracleHost.grpcClient` (the oracle module no longer
  makes any on-chain read). `aggregateTicker` loses its `priceInfoObjectId` arg.
- `scripts/pyth-tolerance-show.ts` and `scripts/set-pyth-tolerance.ts`.

### Changed

- **Every oracle-rule package block is optional, and a requested ticker no listed
  source can price is SKIPPED instead of failing the tx-build.** Testnet retired
  `pyth_rule` on chain — first emptying `packages.pyth_rule.feeds`, then dropping the
  block entirely — while consumers still ran `ORACLE_SOURCE=waterx_rule,pyth_rule`. The
  SDK broke twice over that: `loadConfig` REQUIRED `packages.pyth_rule.published_at` for
  a perp config, and `refreshOraclePrices` threw
  `oracleSource [...] has no feed configured for ticker(s): …`. Both were asserting a
  deployment shape the SDK does not own. Now `validateConfig` requires NO oracle rule
  package (only `waterx_oracle`, the shared object every rule feeds), and the fed set
  names what a client is WILLING to push while the config decides what it CAN — a listed
  source with no block, or with empty feeds, contributes nothing at init AND at
  tx-build.
- `refreshOraclePrices` returns `OracleRefreshSummary` (`{ refreshed, skipped }`)
  instead of `void`, so a caller can log/alert on tickers that went unpriced.
  Purely additive for callers that ignore the result. Servability is deliberately
  narrow: a ticker needs no update leg only when `constant_rule` is the ONLY rule the
  config wires for it — a dual-feed ticker whose price source did not run is skipped
  rather than aggregated off the constant leg alone, which would starve the other
  weighted rule (`EMissingPriceSource`).
- `getCollateralAssets` filters WLP pool tokens by **any** configured rule
  (`pyth_lazer_rule` / `waterx_rule` / `constant_rule`) instead of `pyth_rule.feeds`
  alone, so retiring a rule does not strand the pool's collateral refresh.

### Added

- `oracle/feeds.ts` — `configuredOracleRules(config, ticker)` /
  `hasConfiguredOracleFeed(config, ticker)`, the config-only "which rules is this ticker
  wired for" read (exported from `@waterx/sdk`). Consumers doing boot checks or
  market/collateral filters use this instead of reaching into a specific rule block.
- `OracleRefreshSummary` is exported from `@waterx/sdk` and `@waterx/sdk/perp`.

## [4.3.3] - 2026-08-18

_Released as a PATCH carrying one **BREAKING** type change: `WaterxUpdatePayload` is now
a union (`WaterxLeafPayload | WaterxEnvelopePayload`), so `payload.envelope` no longer
type-checks on it — route through `waterxEnvelopeOf` / `waterxLeavesOf` instead. Only
code that HOLDS a `WaterxUpdatePayload` (an `UpdateDataProvider` prefetch cache) is
affected; the runtime shape of an envelope payload is unchanged. Both first-party
consumers pin exact and adapt in the same change set._

### Added

- `waterxLeavesOf`, `parseSignedLeaves`, `MERKLE_ROOT_INTENT`, and the
  `WaterxSignedLeaf` / `WaterxLeafPayload` / `WaterxEnvelopePayload` /
  `WaterxUpdatePayload` types on the root, `@waterx/sdk/perp`, and
  `@waterx/sdk/oracle` surfaces (#88) — a prefetch cache implementing
  `UpdateDataProvider` needs the leaf accessor next to `waterxEnvelopeOf`, since
  leaves are now the default wire shape.
- **Integration docs: a first-integration walkthrough, a shipped Skill, and a docs link
  check** ([WL-2022](https://bucketprotocol.atlassian.net/browse/WL-2022)).
  - `.claude/skills/waterx-sdk-integration/SKILL.md` — the fixed integration flow
    (entry point → required options → account → funding → build/simulate/execute →
    reads), with a red-flags list and an abort/error table. Ships **inside the npm
    package** (`files` names the SKILL.md path explicitly, so a second skill is a
    deliberate publish decision rather than a directory glob), so a consumer can
    `cp -r node_modules/@waterx/sdk/.claude/skills/… .claude/skills/`. Indexed by the
    new root `SKILLS.md`.
  - `examples/quickstart.ts` — the README's **First integration** walkthrough as one
    runnable file. It is the snippet's source of truth, so `pnpm lint` and
    `pnpm typecheck` keep the documented code from drifting.
  - `pnpm docs:check` (`scripts/check-docs-links.ts`) — resolves every relative link in
    `git ls-files '*.md'`, so a new doc is covered the moment it is tracked; exclusions
    are named in an `IGNORED` map, never implicit. Wired into `pnpm check` **and** the
    CI `Lint` job (`pnpm check` is not the CI contract in this repo, so `check` alone
    would never have run it). It found and fixed one already-broken link in
    `test/perp/README.md`.
  - README gains consumer-oriented **Install** (peer deps, Node ≥ 22, ESM+CJS), **First
    integration**, **Troubleshooting**, and a **Documentation map**.

### Changed

- **`waterx_rule` now feeds prices through `collect_single_with_proof`, not
  `collect_batch_latest` (#88).** `WaterxRule.fetchUpdateData` pulls one signed
  Merkle leaf per ticker (`GET /v1/quotes/leaves`) instead of one batch envelope,
  and the feed leg submits that single leaf with its proof. A batch envelope's
  signature covers the WHOLE item vector, so the old path had to rebuild every
  item in-PTB even to use one symbol's price — 29 items (58 moveCalls, ~320 pure
  inputs) per trade against the mainnet registry, three short of the on-chain
  `MAX_BATCH_SIZE` of 32. The leaf path costs one item plus ~log2(n) proof
  hashes, whatever the snapshot's width.
  - **Automatic fallback, no coordinated deploy needed:** a quote-center with no
    leaf route (404) transparently gets the previous envelope +
    `collect_batch_latest` behavior. Every other status throws instead of falling
    back (a 5xx means the service is degraded and the envelope route would fail
    the same way; note 501 cannot signal a missing route, since `fetchWithPolicy`
    classifies all 5xx as retryable).
  - `narrowUpdateData` now SUBSETS leaves per symbol (each verifies
    independently), so a whole-universe prefetch cache yields one leaf per trade
    instead of the entire basket. Envelopes stay indivisible.
  - `aggregateTicker` takes a new optional `waterxLeaf`; `waterxEnvelope` still
    works and is used for the fallback. Passing both prefers the leaf.
  - Regenerated `src/generated/waterx_rule` — the committed bindings predated the
    Merkle entrypoints, so `collectSingleWithProof` did not exist.
- **BREAKING (types): `WaterxUpdatePayload` is now a union, not an object with an
  `envelope` field (#88).** It went from `interface { envelope: WaterxSignedEnvelope }`
  to `WaterxLeafPayload | WaterxEnvelopePayload`, so `payload.envelope` no longer
  type-checks on it — a consumer holding one (e.g. an `UpdateDataProvider` cache)
  must route through `waterxEnvelopeOf` / `waterxLeavesOf`, which narrow to the
  variant actually present. Runtime shape of an ENVELOPE payload is unchanged; what
  changed is that a payload may now carry leaves instead.

### Fixed

- Signed-integer JSON parsing no longer crashes on a display float whose token is
  lexically integral (#88). `parseWithExactIntegers` decided integrality from the
  PARSED value, so a `"confidence": 0.0` (which Rust `f64` really does emit, and
  `JSON.parse` hands back as the number `0`) reached `BigInt("0.0")` and threw
  `SyntaxError` — failing every fetch that included such a leaf before a PTB was
  built. Integrality is now decided from the source token (`-?\d+`), leaving
  decimal and exponent tokens as numbers.
- **`pnpm oracle:aggregates` now accepts a fed-set LIST** (WL-2022). The script kept a
  local copy of the oracle-source list and validated with a single-value `includes()`,
  so `ORACLE_SOURCE=pyth_rule,pyth_lazer_rule` — the value the README, the examples, and
  the Skill all tell you to export before running this exact diagnostic — exited 1 with
  "Unknown oracle source". The copy was also already stale, omitting `waterx_rule`. It
  now uses the SDK's own `parseOracleSourceList` / `ORACLE_SOURCES`.
- **`examples/` no longer hardcodes a single oracle source** (WL-2022). `buildClient()`
  pinned `oracleSource: "pyth_rule"`, but testnet weights majors such as `BTCUSD` for
  **both** `pyth_rule` and `pyth_lazer_rule` — so every oracle-backed example aborted
  `EMissingPriceSource` at simulate. It now reads `ORACLE_SOURCE` through
  `parseOracleSourceList` and forwards `PYTH_API_KEY` as `pythApiKey`, matching the
  env-driven wiring the README prescribes for real consumers. The default is the pair,
  because an absent Lazer key fails with `LazerApiKeyMissing` — which names what to set
  — where the old default failed with an opaque on-chain abort. Only the 16 oracle-backed
  examples reach either path; the other 34 need no oracle leg.
- **`docs:check` no longer passes from the wrong directory.** It resolved paths against
  `process.cwd()`, so running it from a subdirectory found zero docs and exited **0** —
  a silent green. It now resolves against the repo root (`REPO_ROOT`) and lets a missing
  tracked doc throw rather than skipping it.
- **Stale paths in `CLAUDE.md`**: `account.ts`, `custody.ts`, `credit.ts`, and
  `referral.ts` were still listed under `perp/user/` after the move into the `account/`
  base. `perp/user/` has five files, none of them those.
- **"Mainnet config is not published" was stale**
  ([#86](https://github.com/WaterXProtocol/waterx-sdk/pull/86)). `mainnet.json` is live in
  the config repo and `MAINNET` loads (30 markets, prediction included), so the
  Troubleshooting row steered valid mainnet integrators to testnet for no reason. Replaced
  with the failure they actually hit: mainnet configures `pyth_rule` + `constant_rule`
  only — no `pyth_lazer_rule` / `waterx_rule` block — so an `ORACLE_SOURCE` copied from
  testnet that names only those fails at tx-build. Same correction in `CLAUDE.md`.
- **Client snippets that list `pyth_lazer_rule` now pass `pythApiKey`** (#86). The
  umbrella and per-line recipes in the README, and Step 2 of the shipped Skill, selected
  Lazer without the credential it requires — an oracle-backed build copied from them threw
  `LazerApiKeyMissing`.
- **`examples/quickstart.ts` no longer points at an account that was never created** (#86).
  Simulate-only is the default, and a dry run emits `AccountCreated` just like a real one,
  but creates nothing — so the "take the id, fund it, re-run" instruction dead-ended on the
  standard path. `simThenMaybeExecute` now reports whether the tx actually landed, and the
  example only presents a reusable id after a successful execute.
- **`WATERX_EXECUTE=1` now prints the account id it just created** (#86). The previous fix
  stopped the example claiming an id that did not exist, but on the success path it still
  only told the operator to "take `account_object_address` from the AccountCreated event
  above" — and nothing had ever printed that event, so `WATERX_ACCOUNT_ID` was
  unobtainable and the walkthrough dead-ended one step later instead. `simThenMaybeExecute`
  now returns `{ executed, digest }`, and a new `accountIdFromDigest` helper reads the id
  back off the digest (decoding the event's `bcs`, not its `json`, whose field shapes are
  documented as varying per RPC implementation). `quickstart.ts` prints the ready-to-paste
  `export WATERX_ACCOUNT_ID=0x…`; `actions/action-create-account.ts`, whose header always
  claimed the id "lands in the AccountCreated event", now prints it too. README step 3 and
  the Skill's step 3 gain the read-back they only described.
- **The shipped Skill's snippets are copy-pasteable** (#86). Step 2 called
  `parseOracleSourceList` and `WaterXClient.create` with no import line, step 3 used
  `Transaction`, and step 5 used `rawPrice` — so every snippet failed on paste with an
  undefined identifier. Each block now carries its imports (`@waterx/sdk`,
  `@waterx/sdk/oracle`, `@waterx/sdk/perp`, `@mysten/sui/transactions`).
- E2E mainnet discovery no longer burns 180s+ `beforeAll` hooks when env/canonical
  wxa hints miss (#87): `resolveCustodyWxaRow` skips the all-market WLP/USDC
  fallback on mainnet (set `WATERX_E2E_WXA_ACCOUNT_ID` + `WATERX_E2E_WXA_OWNER`
  instead); `collectWxaAccountIdCandidates` likewise skips market/probe scans on
  mainnet and memos per client; `resolveCustodyWxaRow` is memoized across
  credit/custody suites. `scripts/run-e2e.ts --mainnet` / `--testnet` rewrites
  `WATERX_CONFIG_URL` `testnet.json` ↔ `mainnet.json` when the env URL disagrees
  with the CLI network (shared `waterxConfigUrlForNetwork` in `load-repo-env.ts`;
  `oracle:aggregates` uses the same helper).
- Predict e2e fixtures: `openOrderId` / `openMarketId*` require an **unresolved**
  market (#87); order PTBs no longer fall back to legacy `orderId` /
  `marketIdBytes`. Keeper `fillOrder` does not skip on `EMarketAlreadyResolved`
  (surfaces discovery/fixture bugs); seed markets that later resolve are dropped.
  Market resolution lookup is tri-state (`true` / `false` / unknown) — RPC failures
  no longer count as unresolved; env openOrder fallback ignores legacy `orderId`.

## [4.3.2] - 2026-08-05

### Changed

- **Pyth Lazer on mainnet: the v2 verify entry, and a 1000ms fetch channel**
  ([#85](https://github.com/WaterXProtocol/waterx-sdk/pull/85)).
  `LAZER_INFRA` gains `verify_entry` and `channel` per network, because both
  now differ between them:
  - **mainnet** calls `pyth_lazer::parse_and_verify_le_ecdsa_update_v2` on the
    v2 package `0xefbfd064…` and requests `fixed_rate@1000ms`. The rule was
    republished v2-bound (waterx-contract) after a 2026-08-05 mainnet probe
    found the v1 path dead twice over: the ORIGINAL package `0x7b502c…` aborts
    `EDifferentVersion` in `state::current_cap` for _any_ payload — the shared
    `State` has been migrated past that code — and the v1 entry aborts
    `EInvalidChannel` in `channel::from_v2` on `fixed_rate@1000ms`, which is
    the only channel WaterX's Pyth Pro grant still permits (200ms →
    _"violates rate limit. Minimum allowed channel is 1000ms"_).
  - **testnet** is unchanged (`parse_and_verify_le_ecdsa_update`,
    `fixed_rate@200ms`): its Lazer package is still the v1-only publish with no
    `update_v2` module, and its rule is v1-bound, so the v1 entry is the only
    one that exists — and it aborts on the 1000ms channel.

  No public API change; `LAZER_INFRA` is exported, so deep importers see two
  new fields. Consumers on mainnet need this to build a Lazer PTB at all.

## [4.3.1] - 2026-08-04

### Added

- `parseOracleSourceList(raw)` + the canonical `ORACLE_SOURCES` value list
  (#84) — THE `ORACLE_SOURCE` env-string parser consumers fold onto (split on `,`,
  trim, DROP empty entries, validate every entry, dedupe order-preserving,
  throw operator-actionably on empty/invalid). The FE and BE previously
  carried twin hand-written parsers whose semantics drifted once in review
  (a trailing comma booted one deployment green and 500'd the other);
  the semantics now live in one exported function — and STRICTER than both
  consumers' `in`-operator checks: an entry named like an
  `Object.prototype` key (`toString`, …) passed those and died deep in the
  stack; the Set-based check rejects it at parse. Zod adopters must wrap
  the throw into `ctx.addIssue` (pattern in the module header) or a single
  bad entry masks sibling env issues at boot. `ORACLE_SOURCES`
  is the single authority the `OracleSource` union DERIVES from (drift is
  impossible by construction), a test pins every canonical value to a
  registered rule, and `PerpClient` construction validates against the same
  list — the env parser and the client front door can never disagree.
- `waterxEnvelopeOf` is re-exported from `@waterx/sdk/oracle` and `perp`
  (#84) —
  the rule-owned payload accessor (kind-check + unwrap in one place). A
  consumer prefetch cache hand-cast the payload shape and shipped a
  silently-dead guard; deep-importing `oracle/rules/waterx-rule` is no
  longer necessary to do it right.
- `isOracleSource(value)` type predicate (#84) — the ONE runtime
  `ORACLE_SOURCES` membership check; `parseOracleSourceList` and
  `PerpClient`'s ctor validation both call it, so the env parser and the
  create-option front door share a single implementation instead of two
  agreeing ones.

### Fixed

- Prototype-chain ticker lookups closed EVERYWHERE, not just where `in` was
  spelled (#84): every externally-keyed config-record read (`feeds`,
  `markets`, `aggregators`, `pool_tokens`, and the alias-keyed
  `rewarders`/`pools` staking maps — read-plane resolution, waterx/lazer/core
  rule fetch paths, `PerpConfigView` getters, `getCollateralAssets`, the
  staking pool resolver) now funnels through an own-key `ownEntry` helper. Previously a ticker named like an
  `Object.prototype` key (`toString`, …) read as an inherited Function:
  classified `unreadable` by `resolveOracleReadPlan`'s hermes arm and — on
  the write path — passed the waterx/lazer feed-listing throws and reached
  the network.

## [4.3.0] - 2026-08-04

_Oracle-source decoupling, completed for ALL THREE sources: every oracle
source is fully self-contained — its endpoints and on-chain object ids live
with its rule, nothing source-shaped rides on the shared client, and there is
no default source and no cross-source fallback anywhere. Includes `4.1.0`'s
`waterx_rule` (merged), now held to the same per-source contract._

_Released as a MINOR carrying the **BREAKING** entries below, on `4.1.0`'s
rationale (see its note): both first-party consumers pin exact and adapt in
the same change set. Read the migration lines before bumping._

### Removed

- **BREAKING: `client.pyth` carries NO infra anymore.** `PythInfraConfig`
  (`state_id` / `wormhole_state_id` / `hermes_endpoint` on the client) is
  replaced by `PythAccessConfig` — only the caller-supplied `api_key` /
  `fetch` policy. Consumers that read `client.pyth.hermes_endpoint` for their
  own Hermes REST reads must resolve the endpoint per their `ORACLE_SOURCE`
  instead: `pythCoreHermesEndpoint(network)` (new export) when the source is
  `'pyth_rule'`; the source's own configured endpoint otherwise — never a
  Core fallback.
- **BREAKING: `PYTH_DEFAULTS` is removed** from `oracle/config.ts` and the
  `@waterx/sdk/perp` export surface. The Core source's infra now lives in its
  own rule-owned table `PYTH_CORE_INFRA` (`oracle/pyth.ts`), keyed by
  network. `LAZER_DEFAULTS` is renamed `LAZER_INFRA` and moved into
  `oracle/rules/pyth-lazer-rule.ts` — co-located with the only rule that
  reads it (it was internal; the rename is visible only to deep importers).
- **BREAKING: `WATERX_DEFAULTS` / `WaterxInfraConfig` are removed** the same
  way: the quote-center infra is the rule-owned `WATERX_INFRA` table in
  `oracle/rules/waterx-rule.ts` (exported from `@waterx/sdk/oracle`), and
  `client.waterx` slims to `WaterxAccessConfig` — only the caller-supplied
  `waterxEndpoint` / `waterxFetch` overrides. Visible to deep importers of
  `oracle/config`.
- **BREAKING: the waterx fetch policy no longer falls back to `pythFetch`.**
  `resolveWaterxInfra` reads `host.waterx?.fetch` only (was
  `… ?? host.pyth.fetch`) — a consumer that tuned only `pythFetch`
  timeouts/retries now gets the default policy on quote-center fetches; set
  `waterxFetch` explicitly. No compile error: this is a behavior change.

### Changed

- **BREAKING: `oracleSource` is REQUIRED at client creation** (`PerpClient`
  and `WaterXClient` create options). There is no `'pyth_rule'` default: every
  deployment names its source explicitly, wired from the consumer's own env
  var (convention: `ORACLE_SOURCE`, carrying the SDK rule value verbatim).
  Migration: add `oracleSource: <your env>` to every `create(...)` call.
- **BREAKING: multi-source fed sets — `oracleSource` accepts a LIST and
  `client.oracleSource` is renamed `client.oracleSources`** (a normalized,
  deduped, non-empty array; `OracleHost` likewise). One build fetches and
  feeds EVERY listed source's data; the chain's per-ticker aggregator weight
  tables decide which contributions count — feeding an unweighted rule is
  dropped on-chain (harmless), starving a weighted one aborts. This is what
  makes Core→Pro and Pro+Waterx coexistence windows safe: keep the list a
  superset of every ticker's weighted set while weights migrate per ticker.
  A single-value `oracleSource` behaves exactly as before (one-element
  list). `refreshOraclePrices` groups per source; a ticker is unservable
  only when NO listed source has its feed; the fee pre-check fires iff a
  fee-charging source (Pyth Core) is listed with tickers to serve. The
  per-source off-chain fetches run in PARALLEL (all settle before the first
  PTB mutation); the PTB build stays sequential in list order. The
  `UpdateDataProvider` seam is consulted once per listed source per build
  (`get(source, tickers)` — already source-keyed). Construction rejects an
  empty list AND nullish/empty entries (an untyped caller omitting the
  option fails at create, not at the first tx-build).
  **Known concurrency caveat when `waterx_rule` is listed:** the on-chain
  feed call enforces a per-symbol signed-timestamp high-water mark and
  ABORTS `EReplayedSignature` on replay (audit F-014) — regardless of the
  ticker's weights. Two PTBs carrying the same quote-center envelope for the
  same symbol cannot both land; providers/caches must never hand one fetched
  envelope to two concurrent builds for the same symbol (the reference BE
  prefetch cache serves each (symbol, timestamp) at most once), and the
  residual same-enclave-tick collision is only fixable in the contract
  (abstain-on-equal) or the quote-center (per-request monotonic signing).
- **BREAKING: `PriceUpdateRule.kind` narrows `PriceUpdateRuleKind` →
  `OracleSource`.** Only selectable sources implement the port
  (`supra_rule` / `constant_rule` are plain collector-feed helpers); the
  narrower type makes `refreshOraclePrices`'s per-source carry step an
  exhaustive switch. External rule implementations / typed test doubles
  whose `kind` was a non-source value no longer compile.

### Added

- `pythCoreHermesEndpoint(network)` — the Core source's Hermes REST base, for
  consumers (BE/FE read planes) whose `ORACLE_SOURCE` is `'pyth_rule'`.
  Exported from `@waterx/sdk`, `@waterx/sdk/perp`, and `@waterx/sdk/oracle`.
  The full `PYTH_CORE_INFRA` table stays rule-internal (deep import
  `@waterx/sdk/oracle/pyth` if you genuinely need the object ids).
- `waterxQuoteCenterEndpoint(network)` — the waterx source's quote-center
  base (mirrors `pythCoreHermesEndpoint`), plus the `WATERX_INFRA` table.
  Exported root / `perp` / `oracle`.
- `resolveOracleRule(source, overrides?)` — THE `OracleSource` →
  `PriceUpdateRule` registry, now exported from `@waterx/sdk/oracle` so
  consumers (e.g. a BE per-source prefetch cache) resolve through it instead
  of hand-mirroring the map.
- `resolveOracleReadPlan(host, source, tickers)` + `OracleReadPlan` — per-
  source READ-plane resolution: which tickers a source can price off-chain
  and with which ids (pyth sources read through the `pyth_rule.feeds` HEX
  namespace; waterx reads its feeds-listed symbols, an absent block serving
  NOTHING). Plans carry `unreadable` — tickers a source writes on-chain but
  cannot read-price (e.g. a lazer-fed ticker with no hex entry) — so
  consumers surface the config gap loudly.
- `resolveHermesReadEndpoint(network, sources, override?)` +
  `pythProHermesEndpoint()` / `PYTH_PRO_HERMES_ENDPOINT` — the endpoint half
  of the hermes read contract: `pyth_rule` in the fed set → the Core
  source's keyless endpoint; otherwise the deployment `override` (proxy /
  mirror) or the documented Pyth Pro base
  (`https://pyth.dourolabs.app/hermes` — identical for every subscriber,
  auth via the caller's Bearer key). Total, never a throw, never a
  Core-ward fallback.

### Fixed

- `refreshOraclePrices` dedupes its `tickers` input (order-preserving) — a
  repeated ticker previously aggregated TWICE in one PTB: wasted gas under
  every rule, and a hard on-chain ABORT under `waterx_rule` (the second
  `collect_batch_latest` replays the same envelope timestamp —
  `EReplayedSignature`, F-014). Pre-existing on `main`; surfaced by the
  multi-source review.
- `BATCH_PRICE_INTENT` — the quote-center's signing intent, exported so
  read-plane consumers mirror the rule's own envelope intent check.

## [4.1.0] - 2026-07-31

> **Released as a MINOR carrying THREE breaking changes** (deliberate — see the
> versioning policy at the top of this file). Do NOT stop at the removed
> constants; the other two are behavior changes with no compile error to warn
> you:
>
> 1. **Removed exports.** `CRYPTO_FEE_RATE`, `STOCK_FEE_RATE` and
>    `MAINTENANCE_MARGIN_RATE` are gone from `@waterx/sdk/perp`. Migration in
>    `### Removed`.
> 2. **`getSpendableCreditBalance` can now REJECT.** `probeAddressCreditBalance`
>    stopped swallowing RPC errors, so a call that ALWAYS resolved (reporting a
>    failed probe as an authoritative zero balance) now propagates the failure.
>    Callers that relied on always-resolving must catch explicitly. Same for
>    `appendConsolidateAddressCredit`. See `### Fixed`.
> 3. **Error TYPE and MESSAGE changed on the integer guards.**
>    `prediction/utils`' `assertU64` / `toBigInt` throw `RangeError` with the
>    shared wording instead of plain `Error`, and tighten `isInteger` →
>    `isSafeInteger` (so `>= 2^53` is newly rejected); `routeWormhole`'s
>    `evmDestinationChain` check joins the same vocabulary. `RangeError` extends
>    `Error`, so only code matching on error TYPE or MESSAGE TEXT breaks. See
>    `### Changed`.
>
> Why a MINOR and not `5.0.0`: none of the three has an in-repo consumer, and
> both first-party consumers (`waterx-fe`, `bucket-backend-mono`) pin the SDK
> **exact** — neither picks this up implicitly; they bump to `4.1.0` in the same
> change set that adapts (waterx-fe#1036, bucket-backend-mono#1060). The one
> exposure is a consumer on a `^4.x` range, which WOULD take it automatically and
> fail; there is no such consumer today. (`4.0.1` also shipped breaking under a
> non-major version, but on a different rationale: `4.0.0` was days old and its
> oracle surface was declared unstable-until-settled, not "no consumers + exact
> pins".)

### Added

- **Split liq-estimate fee models: `calcRealLiqNetCostUsd` (signed) +
  `calcViewEstLiqFeesUsd` (saturating) + structured `fees` input on
  `calcEstLiqPrice`**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). The FE/BE
  hand-copied (and drifted) fee rule now lives in the SDK once, split into two
  explicitly-named functions so callers cannot mix models:
  - `calcRealLiqNetCostUsd({ borrowFeeUsd, openFeeUsd, closingFeeUsd, fundingFeeUsd })`
    — the REAL check (`position.move::is_liquidatable`): a plain SIGNED sum
    including the closing fee. Funding income is credited IN FULL (income pays
    deficit first, remainder adds back to equity), so a result below zero is a
    genuine equity credit — deliberately NOT floored.
  - `calcViewEstLiqFeesUsd({ borrowFeeUsd, openFeeUsd, fundingFeeUsd })` — the
    VIEW estimate (`view.move::calculate_est_liq_price`): `max(0, …)` per the
    view's unsigned `Float.saturating_sub`, with structurally NO closing-fee
    field because the view omits that term.
    `calcEstLiqPrice` takes EITHER the existing `totalFeesUsd` (unchanged —
    back-compat for published consumers) or `fees: LiqFeeBundle`, which derives
    the total via `calcRealLiqNetCostUsd` (REAL model, signed) and takes
    precedence. (An interim unreleased `calcLiqFeeBundleUsd` that floored the
    real model at 0 was removed before ever shipping.)
- **`calcEstLiqPriceRaw` — canonical BigInt fixed-point liq price, bit-identical
  to the chain** ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  Op-for-op mirror of `view.move::calculate_est_liq_price` under
  `bucket_v2_framework::float` semantics — truncating u128 division at every
  mul/div step, `math::amount_to_usd`'s exact two-step composition, borrow +
  open fee summed as u64 BEFORE conversion, `saturating_sub` funding credit.
  Takes the raw on-chain values exactly as the view does (1e9-scaled size /
  avg price / maintenance margin, raw collateral units + decimal, whole-dollar
  u64 prices) and returns the raw 1e9-scaled u128 price equal to
  `PositionData.est_liq_price`. The Number `calcEstLiqPrice` is documented as
  a UI convenience approximation of this canonical form. The
  `liq-parity-check` harness now requires EXACT raw equality (no tolerance).
- **`calcEstLiqPriceRawFromView(position, opts)` — view→raw adapter for
  `calcEstLiqPriceRaw`** ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  `calcEstLiqPriceRaw` takes twelve raw fields, nine of which map 1:1 off a
  fetched `PositionDataView` row (the other three — the two probe prices and the
  market's maintenance margin — are not on the row) — every consumer was
  hand-writing that map
  (the parity harness included). The adapter owns it: pass the row plus
  `{ maintenanceMarginRaw, basePriceUsd, collateralPriceUsd }` and get the same
  bit-identical raw price. It also carries, on a signature a caller actually
  hovers, the invariant that was previously prose only: the two prices MUST be
  the ones passed to the read that produced the row — `PositionDataView` does
  not carry its probe prices, so nothing can check it, and mismatched prices
  yield a plausible number that silently disagrees with the row's own
  `est_liq_price`. Lives at `perp/liq-view.ts` (exported from `@waterx/sdk` and
  `@waterx/sdk/perp`) rather than `utils/math.ts`: `PositionDataView` is a perp
  read type, and importing it into the shared `utils/` base would invert the
  `perp/ → utils/` dependency direction. `examples/views/liq-parity-check.ts`
  now goes through the adapter, so the live-network run verifies the mapping as
  well as the arithmetic. Type: `EstLiqPriceViewOpts`.
- **Numeric-domain validation in the liq math functions**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  `calcRealLiqNetCostUsd` / `calcViewEstLiqFeesUsd` throw `RangeError` unless
  borrow/open/closing fees are finite `>= 0` and funding is finite (signed
  ok); `calcEstLiqPrice` throws unless size/avgPrice/spotPrice/collateral are
  finite `>= 0`, `maintenanceMarginRate` is finite in `[0, 1]`, and
  `totalFeesUsd` is finite; `calcEstLiqPriceRaw` rejects negative bigints and
  out-of-range decimals. Previously garbage flowed through — e.g. an
  `Infinity` fee returned 0, indistinguishable from "already liquidatable".
- **Integer guards extended to the WRITE surface (tx builders)**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). The
  `toU64`/`toU128` validators moved to a shared `utils/validate.ts` (every
  consumer imports it directly — there is no `perp/fetch/validate.ts` shim) and
  now guard every numeric param on the tx-build surface:
  `perp/user` trading (positionId / orderId / collateralAmount / size /
  acceptablePrice / triggerPrice / maxFills / pageSize / pageIndex), orders
  (all `PlaceOrderArgument` fields, order ids, trigger prices), WLP
  (depositAmount / minLpAmount / lpAmount / requestId), staking
  (stakeAmount / withdrawalAmount when numeric), `account.requestWithdraw`
  amount, credit funding (amount / key / `routeNative.minOutput`), plus the
  fetch stragglers `getTokenPoolData.tokenIndex` and `getBridgeFee.amount`,
  and `prediction/utils.toBigInt` (now `Number.isSafeInteger`).

  Rationale, stated precisely (the earlier draft of this entry got it wrong):
  the BCS writer is not the thing that loses the value at u64 — it rejects a
  negative and a fractional `number` on its own. What it cannot see is precision
  already lost in JS: `2**53 + 1` collapses to `2**53` at parse time, so BCS
  faithfully encodes an integer the caller never wrote. (`2**53 + 2` IS exactly
  representable and encodes correctly.) Hence the `Number.isSafeInteger` floor,
  and the named `RangeError` that fires before a transaction is built.

- **`toU8` / `toU16` — the small-width integer guards**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). u8/u16 is the
  width where the BCS writer's own checks are WEAKEST: it throws on an
  out-of-range value but SILENTLY TRUNCATES a fractional one
  (`bcs.u8().serialize(2.7)` encodes `2`). The four unguarded `orderTypeTag`
  params — `getOrder` on `perp/fetch`, plus `cancelOrderRequest` /
  `updateOrderRequest` / `matchOrders` on the write side — now go through
  `toU8`, so a fractional tag throws by name instead of quietly selecting the
  wrong order book. `routeWormhole`'s hand-rolled `evmDestinationChain` check
  becomes `toU16` (same accept/reject set, now a `RangeError` with the shared
  wording — see the release header).
- **Numeric-domain validation extended to the remaining Number helpers**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  `calcEffectiveCollateralUsd` throws on negative or non-finite fee inputs (a
  negative fee silently ADDED to effective collateral before);
  `calcMaxReducibleCollateralUsd` guards its FULL param list against the same
  domains `calcEstLiqPrice` uses — sizes, prices, entry price, max leverage,
  min collateral and every fee leg finite `>= 0`, `maintenanceMarginRate` finite
  in `[0, 1]`, `collateralDecimal` an integer in `[0, 19]` — not just the two
  fee legs it started with. The sharp one: its liquidation leg backs off one raw
  collateral unit via
  `collateralPriceUsd > 0 ? collateralPriceUsd / 10 ** collateralDecimal : 0`,
  so a NEGATIVE collateral price used to fall into the `: 0` branch and silently
  delete that abort-safety margin while still returning a plausible dollar
  figure. `maxLeverage === 0` (no cap) and `collateralPriceUsd === 0` (no
  back-off) remain documented domain zeros. `calcWlpIncentiveApy`,
  `annualizedApyFromRatio`, `calcWlpMintOut`, `calcWlpRedeemOut`, and
  `calcDynamicFeeBps` throw `RangeError` on NaN / ±Infinity / negative
  operation values instead of mapping garbage to a plausible zero
  (documented domain zeros — e.g. `annualizedApyFromRatio` with
  `ratio <= 0` / `days <= 0` — are kept).
- **`rawPrice` exact decimal-string path**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). The `number`
  path is exact only below ≈ $9,007,199 (2^53 / 1e9) — sharpest for
  `triggerPrice`, an exact order-book key where a lossy raw silently fails
  the order lookup; this is now documented, and a decimal STRING parses
  digits directly onto the 1e9 grid with no f64 round-trip (≤ 9 decimals;
  malformed / negative / scientific-notation strings now throw where
  `Number()` used to accept them). Number-path semantics unchanged.
- **`RawPriceInput` / `ExactDecimalUsd` — `rawPrice`'s two modes are now named
  in the type** ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  The signature was a bare `number | string`, so hover and completion said
  "either works" while only the JSDoc carried the footgun. `rawPrice` now takes
  `RawPriceInput = number | ExactDecimalUsd`, where `ExactDecimalUsd` (a
  documented `string` alias) is the digit-exact mode that parses onto the 1e9
  grid without an f64 round-trip, and `number` is documented as lossy above the
  cliff (`usd × 1e9 > 2^53`, ≈ $9,007,199) — fine for a slippage bound, wrong
  for `triggerPrice`, which is an exact order-book key. Purely a type-level
  rename of the same union: no runtime change, and every existing call still
  compiles. The tx-build trigger-price params (`perp/user/order.ts`,
  `perp/user/trading.ts`) deliberately keep `bigint | number` — they take the
  RAW scaled value, not USD, both forms are legitimate there, `toU128` already
  rejects a non-safe-integer `number` before it can serialize wrong, and
  dropping `number` would break published call shapes. The mode choice belongs
  one level up at `rawPrice`, and `order.ts` now documents that.
- **`parseWholeDollarU64(value)` + u64/u128 guards at the fetch boundary**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  `parseWholeDollarU64` (exported next to `WholeDollarUsdPrice`) parses a
  string/number into a whole-dollar u64 with NO silent rounding — throws
  `RangeError` on fractional, negative, non-finite, or `> u64::MAX` input; the
  `examples/views/*` scripts use it instead of `BigInt(Math.round(...))`.
  Internally, every u64/u128 param on the `perp/fetch` surface
  (`basePriceUsd` / `collateralPriceUsd` / `positionId` / `orderId` /
  `cursor` / `pageSize` / `triggerPrice`) is validated (bigint range-checked;
  numbers must be non-negative safe integers) and throws with the parameter
  name instead of serializing a silently-wrong integer into the PTB. The one
  read param that is neither u64 nor u128 — `getOrder`'s u8 `orderTypeTag` — is
  covered by `toU8` (above), so no unguarded integer is left on the read
  surface either.
- **`formatFundingInterval(intervalMs)`**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)) — the
  funding-interval wire label (`"1H"` / `"8H"` / `"1.5H"` / `"30M"`,
  non-integer hours preserved), an output-identical port of the BE
  implementation so FE and BE emit byte-identical strings from one source.
  `MS_PER_HOUR` / `MS_PER_MINUTE` join `MS_PER_YEAR` in the shared constants.
- **`WholeDollarUsdPrice` type alias**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)) — the
  whole-dollar view-price warning on the six `perp/fetch` read functions is now
  carried once by a documented `bigint | number` alias used at every
  `basePriceUsd` / `collateralPriceUsd` site, instead of six drifting JSDoc
  copies; only the per-function required-vs-defaults-to-`0n` note stays inline.
- **`WaterxRule` — the first-party WaterX quote-center as a selectable oracle
  source (`oracleSource: "waterx_rule"`)**
  ([#78](https://github.com/WaterXProtocol/waterx-sdk/pull/78)). Users can now price their perp
  operations from the Nautilus-TEE quote-center instead of Pyth. The rule pulls
  one enclave-signed batch envelope covering the requested tickers from the
  quote-center (`GET /v1/quotes/update?symbols=…`; endpoint per network from the
  new `WATERX_DEFAULTS`, public read — no auth), then — unlike Pyth Lazer, whose
  verify is a single shared PTB step — verifies AND feeds in ONE
  `waterx_rule::collect_batch_latest` call per collector (the Move API bundles
  the two): it rebuilds the signed `BatchPricePayload` in-PTB (`new_batch_payload`
  - `new_batch_item`/`push_batch_item` per item, byte-identical to what the
    enclave signed), re-verifies the ed25519 signature, and feeds the item matching
    `collector.symbol()`. Being the dual-rule collect path, a waterx-routed ticker
    composes onto the same collector as Pyth/Supra; on-chain a freshness miss /
    replayed timestamp ABSTAINS so the other weighted rules cover, while a
    config/integrity mismatch or bad signature aborts.

  Wiring mirrors `PythLazerRule`: `WaterxRule` is registered in `rule-registry.ts`
  and routed by the client's `oracleSource` option alone (never a config
  `enabled` flag); `refreshOraclePrices`/`aggregateTicker` thread the signed
  envelope to the per-ticker feed leg. New config surface: `WaterxRulePackage`
  (`config`/`enclave_config`/`enclave`/`feeds`, `feeds` keyed by oracle ticker =
  the supported-ticker set) on `OraclePackages.waterx_rule`, and `WATERX_DEFAULTS`
  (testnet `quote-center-staging.waterx.app` / mainnet `quote-center.waterx.app`).
  Generated `waterx_rule` Move bindings added (`@waterx/rule`).

- **`waterxEndpoint` / `waterxFetch` create options — the quote-center host and
  transport are overridable** ([#78](https://github.com/WaterXProtocol/waterx-sdk/pull/78)).
  `waterx_rule` is the one source a BROWSER fetches itself (the signed envelope
  is pulled from the page), so it is bound by the quote-center deployment's CORS
  allowlist. A front end whose origin is not allowed — or one that must route
  egress through its own backend — now sets `waterxEndpoint` to a same-origin
  proxy that forwards `GET /v1/quotes/update`, and/or `waterxFetch.fetchImpl` to
  its own transport, instead of being locked to the hardcoded host and global
  `fetch`. The endpoint's base PATH is preserved (the fetch builds its URL via
  the shared `joinEndpointPath`, not `new URL(path, endpoint)` — which would
  have rewritten `https://app.example/api/quote-center` to the origin root and
  bypassed the proxy, the same footgun that once dropped Pyth Pro's `/hermes`
  prefix). Both resolve onto `client.waterx` (`WaterxInfraConfig`), default to
  `WATERX_DEFAULTS[network]` (fetch policy falling back to `pythFetch`), and are
  inert under the Pyth sources. `OracleHost` gains an optional `waterx` field, so
  an existing host object stays a valid `OracleHost`. Both are top-level options
  on the umbrella `WaterXClient.create` too (forwarded to the perp line beside
  `oracleSource` / `pythApiKey` / `pythFetch`) — not reachable only through the
  nested `perp: {…}` override.
- Restore `pnpm oracle:aggregates` (`scripts/print-oracle-aggregates.ts`) for v3
  (#79): Hermes/Lazer refresh + `refreshOraclePrices` simulate per configured
  oracle ticker (legacy `--format pretty|raw`, `--testnet` / `--mainnet`;
  **default network mainnet**; `pnpm oracle:aggregates:testnet`, no private
  key). Network flags rewrite a `WATERX_CONFIG_URL` ending in `testnet.json` ↔
  `mainnet.json` when needed. Harness wires `ORACLE_SOURCE` / `PYTH_API_KEY`
  into `oracleSource` / `pythApiKey`; under `pyth_rule`, a failed Hermes refresh
  prints `WARN` / `OK (STALE)` (no silent fresh OK); under `pyth_lazer_rule`
  there is no Core fallback — missing Lazer feed fails the ticker.
- `oracle:aggregates`: `--ticker T[,T...]` flag to aggregate only the given ticker(s)
  (repeatable and/or comma-separated, case-insensitive, e.g.
  `pnpm oracle:aggregates -- --ticker WTIUSD`). Omitted, it still runs every configured
  aggregator; an unconfigured ticker aborts non-zero with the list of valid tickers.

### Changed

- **One u64 domain rule for both product lines — prediction's u64 errors are now
  `RangeError` with the shared wording**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  `prediction/utils` carried a second `U64_MAX` and a third copy of the u64
  guard (`assertU64` / `toBigInt`), so the `isInteger` → `isSafeInteger`
  precision fix had to be authored twice, and it threw plain `Error` where the
  perp side threw `RangeError` for the identical failure. `assertU64` is now a
  thin alias over `utils/validate.toU64` (and accepts `number` too); `toBigInt`
  keeps only the decimal-string shape check it uniquely owns. The same inputs
  are still rejected, but the error TYPE and MESSAGE unify — code matching on
  message text now sees `"<name> out of u64 range, got X"` /
  `"<name> must be a non-negative safe integer (< 2^53) or a bigint, got X"`
  instead of `"… exceeds u64 max (…)"` / `"Invalid integer: …"`. `RangeError`
  extends `Error`, so `instanceof Error` / bare `catch` paths are unaffected.
  The same unification absorbs the last hand-rolled integer check in the SDK:
  `routeWormhole`'s `evmDestinationChain` guard becomes `toU16`, so its message
  changes from `"evmDestinationChain must be a u16 (0..65535), got X"` to
  `"evmDestinationChain must be an integer in [0, 65535] (u16), got X"` and its
  type from `Error` to `RangeError`. Same accept/reject set.
- **The whole-dollar price domain moved to `utils/validate.ts` (additive
  re-export — no consumer break)**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  `parseWholeDollarU64` and `WholeDollarUsdPrice` are pure numeric-domain
  guards with no chain or fetch dependency — the same category as `toU64` /
  `toU128` / the `assert*` family, which this PR already centralized — but they
  were still defined inside `perp/fetch/positions.ts`. They now live beside the
  rest of that vocabulary and are **re-exported unchanged** from
  `perp/fetch/positions.ts`, so the published paths (`@waterx/sdk`,
  `@waterx/sdk/perp`, `perp/fetch`) resolve exactly as before — same binding,
  not a copy (pinned by test). No consumer import needs to change.
- **`parseWholeDollarU64` delegates its numeric domain to `toU64`**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). It re-derived
  the entire finite → integer → safe-integer → non-negative → `<= u64::MAX`
  ladder by hand; it now owns only the plain-integer-STRING form and hands the
  rest to `toU64`. Same accept/reject set; the two number-mode hints ("round
  explicitly at the call site", "pass a string instead") collapse into `toU64`'s
  single message, while the string-mode hint stays.

### Removed

- **BREAKING: `CRYPTO_FEE_RATE`, `STOCK_FEE_RATE`, and `MAINTENANCE_MARGIN_RATE`
  are removed** from `src/perp/constants.ts` and the `@waterx/sdk/perp` export
  surface (calc-audit remediation,
  [#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). They were
  defaults masquerading as truth: per-market `MarketConfig` is the only source
  for fee and maintenance-margin parameters, and a consumer falling back to the
  flat `MAINTENANCE_MARGIN_RATE` caused a real est-liq-price incident on
  2026-07-28. Removed so they cannot be imported **from the SDK** — which is
  narrower than "the trap is gone". It RELOCATED: `bucket-backend-mono` now
  defines `FALLBACK_CRYPTO_FEE_RATE = 0.0003` /
  `FALLBACK_STOCK_FEE_RATE = 0.0005` /
  `FALLBACK_MAINTENANCE_MARGIN_RATIO = 0.015` locally, deliberately fenced
  (display-only, every response built from them flagged `isLive: false`, the MMR
  excluded from all risk gates via the `MMR_UNKNOWN` sentinel, incident
  rationale in the file header). What this removal buys is that a flat default
  can no longer be mistaken for an SDK-blessed constant or be pulled into a new
  consumer by autocomplete — not that no fallback exists anywhere.
  Migration: read the
  `trading_fee` / `maintenance_margin` fields (and siblings) from the market's
  on-chain `MarketConfig` — via `getMarketData` (the supported read path) or
  the raw `MarketConfigBcs` BCS binding (exported from `@waterx/sdk/perp`
  since 4.x). Both fields are
  1e9-scaled `Float` values, NOT plain decimals like the deleted constants —
  descale before use:
  `const mmr = Number(md.maintenance_margin) / Number(FLOAT_SCALE); // e.g. 50_000_000 → 0.05`.
  There is no flat-rate replacement on purpose.
  (PR [#80](https://github.com/WaterXProtocol/waterx-sdk/pull/80) had marked
  `MAINTENANCE_MARGIN_RATE` `@deprecated` in this same unreleased window; the
  removal supersedes that deprecation entry.)

### Fixed

- **`calcDynamicFeeBps` mirrors the on-chain F-039 100% clamp**
  ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). The SDK copy
  was missing `lp_pool.move::calculate_dynamic_fee`'s final
  `(base_fee_bps + additional.min(bp_scale)).min(bp_scale)` — under extreme
  weight imbalance it quoted fees above 100% (e.g. 12,030 bps) that the chain
  would cap at 10,000. Both clamps are now mirrored.
- **`calcWlpMintOut` no longer par-quotes when supply is outstanding but
  priced TVL is 0** ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  The chain reserves the $1/share bootstrap for the genuine first mint
  (`total_supply == 0`) and aborts `EInvalidBootstrap` otherwise (re-audit
  F-023 — par-minting there dilutes existing LPs); the helper now throws
  `RangeError` on that state instead of quoting par. `calcWlpRedeemOut`'s
  divergences are documented (chain aborts `EZeroPrice` where it returns 0;
  the on-chain burn fee applies `.ceil()`, so f64 composition can drift ±1
  raw unit).
- **`probeAddressCreditBalance` propagates RPC errors instead of swallowing
  them to zero** ([#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)).
  Behavior change: a failed `getBalance`/`listCoins` used to be reported as
  an authoritative zero balance — `getSpendableCreditBalance` under-reported
  spendable funds and `appendConsolidateAddressCredit` built txs that aborted
  on-chain with a confusing insufficient-balance error. Both now surface the
  real error; callers that can tolerate a missing probe must catch explicitly.
- **Docs: view-read price params are whole-dollar integers, not `rawPrice()`**
  (calc-audit remediation, [#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). The `basePriceUsd` / `collateralPriceUsd` params on
  `getPosition` / `getOrder` / `getMarketOrders` / `getMarketPositions` /
  `getAccountPositions` / `getAccountOrders` are documented as whole-dollar
  integer USD (`80000n` for $80k) — the Move view applies `float::from`
  internally, so passing a 1e9-scaled `rawPrice()` value inflates
  pnl/notional-derived fields by 1e9. The `examples/views/*` scripts and the
  perp e2e read tests that made exactly that mistake are corrected. Tx-build
  price args (`acceptablePrice` / `triggerPrice`, including u128 order-book
  keys) still take 1e9-scaled `rawPrice()` — unchanged.
- **Docs: `calcBorrowRateAccrual` docstring claimed flooring to completed
  intervals** (calc-audit remediation, [#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). The implementation (and
  `lp_pool.move::calculate_borrow_rate_accrual`) prorate continuously —
  `rate × elapsedMs / intervalMs` — with no flooring; the docstring now says so.
- **Docs/tests: per-asset custody decimals vs flat `COLLATERAL_DECIMALS`**
  (calc-audit remediation, [#81](https://github.com/WaterXProtocol/waterx-sdk/pull/81)). `rescaleRawAmount` / `sumParkedBackingAsCreditRaw`
  already thread the per-asset `decimal` from `NativeCustodyAsset` config on
  the source side; the `COLLATERAL_DECIMALS = 6` target is documented as the
  CREDIT/wxUSD (collateral-typed) decimal only — never a per-backing-asset
  assumption — with unit tests covering a hypothetical 9-dec backing asset.

## [4.0.1] - 2026-07-27

_All entries in this section were introduced by [#77](https://github.com/WaterXProtocol/waterx-sdk/pull/77). Although the entries below carry **BREAKING** changes relative to `4.0.0`, this ships as a patch (`4.0.1`) rather than a major: `4.0.0` (published 2026-07-21) landed the interim oracle rework only days earlier, and `4.0.1` supersedes it before it stabilized — treat the `4.0.x` oracle surface as unstable-until-settled._

### Changed

- **BREAKING: `oracleSource` create option; each source self-contained, no
  fallback, no init guard (#77).** The oracle mode knob `oracleSource` takes
  `'pyth_rule'` (default) or `'pyth_lazer_rule'`, on `PerpClient.create` /
  `WaterXClient.create` — a source-neutral name, since a future source need not
  be Pyth. The interim `pythGeneration: 'core' | 'pro'` knob (which bundled the
  rule choice with a Pyth contract-generation) is
  REMOVED and never shipped. Each source now owns its own infra + config and
  does NOT back-stop another:
  - The cross-source `pyth_rule` fallback in `refreshOraclePrices` is GONE.
    Under `'pyth_lazer_rule'`, a requested ticker with no Lazer feed no longer
    silently reroutes to Pyth Core — it **fails the tx-build** with a clear
    error naming the ticker and source (constant-only tickers, which need no
    price-update leg, are exempt). A present-but-wrong feed id is not
    validated: it aborts on-chain at dry-run.
  - The client-creation guard `assertOracleSourceConfigured` /
    `OracleSourceNotConfiguredError` is REMOVED. Selecting a source whose feeds
    are absent is not an init error; it surfaces per-ticker at tx-build.
  - `PYTH_PRO_DEFAULTS`, the `PythGeneration` type, and `resolveCorePythInfra`
    are REMOVED. `client.pyth` is now the fixed per-network Pyth **Core** infra
    (`PYTH_DEFAULTS`) for every source; the `pyth_lazer_rule` source reads only
    `api_key`/`fetch` from it and gets its on-chain infra from config plus
    `LAZER_DEFAULTS`. (The 2026-08-18 Pyth core→pro contract cutover becomes a
    future update to the `PYTH_DEFAULTS` constant, not a separate knob.)

  Migration: replace `pythGeneration: 'pro'` with
  `oracleSource: 'pyth_lazer_rule'` (drop `'core'` — it is the default); a
  deployment that relied on the silent Pro→Core fallback for tickers Lazer
  lacks must now either add those Lazer feeds or run those tickers under
  `'pyth_rule'`.

- **BREAKING: the config JSON no longer carries a `pyth` block; the
  credential moves to a create option (#77).** The `pyth?: PythInfraConfig`
  field is REMOVED from `WaterXConfig` / `OracleConfig` — the Pyth Core infra
  (state ids + endpoint) is fixed per network by `PYTH_DEFAULTS` and is no
  longer deployment-overridable. The two things an override actually carried —
  the Lazer Bearer token and the fetch policy — become the `pythApiKey` and
  `pythFetch` create options (on `PerpClient.create` / `WaterXClient.create`,
  threaded onto `client.pyth`). A Bearer secret never belonged in a public
  CDN JSON; this makes that structural. Migration: a caller who set
  `config.pyth.api_key` (or mutated `client.pyth.api_key` post-construction)
  passes `pythApiKey` at `create` instead; `config.pyth.fetch` →
  `pythFetch`; any state-id/endpoint override in a `pyth` block is dropped
  (those were always equal to the constants). `PythInfraConfig` remains
  exported as the shape of the resolved `client.pyth`.

### Fixed

- **Dual-feed tickers missing the selected source's feed now fail the
  tx-build (#77).** The no-feed guard in `refreshOraclePrices` exempted any
  ticker `isConstantTicker` reported true for — but that predicate is also
  true for a DUAL-FEED ticker (both `constant_rule.feeds` and
  `pyth_rule.feeds`). Under a source that couldn't serve such a ticker, the
  build neither fell back (correct) nor threw (wrong): it fed an unrefreshed
  Pyth leg, risking a stale price or a missing-weighted-source abort. The
  exemption is now strictly constant-ONLY (constant and NOT also Pyth-fed);
  dual-feed tickers with no selected-source feed fail at build like any other.

- **`updatePythPrices` now aligns `feedIds` with the served survivors (#77).**
  After a whole-batch 404 dropped some feeds, the public helper still handed
  the ORIGINAL `feedIds` to `buildPythPriceUpdateCalls`, which emits one
  update call per id — building calls for dropped feeds the single accumulator
  blob doesn't cover (invalid PTB / on-chain abort). It now passes the
  `endpointSupportedFeedIds` survivor set, mirroring
  `PythCoreRule.fetchUpdateData`.

- **Pyth Hermes fetch dropped the endpoint's base path — EVERY feed 404'd
  under Pyth Pro (#77).** `new URL("/v2/updates/price/latest", endpoint)`
  treats a leading-slash path as absolute, replacing the Pro compat
  endpoint's `/hermes` prefix. Both oracle fetches (Hermes + Lazer) now build
  URLs through one `joinEndpointPath` helper; regression test pins the
  base-path survival.

- **Endpoint-missing feeds self-heal — catalog-first, credential-scoped
  (#77).** Pyth 404s the whole batch when ANY id is unknown, and the 404
  body naming the ids is not reliably delivered to `fetch`. Discovery now
  reads the endpoint's own catalog (`GET /v2/price_feeds` — one request
  naming every id served for THIS credential; verified live: WTI absent from
  the Pro catalog AND 404 on latest-price, BTC present AND 200) with the
  batch-bisection retained as fallback when the catalog is unavailable.
  Results are memoized per `(endpoint, apiKey)` — Pro entitlements are
  per-key, so two clients in one process no longer cross-poison each other's
  view (`endpointSupportedFeedIds` gains an optional `apiKey`,
  backward-compatible). Survivors re-fetch as one clean batch;
  `probeMissingFeeds` is the discovery-only entry for consumers that observed
  a batch 404 themselves.

- **An endpoint-wide 404 no longer memoizes every feed as missing (#77).**
  A wrong base path, a changed route, or a revoked/downgraded entitlement
  404s every batch, so the discovery bisection concluded that EVERY feed was
  absent and cached exactly that — `fetchPriceFeedsUpdateData` then returned
  `[]` and the build died on "Hermes returned empty results", blaming Hermes
  for a misconfigured endpoint, with no recovery short of a process restart.
  Discovery now only commits an "all requested ids are missing" verdict when
  a non-empty catalog vouches for it; an unreadable or empty catalog writes
  NOTHING and throws `HermesEndpointRejectedAllFeedsError` (exported,
  `instanceof`-able, message keeps the `Hermes price fetch failed: 404`
  prefix) naming the likely cause. The memo also gained a TTL
  (`MISSING_FEED_MEMO_TTL_MS`, 15 min, exported) and prunes lazily on read,
  so a granted entitlement or a newly-listed feed self-heals without a
  restart. `probeMissingFeeds` throws on the same condition instead of
  poisoning the memo.

- **Missing-feed discovery no longer multiplies requests on the money path
  (#77).** The catalog is read at most ONCE per discovery run: the bisection
  fallback is now a pure probe tree that never re-reads it, where previously
  every 404 node of the recursion re-ran a full catalog fetch — with a 5xx
  catalog that meant ~8–10 retry cycles (3 attempts + backoff each) inside a
  single tx-build. Concurrent callers asking the identical question (same
  endpoint, credential and id set) now also share one in-flight discovery
  instead of each running their own; the latch is released on failure too, so
  a blip never pins later callers to a stale outcome.

- **404 error message no longer replaced by `TypeError: Body is unusable`
  (#77).** `fetchPriceFeedsUpdateData` cancelled the response body inside the
  404 discovery branch, then read it again with `await res.text()` in the
  throw. A 404 that was NOT a missing-feed rejection (discovery recorded
  nothing, so survivors == requested) fell through to that throw and surfaced
  a body-reuse `TypeError` instead of `Hermes price fetch failed: 404 …` —
  breaking the very string-matching contract downstream consumers (the e2e
  transient detector, `run-smoke-chain`) rely on. The body is now drained
  once, up front, and reused by every path.

- **Lazer requests pin `channel: 'fixed_rate@200ms'` (#77)** — `real_time`
  400s the whole batch because only the majors publish it; the deployed
  on-chain rule accepts the 200ms channel (verified live against the full
  29-feed batch).

- **`fetchWithPolicy` honors a numeric `Retry-After` on 429 (#77)** when it
  fits under the existing backoff cap — the server's own delay instead of
  blind exponential backoff; a longer ask degrades to normal backoff rather
  than stalling a money-path build.

- **Ghost config fields removed (#77):** `hourly_mint_limit` /
  `hourly_burn_limit` (the JSON carries `daily_*`) and the never-populated
  `trusted_emitters` block.

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
  _infra_ (state ids + endpoint), not which `PriceUpdateRule` routes tickers,
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
