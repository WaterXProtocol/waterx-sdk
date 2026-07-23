# Tests

## Test Case Inventory

There used to be a generated case table (ID, preconditions, operation, expected) at `test/TEST-CASES.md`, produced by `scripts/generate-test-cases-doc.ts`. Both the doc and its generator were deleted in `7e71719` (`chore(scripts): drop non-integration/smoke scripts and prune package.json`) — the file no longer exists and nothing regenerates it. For the current test surface, read the live tree instead: `test/perp/unit/**/*.test.ts` (unit), `test/perp/e2e/**/*.test.ts` (E2E — layout below), and `test/perp/integration/**/*.test.ts` (on-chain integration).

## Local secrets (`.env.local`)

Do **not** commit private keys. Run **`pnpm env:init`** once to create **`.env.local`** from **`.env.example`** (Unix: tries `chmod 600`). Put **`WATERX_INTEGRATION_PRIVATE_KEY`** and other secrets only there or in your shell — see `.env.example` for precedence. **`.integration-trader.keystore`** remains supported and gitignored.

Pyth **Hermes** sporadic **502/503/504/521**: SDK **`fetchPriceFeedsUpdateData`** goes through **`fetchWithPolicy`** (`src/oracle/update-fetch.ts`) — bounded retry with exponential backoff on network errors / 429 / 5xx (default: 2 retries; still no beta⇄prod failover) — and only throws once retries are exhausted. E2e simulate tests **`ctx.skip`** via **`skipHermesIfFeedUnavailable`** (infra flake, not SDK regression). **Testnet e2e / CI** use **`hermes-beta.pyth.network`** (`PYTH_DEFAULTS.TESTNET`) — testnet feed ids **404 on prod Hermes**. Integration tests do **not** skip pure Hermes HTTP failures (only on-chain **`::pyth_rule::feed`** transients via **`execIntegrationOrSkipOracleTransient`**).

PRs to `main` run [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): `Lint`, `Typecheck`, `Build`, then **`pnpm test:ci:unit`** and a single **`test-e2e`** job running **`pnpm exec tsx scripts/run-e2e.ts --testnet`** (simulate only). **`pnpm test:ci`** / **`pnpm test:ci:full`** runs **`pnpm test:ci:e2e`**, which also defaults to **`--testnet`** so local “full CI” matches the workflow network.

## Vitest projects

| Project                | Glob                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **unit**               | `src/**/*.test.ts`, `test/perp/unit/**/*.test.ts` | Fast, no chain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **e2e**                | `test/perp/e2e/**/*.test.ts`                      | **v3** `simulateTransaction` against canonical **`waterx-config`** (`WaterXClient.create`). Single Vitest fork by default (public gRPC rate limits). **Testnet default locally** (mainnet JSON often incomplete); **CI** runs the same command in one job (`pnpm exec tsx scripts/run-e2e.ts --testnet`, no **`--shard`**). Use **`--mainnet`** when `waterx-config/main/mainnet.json` is ready.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **integration-trader** | `test/perp/integration/**/*.test.ts`              | **[v3] On-chain** integration against canonical **`waterx-config`**. Starts via **`pnpm test:integration`** (`scripts/run-integration.ts`), which aligns **`WATERX_E2E_NETWORK`** / **`WATERX_INTEGRATION_NETWORK`**. Needs **`WATERX_INTEGRATION_PRIVATE_KEY`** (or `.integration-trader.keystore`). Most suites **`describe.skipIf(!isIntegrationTraderConfigured())`**; optional env still gates destructive cases (e.g. close-one position). **`WATERX_INTEGRATION_MAX_FORKS`** caps Vitest parallelism. **Gas:** low default caps via **`integrationGasBudget`** (~0.01–0.02 SUI); optional **`WATERX_INTEGRATION_GAS_BUDGET`**. Tests **run first**; only **skip** (not fail) when the chain reports insufficient SUI for gas selection. Run a subset: `pnpm test:integration test/perp/integration/user/trader-custody.test.ts`. |

**Skipped counts:** Vitest reports **`skipped`** when tests opt out via **`ctx.skip`** or **`describe.skipIf`** — **environment / on-chain state**, not broken placeholders. Common cases:

- **`trade-position`** / **`builders-compose`**: **`discoverStatefulSimulatePosition`** finds no eligible row → run **`pnpm test:e2e:preflight`** or set env wxa id (CI also uses built-in canonical testnet account in **`canonical-testnet-account.ts`**).
- **`wlp`** / **`staking`**: no wxa account with USDC/WLP stored balance → same as above.
- **`wlp-redeem`**: no wxa WLP or no pending redeem queue row (preflight enqueues pending redeem when **`WATERX_INTEGRATION_PRIVATE_KEY`** is set locally).
- **`read-account`** (probe paths): rare skip if canonical account has no eligible position on chain.
- **`referral`** / **`read-referral`**: referral not in config (**`describe.skipIf`**).
- **Hermes HTTP 404 / 5xx during `build*Tx`**: gateway outage or feed mismatch — tests **`ctx.skip`** via **`skipHermesIfFeedUnavailable`** (including **`runBuiltTradingTx`** used by **`trade-position`**).

**Ghost-ID simulate** (**`trade-ghost-sizing`**, **`trade-pre-order-requests`**) does **not** depend on discovery; they still **`simulate`** the sponsor + oracle PTB (Move may **abort** on invalid ids — that is acceptable for builder smoke).

### E2E layout (`test/perp/e2e/`)

| Area         | Files                                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read / fetch | `read-views`, `read-pagination`, `read-account`, `read-position-order`, `read-wlp-queue`, `read-referral`, `fetch-errors`                                                                                                                             |
| Oracle / wxa | `oracle-pyth`, `account-wxa`, `referral`, `custody` (native CREDIT PSM), `credit` (bridge tx-builders + `getAccountsByOwner`)                                                                                                                         |
| Trading      | `trade-open`, `trade-position` (discovery sender), `trade-orders`, `trade-pre-orders`, `trade-pre-order-requests` (standalone add/cancel pre), `builders-compose`, `trade-ghost-sizing` (close/inc/dec/deposit/withdraw with ghost **`position_id`**) |
| Pool / ops   | `wlp` (discovered wxa USDC mint), `wlp-redeem` (discovered WLP + queue cancel), `staking` (discovered wxa WLP), `keeper`                                                                                                                              |

Stateful flows use **`discoverStatefulSimulatePosition`** / **`discoverWxaAccountWith*`** (`test/perp/helpers/e2e/discover-on-chain-position.ts`, **`e2e-wxa-discovery.ts`**): prefer env **`WATERX_E2E_WXA_ACCOUNT_ID`** / **`WATERX_INTEGRATION_ACCOUNT_ID`**, else built-in testnet canonical wxa in **`canonical-testnet-account.ts`** (CI-safe, no `.env.local`), then market scan / redeem queue / funded probe → **`getAccountOwnerByAccountId`** for **`tx.setSender`**.

Scratch helpers under **`test/perp/helpers/scratch/`** remain for **scenario data** (`scratch-trading-scenarios.ts`). **`run-scratch-trading-scenario-integration.ts`** re-exports the shared v3 **`runScratchTradingScenarioIntegration`**; **`run-scratch-trading-scenario-simulate.ts`** is `@deprecated` and **always skips** — use **`trade-*`** + **`test/perp/helpers/trading/run-trading-scenario.ts`** instead.

## Daily commands

| Command                                  | What it runs                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                              | **unit** + **e2e** (e2e defaults to **testnet**)                                                                  |
| `pnpm test:unit`                         | unit only                                                                                                         |
| `pnpm test:e2e`                          | simulate / e2e only, **testnet** by default                                                                       |
| `pnpm test:e2e --testnet`                | explicit testnet (same as bare `test:e2e`)                                                                        |
| `pnpm test:e2e --mainnet`                | mainnet (`waterx-config` must include all required `published_at` fields)                                         |
| `pnpm test:e2e:testnet`                  | alias for `pnpm test:e2e --testnet`                                                                               |
| `pnpm test:e2e:mainnet`                  | alias for `pnpm test:e2e --mainnet`                                                                               |
| `pnpm test:watch`                        | unit + e2e in watch mode                                                                                          |
| `pnpm test:coverage`                     | unit + e2e with coverage (`src/**/*.ts`)                                                                          |
| `pnpm test:all`                          | all Vitest projects (**unit**, **e2e**, **integration-trader**)                                                   |
| `pnpm test:integration`                  | **integration-trader** via **`scripts/run-integration.ts --testnet`** (override with `--mainnet` or env networks) |
| `pnpm test:integration:persistent-state` | Seed per-ticker keeper slots + WLP on integration wxa (feeds e2e discovery)                                       |
| `pnpm test:integration:gap`              | WLP redeem/cancel, staking, keeper roundtrip, custody mint, credit withdraw enqueue                               |

**Recommended local testnet loop:** **`pnpm test:e2e:preflight`** (needs **`WATERX_INTEGRATION_PRIVATE_KEY`**; sets **`WATERX_E2E_WXA_ACCOUNT_ID`**, seeds keeper slots + wxa WLP + **pending redeem** on the integration wxa account for **`wlp-redeem` cancel simulate**) → **`pnpm test:e2e`**. Disable redeem enqueue with **`WATERX_E2E_PREFLIGHT_REDEEM=0`**. CI only runs **`pnpm test:e2e`** (no key, no preflight). Alternative seed: **`pnpm test:integration:persistent-state`**.

Positional args and unknown flags after `pnpm test:e2e` are forwarded to Vitest, e.g.
`pnpm test:e2e --testnet -t "reads BTC"` or `pnpm test:e2e test/perp/e2e/read-views.test.ts`.

## CI-style commands

| Command                     | Purpose                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm test:ci`              | **`test:ci:full`**: unit (coverage + JUnit) then **`test:ci:e2e`** (**testnet**, JUnit XML)    |
| `pnpm test:ci:unit`         | Unit + coverage + `test-results-unit.xml`                                                      |
| `pnpm test:ci:e2e`          | Simulate e2e on **testnet** + `test-results-simulate-testnet.xml` (same network as CI e2e job) |
| `pnpm test:ci:e2e:testnet`  | Same flags/output as **`test:ci:e2e`** (explicit alias)                                        |
| `pnpm test:ci:e2e:mainnet`  | Mainnet + `test-results-simulate-mainnet.xml`                                                  |
| `pnpm test:ci:e2e:coverage` | **`pnpm exec tsx scripts/run-e2e.ts --testnet --coverage`**                                    |

**Discovery audit:** **`pnpm audit:e2e-discovery --testnet`** lists live testnet **`discover*`** usages (helps keep simulate discovery consistent).

**GitHub Actions** runs one **`test-e2e`** job with **`pnpm exec tsx scripts/run-e2e.ts --testnet`** (no matrix / **`--shard`**). Use **`pnpm test:e2e:mainnet`** (or **`WATERX_E2E_NETWORK=mainnet`**) when you intentionally exercise **mainnet** and config is complete.

## Simulate / e2e: network + discovery

- **Network:** `scripts/run-e2e.ts` / **`test/perp/helpers/e2e/e2e-client.ts`**: **`--testnet`** / **`--mainnet`** (CLI) → **`WATERX_E2E_NETWORK`** → **`testnet`** default when unspecified (`pnpm test` runs Vitest without `run-e2e.ts`, so it relies on this fallback).
- **Oracle:** Pyth Hermes + **`refreshOraclePrices`** / **`updatePythPrices`** (`src/utils/pyth.ts`, **`test/perp/helpers/e2e/e2e-oracle-context.ts`**). There is **no** legacy bucket-aggregator prime step.
- **Oracle (Lazer):** `PythLazerRule` has **mock-only unit coverage** today (`test/perp/unit/pyth-lazer-rule.test.ts`) — the Lazer API is auth-first and feed responses need an **entitled** Pyth Pro key. A future real e2e should read **`WATERX_E2E_LAZER_API_KEY`** at the harness boundary and pass it as **`config.pyth.api_key`** (the SDK never reads env), skipping when unset. Never hardcode a key.
- **gRPC:** optional **`WATERX_E2E_GRPC_URL`**; parallelism **`WATERX_E2E_MAX_FORKS=2`…`8`** if your RPC tolerates it.

## Integration (trader)

- Intended env: **`WATERX_INTEGRATION_PRIVATE_KEY`** or **`.integration-trader.keystore`** (`test/perp/integration/setup.ts`); optional **`WATERX_INTEGRATION_ACCOUNT_ID`**, **`WATERX_INTEGRATION_ADDRESS`**.
- Run: **`pnpm test:integration`** (testnet default) — same fork / gRPC patterns as simulate where applicable.
- **Gas / SUI:** defaults are **low** so gas selection needs minimal testnet SUI. Override with **`WATERX_INTEGRATION_GAS_BUDGET`** if a tx runs out of gas. No pre-flight balance gate unless you set **`WATERX_INTEGRATION_MIN_SUI_MIST`**.
- Run only custody/credit: `pnpm test:integration -- test/perp/integration/user/trader-custody.test.ts` (pnpm’s `--` is stripped before Vitest).
- **Gap coverage** (on-chain, complements simulate): **`trader-e2e-persistent-state`** (seed slots), **`trader-wlp-redeem`**, **`trader-staking`**, **`trader-keeper-roundtrip`**, **`trader-custody`** / **`trader-credit-pipeline`** (native custody mint + native withdraw enqueue), plus existing lifecycle / open-smoke / close-one.
- Helpers such as **`getAccountsByOwner`**, **`getAccountOwnerByAccountId`** operate on **wxa** **`account_id`** UUIDs.

## TypeScript scope

Root **`tsconfig.json`** **`include`** covers **`test/perp/helpers/**/\*.ts`** and **`test/integration`** so simulate + integration helpers typecheck with the SDK; legacy-only helpers remain **`exclude`** where still v2-shaped (**`wlp-mint-simulate-tx`**, **`market-summary-assertions`\*\*).

## Related: oracle debug (not Vitest)

| Command                  | Purpose                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm oracle:aggregates` | `scripts/print-oracle-aggregates.ts` (Hermes Pyth refresh + oracle PTB **simulate** for markets/collaterals; no private key; `-- --format raw` / `--help`) |

Admin-keystore flows live on branch **`integration/admin-e2e-parked`**.
