# Tests

PRs to `main` run [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): `Lint`, `Typecheck`, `Build`, then **`pnpm test:ci:unit`** and **`pnpm test:ci:e2e`** (same sequence as `pnpm test:ci` / `test:ci:full`). Legacy duplicate workflows were removed.

## Vitest projects

| Project                | Glob                                         | Notes                                                    |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **unit**               | `src/**/*.test.ts`, `test/unit/**/*.test.ts` | Fast, no chain                                           |
| **e2e**                | `test/simulate/**/*.test.ts`                 | Testnet `simulateTransaction`; single fork (rate limits). Scratch perp flows are **data-driven** from `test/helpers/scratch-trading-scenarios.ts` (`scratchTradingScenarios()` = every enabled `LIFECYCLE_TEST_MARKETS` base): oracle `approxPrice`, explicit size + fee check, on-chain resize, optional table `approxPrice` (BTC), and per-base stateful PTBs when a live position exists. |
| **integration-trader** | `test/integration/user/**/*.test.ts`         | Real `signAndExecute`; needs trader key (see below)      |

**E2e skipped vs PRD gaps:** Vitest **skipped** counts **runtime** `ctx.skip` (missing account, low balance, transient oracle, no WLP, etc.). PRD rows that are **out of scope** for this suite are **block comments** in `test/simulate/prd-product-coverage.test.ts`, not `it.skip`, so the skip total reflects environment/state rather than placeholder tests.

## Daily commands

| Command                                  | What it runs                                          |
| ---------------------------------------- | ----------------------------------------------------- |
| `pnpm test`                              | **unit** + **e2e** (default local suite)              |
| `pnpm test:unit`                         | unit only                                             |
| `pnpm test:e2e`                          | simulate / e2e only                                   |
| `pnpm test:watch`                        | unit + e2e in watch mode                              |
| `pnpm test:coverage`                     | unit + e2e with coverage (`src/**/*.ts`)              |
| `pnpm test:all`                          | All Vitest projects (unit + e2e + integration-trader) |
| `pnpm test:integration`                  | integration-trader only                               |
| `pnpm test:integration:lifecycle`        | `trader-position-lifecycle.test.ts`                   |
| `pnpm test:integration:market-config`    | `trader-market-onchain-config.test.ts`                |
| `pnpm test:integration:persistent-state` | `trader-e2e-persistent-state.test.ts`                 |

## CI-style commands

| Command                     | Purpose                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `pnpm test:ci`              | **`test:ci:full`**: unit (coverage + JUnit) then e2e preflight + simulate (JUnit) |
| `pnpm test:ci:unit`         | Unit + coverage + `test-results-unit.xml`                                         |
| `pnpm test:ci:simulate`     | Simulate only + `test-results-simulate.xml`                                       |
| `pnpm test:ci:e2e`          | strict `e2e:preflight` then `test:ci:simulate` |
| `pnpm test:ci:e2e:coverage` | strict `e2e:preflight`, then `pnpm test:e2e -- --coverage` |
| `pnpm e2e:ci`               | Preflight gate then **`pnpm test:e2e`** (verbose reporters, not JUnit)            |

## Simulate / e2e helpers

| Command                        | Purpose                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm e2e:preflight`           | Check testnet objects / oracle / **wallet WLP + collaterals** for `wlp-simulate` (`scripts/e2e-preflight.ts`; CI adds `--allow-missing-wlp`) |
| `pnpm e2e:prepare`             | TTO USDC split, cooldown wait, **wallet WLP + collateral top-up** from account when possible (`scripts/e2e-prepare.ts`)              |
| `pnpm e2e:bootstrap-positions` | Bootstrap lifecycle positions for e2e                                                                                               |

## Integration (trader)

- Env: set **`WATERX_INTEGRATION_PRIVATE_KEY`** or use **`.integration-trader.keystore`** (see `test/integration/setup.ts`).
- Config loads **`.env`** then **`.env.local`** (local only fills keys not already set in the shell).
- **`execTx`** serializes `signAndExecute` for the shared trader wallet so parallel workers avoid nonce races.
- Optional **`WATERX_INTEGRATION_APPROX_PRICE_CHAIN=1`**: enables an extra opt-in `it` in `trader-position-lifecycle.test.ts` that **signs** `buildOpenPositionTx` with **`approxPrice`** (small `simulateOpenCollateral` on the first `WATERX_INTEGRATION_BASES` base, then close). Default scratch lifecycle uses on-chain `resize` only. This does **not** run under **`pnpm test:e2e`** (no private key); e2e **simulates** table-`approxPrice` for **BTC** via the same scenario table.
- **Data-driven scratch trading**: `scratchTradingScenarios()` drives both **`trader-position-lifecycle.test.ts`** (full on-chain chain via `runScratchTradingScenarioIntegration`) and **`tx-builders-simulate.test.ts`** opens + stateful blocks (via `run-scratch-trading-scenario-simulate.ts`). Add/remove markets in `lifecycle-test-markets.ts`; expectations/constants live in `scratch-trading-scenarios.ts` (`SCRATCH_EXPECT`).

## E2e: pinned perp `position_id` (optional)

Simulate tests resolve the reference **`UserAccount`** via **`resolveE2eAccountForOwner`** (`test/helpers/resolve-e2e-reference-account.ts`): **`WATERX_INTEGRATION_ACCOUNT_ID`** (optional) → committed **`INTEGRATION_REFERENCE_USER_ACCOUNT_ID`** → `getAccountsByOwner` first row. Owner address is **`INTEGRATION_REFERENCE_WALLET_ADDRESS`**. Then open positions are resolved by:

1. **`test/helpers/e2e-fixed-positions.ts`** — optional committed `E2E_FIXED_OPEN_POSITION_IDS`
2. Env **`E2E_FIXED_BTC_POSITION_ID`** (and `E2E_FIXED_ETH_POSITION_ID`, …)
3. **`.e2e-fixed-positions.local.json`** (committable) — same `accountId` only; auto-refreshed when you run **`pnpm e2e:preflight`** (runs **even if preflight exits 1**, so stale/missed BTC ids can be captured), **`pnpm e2e:prepare`**, **`pnpm e2e:bootstrap-positions`**, or **`pnpm diagnose:positions`** — skipped on **`GITHUB_ACTIONS`** or if **`E2E_NO_LOCAL_FIXED_POSITIONS=1`**

   **CI:** GitHub Actions never writes this file; **`pnpm test:ci:e2e`** uses **strict** preflight. Simulate tests can still skip stateful cases when runtime state is missing, but preflight no longer relaxes missing-position checks.

4. Fallback: scan the latest **10** global position ids on that market

Disable auto-write: **`--no-update-local-fixed-positions`** on those commands. Wider on-chain scan for the local file: **`E2E_LOCAL_FIXED_SCAN_MAX`** (default `8192`). If a previously stored id vanishes, the next refresh logs a **warning** (closed / liquidated / scan cap).

Use **`pnpm diagnose:positions`** to inspect BTC ids and refresh the local file. Pass **`--account-id 0x…`** (or **`WATERX_INTEGRATION_ACCOUNT_ID`**) to scan a fixed UserAccount without resolving owner → `accounts[0]`.

In code, **`listAllAccountPositions(client, accountId, maxScan)`** / **`listAccountPositionsInMarket`** / **`resolveE2eOpenPosition`** only need that **`accountId`** (UserAccount object id).

## Related: oracle debug (not Vitest)

| Command                  | Purpose                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm oracle:aggregates` | Run `scripts/print-oracle-aggregates.ts` (Hermes Pyth refresh + oracle PTB **simulate** for all markets/collaterals; no private key; `-- --format raw` / `--help`) |

Admin-keystore flows (mint USDC, bootstrap wallets, broader integration suites) live on branch **`integration/admin-e2e-parked`**.
