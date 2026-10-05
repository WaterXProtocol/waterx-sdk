# AGENTS.md — waterx-sdk

Both Claude Code (v2.1.281+) and Codex read this file. Do not add a CLAUDE.md anywhere in the repo: Claude Code ignores every AGENTS.md at or below a directory that has one.

Guidance for coding agents working in `@waterx/sdk`, the TypeScript SDK for the WaterX v3 contract generation on Sui.

## Working in this repo

The request sets the scope. When asked to assess, review, or explain, report findings and stop — do not
apply the fix until asked. Keep changes to what the task needs; cleanup, extra tests, or refactors you
notice go in the summary as suggestions, not into the diff.

Lessons from earlier sessions live in `docs/knowledge-hub/` (one lesson per file; format in its `README.md`).
Scan its titles before starting in an unfamiliar area; add a lesson when something cost real time.

Read the matching file before changing anything there:

- `src/AGENTS.md` — the source layout: what each folder owns, the import direction between `account/`,
  `perp/`, `prediction/` and `oracle/`, and the per-file invariants.
- `.claude/skills/waterx-sdk-release/` — publishing, cutting the changelog, tagging and the GitHub
  Release (an exact, ordered procedure; load it before any release step).
- `.claude/skills/waterx-sdk-integration/` — the consumer-facing integration skill, **shipped in the npm
  package** (`SKILLS.md` tells consumers how to install it for Claude Code and Codex). It may only name
  things a consumer has: package exports, `node_modules/@waterx/sdk/README.md`, or GitHub URLs —
  `scripts/agent-hooks/check-skill-paths.mjs` enforces that in CI.
- `.claude/settings.json` enables the waterx-commons plugins waterx-harness (`/waterx-harness:adopt-harness-standard`, `/waterx-harness:harness-transform`, `/waterx-harness:knowledge-hub-lesson`), waterx-review (`/waterx-review:waterx-code-review`), waterx-sui (`/waterx-sui:sui-coin-balances`) and waterx-delivery (`/waterx-delivery:release-npm-package`, `/waterx-delivery:deploy-via-k8s-infra`). They load after you accept the workspace-trust prompt, with your own GitHub access to the private Bucket-Protocol/waterx-commons (a different organization from this repository, so you need read access there as well), and not in cloud sessions; Codex users link them into `~/.agents/skills` ([waterx-commons plugins, "Codex"](https://github.com/Bucket-Protocol/waterx-commons/tree/main/plugins)).
  This file and `.claude/skills/` win over a plugin skill. Known conflict: `release-npm-package` says a human dispatches `publish.yml` ("Do not run it yourself"), while `waterx-sdk-release` step 1 says "Run the `Publish package` workflow"; the local skill wins, and `gh workflow run` still prompts.

## Changelog

`CHANGELOG.md` is Keep-a-Changelog style. Every PR with a user-visible change adds an entry under
`## [Unreleased]` (Added / Changed / Deprecated / Removed / Fixed / Security) referencing the PR number.
Versioning is SemVer-shaped but **not** a SemVer compatibility promise (policy note at the top of the
file): every consumer is first-party and pins exact, so a MINOR or PATCH may ship a break provided its
section names it. Never hand-bump `package.json` `version` — the publish workflow does it.

## What the SDK is

WaterX is a perpetual futures DEX and prediction market on Sui. The contracts live in
`WaterXProtocol/waterx-contract` (clone it beside this repo as `../waterx-contract/`; codegen resolves
packages under that path). The SDK **builds transactions**: it never signs and never reads `process.env`.

The SDK is **ticker-based** — concatenated strings such as `BTCUSD` (see Naming conventions) — not
base-token-witness-based. One shared `Oracle`, `MarketRegistry<LP_TOKEN>` (per-market `Market<LP_TOKEN>`
objects live inside it), `WlpPool<LP_TOKEN>`, `WlpAum<LP_TOKEN>` and `waterx_account::AccountRegistry`.

`WaterXClient` is the umbrella entry point with three namespaces: `client.account` (shared
`waterx_account` + credit/custody), `client.perp` (`PerpClient` + perp builders), `client.predict`
(`PredictClient` + prediction builders). `client.perp` / `client.predict` are the line clients — config
lookups, gRPC and signing live on them (`Client` in `src/sdk.ts` is an alias of the umbrella kept for older
consumers). Every factory is **async** because it fetches the deployment config:

```ts
const client = await WaterXClient.create({ network: "TESTNET", waterxConfigUrl /* required */, grpcUrl, cache: true });
client.perp.config.objects.perp.markets["BTCUSD"]; // plain document read; client.perp.getMarket("BTCUSD") throws on a miss
```

## Runtime config (the `waterx-config` document, `schema_version: 2`)

All chain-specific values come from the canonical [`waterx-config`](https://github.com/WaterXProtocol/waterx-config)
document, fetched at client init. The URL is **required** via the `waterxConfigUrl` option — no env-var
fallback, no built-in default. `loadConfig` (`src/config.ts`, one loader for both lines) fetches it
**as-is** (no `<network>.json` or git ref appended) and throws when it is unset.

Callers that want an env-driven URL read it themselves. The repo harnesses share one convention
(`scripts/waterx-config-url.ts`): **`WATERX_CONFIG_URL` is a CDN root, no file name**, and the boundary
composes `${root}/${network}.json`, so one value drives both networks and a mainnet run can never load a
testnet document. The composition is the public `waterxConfigUrlFromRoot(root, network)`
(`src/config-url.ts`, exported on `.`, `/config`, `/perp`, `/prediction`): it strips trailing slashes and
throws for a value ending in `.json`, a non-https value, a GitHub host or a query/fragment. The retired
aliases `E2E_CONFIG_URL` and `PREDICT_CONFIG_URL` throw when set. The v2 roots are
`https://main-v2.waterx-config.pages.dev` (production) and `https://staging-v2.waterx-config.pages.dev`
(staging), each serving `/{testnet,mainnet}.json`; CI and `.env.example` point at `staging-v2`. A document
without `schema_version` is rejected at `create()` with an error naming those roots.

The body is parsed strictly by **`@waterx/config`** (`parseWaterxConfig`) and then checked once for the
package entries the SDK reads unconditionally (`REQUIRED_PACKAGES`). **The parsed document is the config**:
`client.config` exposes it verbatim; there is no internal view or adapter. Layout: `objects.*` holds every
object id, `oracle_rules.*` the rule wiring, `symbols` the ticker universe, `packages.*` only package
identity (`published_at` / `original_id` / `version`). Because the schema requires every block, read sites
index directly — there are deliberately **no "is X configured?" guards** in the SDK.

External chain infra is **not** in the JSON. Each oracle rule owns a fixed per-network table: `LAZER_INFRA`
in `src/oracle/rules/pyth-lazer-rule.ts`, `WATERX_INFRA` in `src/oracle/rules/waterx-rule.ts` (accessor
`waterxQuoteCenterEndpoint(network)`). `client.pyth` is `PythAccessConfig` — only the caller-supplied
`pythApiKey` / `pythFetch` (a secret has no place in a public CDN JSON); `client.waterx` is
`WaterxAccessConfig` (`waterxEndpoint` / `waterxFetch` overrides; fetch policy `waterxFetch` → the
`fetchWithPolicy` defaults, never `pythFetch` — sources do not share config).

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

## Development commands

```bash
pnpm install
pnpm build           # rm dist; ESM (tsconfig.build.json + tsc-alias) then CJS (tsconfig.cjs.json + scripts/finalize-cjs.mjs)
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint + prettier --check (src, test, scripts, examples, packages/predict-stress, root configs)
pnpm docs:check      # every relative Markdown link in tracked .md files resolves
pnpm test:unit       # vitest --project unit --project predict-unit
pnpm test:post-build # package.json exports resolve in dist (ESM + CJS); needs pnpm build first
pnpm check:exports   # publint + attw
pnpm check           # docs:check + typecheck + test:unit + lint — the bar ci.yml holds every PR to
pnpm env:init        # copy .env.example → .env.local once (gitignored, chmod 600 on Unix)
pnpm codegen         # scripts/codegen-summaries.ts → sui-ts-codegen → scripts/fix-generated-imports.ts
```

`pnpm codegen` runs `sui move summary` per package in `scripts/codegen-summaries.ts` (under
`../waterx-contract/<pkg>/`); the committed `waterx_rule` bindings mean the enclave rule needs no raw `tx.moveCall`. CI (`.github/workflows/ci.yml`, PRs to `main`) runs lint + `docs:check`,
typecheck, build + post-build + `check:exports`, unit tests, testnet simulate e2e for both lines, a dry
smoke chain, and the security scans. On-chain integration tests (`pnpm test:integration*`) need keys and a
funded wallet and are local-only. The `agent-guards` job runs the two checks under `scripts/agent-hooks/`
named in "Definition of done".

## Contract surface the SDK depends on

- **Account abstraction.** `waterx_perp` has no account registry of its own: per-account perp state lives
  on the wxa `Account` under `ProtocolDataKey<WaterXPerp>()`, auto-installed on first `add_position` /
  `add_order`; funds move via `wxa_account::take` / `put` gated by the `WaterXPerp` witness (no TTO
  `Receiving<Coin<C>>` in trading). User-side `*_request` entrypoints return a `TradingRequest<C>` hot potato
  that `execute<C, LP>` consumes; the SDK pairs each `*Request` builder with one `executeTrading` per PTB.
- **No user-side `open_position_request`.** A market order is a limit order with `triggerPrice: undefined`
  and a non-zero `acceptablePrice`; it parks at tick 0 and a keeper fills it via `match_orders`.
- **Pre-orders.** `place_order_request` takes `main` + `preOrder[]`: reduce-only TP/SL legs, opposite side
  of main, no collateral, no linked position, validated at request creation before any wxa take, activated
  on fill, swept on cancel/liquidation; per-leg `cancel_pre_order_request` / `add_pre_order_request`;
  per-market cap `MarketConfig.max_pre_orders`.
- **WLP pool.** `mint_wlp` / `settle_redeem` take `&WlpAum` as well as `&WlpPool` (`objects.wlp.pool` /
  `objects.wlp.aum`); every payout lands inside the recipient wxa account.
- **Keeper paths are monolithic**: `liquidate`, `batch_liquidate`, `match_orders`, `update_funding_rate`,
  `open_position_by_keeper`, `close_position_by_keeper` take `sender_request: &AccountRequest` directly.

## Naming conventions

- **Move**: snake_case modules/functions, PascalCase structs, type params `C_TOKEN`, `LP_TOKEN`. **SDK**:
  camelCase functions, PascalCase interfaces/types.
- **Tickers**: trading pairs use `ticker` (never `symbol`), concatenated `BTCUSD` / `ETHUSD` / `SUIUSD` —
  never `BTC`, `BTC/USD` or `BTC_USD`. Canonical source: the document's `objects.perp.markets` keys, and
  `symbols` for the oracle universe (the v2 schema's field is spelled `symbols`; the SDK API says `ticker`).
  Collateral tokens (`USDC`, `USDSUI`) keep `symbol`.
- **BCS field names** stay snake_case on the wire (`account_object_address`, `request_timestamp`);
  generated TS structs preserve them and consumers use them as-is.

## Notes when hacking

- All `*_request` builders return the `TradingRequest` argument for `executeTrading` or a custom PTB.
- Cancel-order wildcard: `orderTypeTag: ORDER_TAG_WILDCARD` (255) with `triggerPrice: 0n` scans all four
  books by `orderId`.
- Price scaling: human USD (`50000`) → raw 1e9-scaled bigint via `rawPrice(usd)`; pass the raw form to
  `acceptablePrice` / `triggerPrice` / size args. View `basePriceUsd` arguments take a whole-dollar u64
  (`parseWholeDollarU64`).
- Browser consumers blocked by the quote-center's CORS allowlist point `waterxEndpoint` at a same-origin proxy.

## Definition of done

`pnpm check` green (plus `pnpm build && pnpm test:post-build && pnpm check:exports` when `package.json`
`exports` or the build changed), a `CHANGELOG.md` entry, and the shipped skill still naming only package
paths or URLs (`node scripts/agent-hooks/check-skill-paths.mjs`). The harness layout itself — this file
as the only instruction file (no `CLAUDE.md`), skills mirrored under `.agents/skills/` — is checked by
`scripts/agent-hooks/check-harness.sh`, vendored from `Bucket-Protocol/waterx-commons` (update it there, not
here). Before claiming a check passed, point at the tool output from this session that shows it; say plainly
what you did not run or could not verify.
