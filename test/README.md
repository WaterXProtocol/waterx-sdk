# Tests

PRs to `main` run [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): `Lint`, `Typecheck`, `Build`, then **`pnpm test:ci:unit`** and sharded **`pnpm exec tsx scripts/run-e2e.ts --testnet`** (simulate only). **`pnpm test:ci`** / **`pnpm test:ci:full`** runs **`pnpm test:ci:e2e`**, which also defaults to **`--testnet`** so local “full CI” matches the workflow network.

## Vitest projects

| Project                | Glob                                         | Notes                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **unit**               | `src/**/*.test.ts`, `test/unit/**/*.test.ts` | Fast, no chain                                                                                                                                                                                 |
| **e2e**                | `test/simulate/**/*.test.ts`                 | **v3** `simulateTransaction` against canonical **`waterx-config`** (`WaterXClient.create`). Single Vitest fork by default (public gRPC rate limits). **Testnet default locally** (mainnet JSON often incomplete); **CI** uses the same (`pnpm exec tsx scripts/run-e2e.ts --testnet`, 3-way `--shard`). Use **`--mainnet`** when `waterx-config/main/mainnet.json` is ready. |
| **integration-trader** | *(currently disabled)*                       | Vitest **`include: []`** until legacy trader scenarios are ported to v3 (`vitest.config.ts`). To experiment locally, temporarily widen `include` and supply **`WATERX_INTEGRATION_PRIVATE_KEY`** / **`WATERX_INTEGRATION_ACCOUNT_ID`**. Same fork defaults as before (`WATERX_INTEGRATION_MAX_FORKS`). |

**Skipped counts:** Vitest reports **`skipped`** for **`ctx.skip`** when discovery finds no funded position, collateral balance is low, deployment lacks staking/referral config (`describe.skipIf`), etc.—environment/state, not placeholder suites.

### Simulate layout (`test/simulate/`)

| Area        | Files |
| ----------- | ----- |
| Read / fetch | `read-views`, `read-pagination`, `read-account`, `read-position-order`, `read-wlp-queue`, `read-referral`, `fetch-errors` |
| Oracle / wxa | `oracle-pyth`, `account-wxa`, `referral` |
| Trading      | `trade-open`, `trade-position` (discovery sender), `trade-orders`, `trade-pre-orders`, `builders-compose` |
| Pool / ops   | `wlp`, `staking`, `keeper` |

Stateful flows (`trade-position`, parts of `trade-*`) use **`discoverActivePosition`** (`test/helpers/e2e/discover-on-chain-position.ts`): **`getMarketPositions`**pagination → cooldown / leverage / USDC gate → **`getAccountOwnerByAccountId`** for **`tx.setSender`**.

Scratch helpers under **`test/helpers/scratch/`** are **stub / deprecated for automate simulate**; use the **`trade-*`** e2e files instead (`run-scratch-trading-scenario-simulate.ts` skips with a note).

## Daily commands

| Command                                  | What it runs                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm test`                              | **unit** + **e2e** (e2e defaults to **testnet**)                                                           |
| `pnpm test:unit`                         | unit only                                                                                                |
| `pnpm test:e2e`                          | simulate / e2e only, **testnet** by default                                                               |
| `pnpm test:e2e --testnet`                | explicit testnet (same as bare `test:e2e`)                                                               |
| `pnpm test:e2e --mainnet`                | mainnet (`waterx-config` must include all required `published_at` fields)                                  |
| `pnpm test:e2e:testnet`                  | alias for `pnpm test:e2e --testnet`                                                                     |
| `pnpm test:e2e:mainnet`                  | alias for `pnpm test:e2e --mainnet`                                                                      |
| `pnpm test:watch`                        | unit + e2e in watch mode                                                                                |
| `pnpm test:coverage`                     | unit + e2e with coverage (`src/**/*.ts`)                                                                  |
| `pnpm test:all`                          | registered Vitest projects (integration-trader currently collects **zero** files)                       |
| `pnpm test:integration`                  | would run integration-trader only **when `include` is non-empty**                                        |

Positional args and unknown flags after `pnpm test:e2e` are forwarded to Vitest, e.g.
`pnpm test:e2e --testnet -t "reads BTC"` or `pnpm test:e2e test/simulate/read-views.test.ts`.

## CI-style commands

| Command                       | Purpose                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm test:ci`                | **`test:ci:full`**: unit (coverage + JUnit) then **`test:ci:e2e`** (**testnet**, JUnit XML)    |
| `pnpm test:ci:unit`           | Unit + coverage + `test-results-unit.xml`                                                      |
| `pnpm test:ci:e2e`            | Simulate e2e on **testnet** + `test-results-simulate-testnet.xml` (same network as CI shards) |
| `pnpm test:ci:e2e:testnet`    | Same flags/output as **`test:ci:e2e`** (explicit alias)                                         |
| `pnpm test:ci:e2e:mainnet`    | Mainnet + `test-results-simulate-mainnet.xml`                                                   |
| `pnpm test:ci:e2e:coverage`   | **`pnpm exec tsx scripts/run-e2e.ts --testnet --coverage`**                                    |

**GitHub Actions** shards **`pnpm exec tsx scripts/run-e2e.ts --testnet … --shard=i/3`** across three runners. Use **`pnpm test:e2e:mainnet`** (or **`WATERX_E2E_NETWORK=mainnet`**) when you intentionally exercise **mainnet** and config is complete.

## Simulate / e2e: network + discovery

- **Network:** `scripts/run-e2e.ts` / **`test/helpers/e2e/e2e-client.ts`**: **`--testnet`** / **`--mainnet`** (CLI) → **`WATERX_E2E_NETWORK`** → **`testnet`** default when unspecified (`pnpm test` runs Vitest without `run-e2e.ts`, so it relies on this fallback).
- **Oracle:** Pyth Hermes + **`refreshOraclePrices`** / **`updatePythPrices`** (`src/utils/pyth.ts`, **`test/helpers/e2e/e2e-oracle-context.ts`**). There is **no** legacy bucket-aggregator prime step.
- **gRPC:** optional **`WATERX_E2E_GRPC_URL`**; parallelism **`WATERX_E2E_MAX_FORKS=2`…`8`** if your RPC tolerates it.

## Integration (trader) — paused in Vitest

- Intended env: **`WATERX_INTEGRATION_PRIVATE_KEY`** or **`.integration-trader.keystore`** (`test/integration/setup.ts`).
- **`integration-trader`** project **`include: []`** disables **`pnpm test:integration`** until Move/SDK builders match v3 end-to-end.
- Helpers such as **`getAccountsByOwner`**, **`getAccountOwnerByAccountId`** apply to **wxa** **`account_id`** (not legacy user-account ids).

## TypeScript scope

Root **`tsconfig.json`** **`include`** covers **`test/helpers/**/*.ts`** so e2e helpers typecheck with the SDK; legacy-only helpers remain **`exclude`** where still v2-shaped (**`wlp-mint-simulate-tx`**, **`market-summary-assertions`**).

## Related: oracle debug (not Vitest)

| Command                  | Purpose                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm oracle:aggregates` | `scripts/print-oracle-aggregates.ts` (Hermes Pyth refresh + oracle PTB **simulate** for markets/collaterals; no private key; `-- --format raw` / `--help`) |

Admin-keystore flows live on branch **`integration/admin-e2e-parked`**.
