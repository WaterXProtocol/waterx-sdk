# Tests

PRs to `main` run [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): `Lint`, `Typecheck`, `Build`, then **`pnpm test:ci:unit`** and **`pnpm test:ci:e2e`** (simulate only; same sequence as `pnpm test:ci` / `test:ci:full`). Legacy duplicate workflows were removed.

## Vitest projects

| Project                | Glob                                         | Notes                                                    |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **unit**               | `src/**/*.test.ts`, `test/unit/**/*.test.ts` | Fast, no chain                                           |
| **e2e**                | `test/simulate/**/*.test.ts`                 | Testnet `simulateTransaction`; single fork (rate limits). Scratch perp flows are **data-driven** from `test/helpers/scratch/scratch-trading-scenarios.ts` (`scratchTradingScenarios()` = every enabled `LIFECYCLE_TEST_MARKETS` base): oracle `approxPrice`, explicit size + fee check, on-chain resize, optional table `approxPrice` (BTC), and per-base stateful PTBs when a live position exists. |
| **integration-trader** | `test/integration/user/**/*.test.ts`         | Real `signAndExecute`; needs trader key (see below). **Single fork** by default so one Node process owns the `execTx` queue for the shared signer (see `vitest.config.ts` / `WATERX_INTEGRATION_MAX_FORKS`). |

**E2e skipped vs PRD gaps:** Vitest **skipped** counts **runtime** `ctx.skip` (missing account, low balance, transient oracle, no WLP, etc.). PRD rows that are **out of scope** for this suite are **block comments** in `test/simulate/prd-product-coverage.test.ts`, not `it.skip`, so the skip total reflects environment/state rather than placeholder tests.

## Daily commands

| Command                                  | What it runs                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm test`                              | **unit** + **e2e** (default local suite; e2e defaults to **mainnet**)             |
| `pnpm test:unit`                         | unit only                                                                         |
| `pnpm test:e2e`                          | simulate / e2e only, **mainnet** by default                                       |
| `pnpm test:e2e --testnet`                | simulate / e2e against **testnet**                                                |
| `pnpm test:e2e --mainnet`                | simulate / e2e against mainnet (explicit; same as bare `test:e2e`)                |
| `pnpm test:e2e:testnet`                  | short alias for `pnpm test:e2e --testnet`                                         |
| `pnpm test:e2e:mainnet`                  | short alias for `pnpm test:e2e --mainnet`                                         |
| `pnpm test:watch`                        | unit + e2e in watch mode                                                          |
| `pnpm test:coverage`                     | unit + e2e with coverage (`src/**/*.ts`)                                          |
| `pnpm test:all`                          | All Vitest projects (unit + e2e + integration-trader)                             |
| `pnpm test:integration`                  | integration-trader only                                                           |
| `pnpm test:integration:lifecycle`        | `trader-position-lifecycle.test.ts`                                               |
| `pnpm test:integration:market-config`    | `trader-market-onchain-config.test.ts`                                            |
| `pnpm test:integration:persistent-state` | `trader-e2e-persistent-state.test.ts`                                             |

All positional args and unknown flags passed after `pnpm test:e2e` are forwarded to `vitest run --project e2e`, so
`pnpm test:e2e --testnet -t "TC-TRADE-003"` and `pnpm test:e2e test/simulate/fetch-errors.test.ts --mainnet` both work.

## CI-style commands

| Command                       | Purpose                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm test:ci`                | **`test:ci:full`**: unit (coverage + JUnit) then simulate e2e (JUnit, mainnet default) |
| `pnpm test:ci:unit`           | Unit + coverage + `test-results-unit.xml`                                              |
| `pnpm test:ci:e2e`            | Simulate e2e (mainnet default) + `test-results-simulate.xml`                           |
| `pnpm test:ci:e2e:testnet`    | Same but forces testnet + `test-results-simulate-testnet.xml`                          |
| `pnpm test:ci:e2e:mainnet`    | Same but forces mainnet + `test-results-simulate-mainnet.xml` (explicit)               |
| `pnpm test:ci:e2e:coverage`   | `pnpm test:e2e --coverage` (mainnet default)                                           |

## Simulate / e2e: network + discovery

- **Network:** `test/helpers/e2e/e2e-client.ts` resolves the target network in this order: CLI flag **`--testnet`** / **`--mainnet`** (highest), env var **`WATERX_E2E_NETWORK=testnet|mainnet`**, then **mainnet** (default). `WaterXClient.testnet()` / `WaterXClient.mainnet()` / `WaterXClient.forE2e()` pick the matching package ids.
- **Positions:** simulate tests discover open perps via **`getMarketPositions`** and (when needed) **`getAccountOwnerByAccountId`** (`test/helpers/e2e/fetch-read-helpers-for-tests.ts`, not a root SDK export) so PTBs use the real position owner as sender. Helpers live in **`test/helpers/e2e/discover-on-chain-position.ts`**.
- **Integration account:** **`WATERX_INTEGRATION_ACCOUNT_ID`** (optional) must be one of **`getAccountsByOwner(client, signer)`**; otherwise the first account is used (`test/integration/setup.ts`, `test/integration/helpers/account-bootstrap.ts`).

## Integration (trader)

- Env: set **`WATERX_INTEGRATION_PRIVATE_KEY`** or use **`.integration-trader.keystore`** (see `test/integration/setup.ts`).
- Config loads **`.env`** then **`.env.local`** (local only fills keys not already set in the shell).
- **`execTx`** serializes `signAndExecute` **within one Vitest worker**; the integration project defaults to **one fork** so all signing runs in that process. Set **`WATERX_INTEGRATION_MAX_FORKS=2`…`8`** only if the wallet has enough **SUI for gas** and you accept parallel files (otherwise you can see `insufficient SUI` / nonce issues).
- Optional **`WATERX_INTEGRATION_APPROX_PRICE_CHAIN=1`**: enables an extra opt-in `it` in `trader-position-lifecycle.test.ts` that **signs** `buildOpenPositionTx` with **`approxPrice`** (small `simulateOpenCollateral` on the first `WATERX_INTEGRATION_BASES` base, then close). Default scratch lifecycle uses on-chain `resize` only. This does **not** run under **`pnpm test:e2e`** (no private key); e2e **simulates** table-`approxPrice` for **BTC** via the same scenario table.
- **Data-driven scratch trading**: `scratchTradingScenarios()` drives both **`trader-position-lifecycle.test.ts`** (full on-chain chain via `runScratchTradingScenarioIntegration`) and **`tx-builders-simulate.test.ts`** opens + stateful blocks (via `run-scratch-trading-scenario-simulate.ts`). Add/remove markets in `lifecycle-test-markets.ts`; expectations/constants live in `scratch-trading-scenarios.ts` (`SCRATCH_EXPECT`).

In code, **`listAllAccountPositions(client, accountId, maxScan)`** / **`listAccountPositionsInMarket`** / **`getMarketPositions`** operate on **`accountId`** (UserAccount object id) and on-chain market state.

## Related: oracle debug (not Vitest)

| Command                  | Purpose                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm oracle:aggregates` | Run `scripts/print-oracle-aggregates.ts` (Hermes Pyth refresh + oracle PTB **simulate** for all markets/collaterals; no private key; `-- --format raw` / `--help`) |

Admin-keystore flows (mint USDC, bootstrap wallets, broader integration suites) live on branch **`integration/admin-e2e-parked`**.
