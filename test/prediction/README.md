# Tests — quick reference

Run from the repo root.

## Run tests

| Command                        | What it runs                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `pnpm test` / `pnpm test:unit` | `test/prediction/unit/**/*.test.ts` (offline)                                                               |
| `pnpm test:e2e`                | `test/prediction/e2e/**/*.test.ts` (testnet dry-run simulate; network only)                             |
| `pnpm test:integration`        | `test/prediction/integration/**/*.test.ts` (sign + execute; `SUI_PRIVATE_KEY` required, opt-in) |
| `pnpm test:all`                | All three Vitest projects                                                                         |

## Layout

| Path                           | Purpose                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| [`unit/`](unit/)               | Offline mocks, snapshots, input validation                                       |
| [`e2e/`](e2e/)                 | Testnet simulate (no signer); split by event category                            |
| [`integration/`](integration/) | Signed + executed flows on testnet; one file per event family                    |
| [`helpers/`](helpers/)         | `discoverFixtures`, `setupIntegration`, `expectEvent`, skip helpers              |
| [`contract/`](contract/)       | Canonical Move event field matrix (`event-fields.ts`) for indexer contract tests |
| [`fixtures/`](fixtures/)       | Test-only IDs + the (git-ignored) `testnet-seeded.json` snapshot                 |
| [`COVERAGE.md`](COVERAGE.md)   | 14 indexer event × test file × required-key matrix                               |

### E2E files (simulate only)

| File                                                             | Indexer events exercised                                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`account.test.ts`](e2e/account.test.ts)                 | (no event; whitelist / withdraw policy are permanent skips)                                                                                          |
| [`admin.test.ts`](e2e/admin.test.ts)                     | `MarketPaused` / `MarketUnpaused` / `MarketRegistryWithdrawn` / `MinReserveUpdated` / `OrderCancelCooldownUpdated` / `KeeperAdded` / `KeeperRemoved` |
| [`order.test.ts`](e2e/order.test.ts)                     | `OrderPlaced` / `OrderFilled` / `OrderCancelled`                                                                                                     |
| [`close.test.ts`](e2e/close.test.ts)                     | `CloseRequested` / `CloseConfirmed` / `CloseCancelled`                                                                                               |
| [`claim.test.ts`](e2e/claim.test.ts)                     | `PositionClaimed`                                                                                                                                    |
| [`market.test.ts`](e2e/market.test.ts)                   | `MarketResolved`                                                                                                                                     |
| [`fetch.test.ts`](e2e/fetch.test.ts)                     | view-layer sanity (no event)                                                                                                                         |
| [`client.test.ts`](e2e/client.test.ts)                   | client construction + grpc plumbing                                                                                                                  |
| [`negative.test.ts`](e2e/negative.test.ts)               | abort-code coverage                                                                                                                                  |
| [`generated-smoke.test.ts`](e2e/generated-smoke.test.ts) | codegen smoke                                                                                                                                        |
| [`subpaths.test.ts`](e2e/subpaths.test.ts)               | package export paths                                                                                                                                 |

### Integration files (sign + execute, opt-in)

| File                                                                     | Asserts events                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| [`account.test.ts`](integration/account.test.ts) | `AccountCreated` (from `waterx_account`)                  |
| [`order.test.ts`](integration/order.test.ts)     | `OrderPlaced` / `OrderFilled` / `OrderCancelled`          |
| [`close.test.ts`](integration/close.test.ts)     | `CloseRequested` / `CloseConfirmed` / `CloseCancelled`    |
| [`claim.test.ts`](integration/claim.test.ts)     | `MarketResolved` / `PositionClaimed`                      |
| [`admin.test.ts`](integration/admin.test.ts)     | All admin events (round-trips so the suite is idempotent) |

See [`COVERAGE.md`](COVERAGE.md) for the full event ↔ key-tier matrix.

## Discovery / fixtures

`discoverFixtures()` (in [`helpers/e2e-discovery.ts`](helpers/e2e-discovery.ts)) returns rich per-state ids:

| Field                                  | Meaning                                              | Sourced from                            |
| -------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `accountId`, `accountReady`            | active registry account + whether it has data        | env / seed fixture / chain scan         |
| `openOrderId`                          | OPEN unfilled order belonging to the account         | seed fixture, then order cursor         |
| `openPositionId`                       | OPEN position belonging to the account               | seed fixture, then position cursor      |
| `pendingClosePositionId`               | PENDING_CLOSE position (for `selfCancelClose`)       | seed fixture, then position cursor      |
| `claimablePositionId`                  | OPEN position whose market is RESOLVED (for `claim`) | seed fixture, then resolved-market scan |
| `openMarketIdHex` / `claimMarketIdHex` | unresolved / resolved test markets                   | seed fixture, then cursors              |
| `usdCoinObjectId`                      | settlement coin object for payment PTBs              | `listCoins(owner)`                      |

The seed fixture file (`fixtures/testnet-seeded.json`) is **git-ignored** and refreshed by `pnpm seed:testnet`.

## `.env` precedence

1. Process env vars (highest)
2. Repo-root `.env` (loaded by `test/prediction/setup-integration.ts` and the seed script)
3. `test/prediction/fixtures/testnet-seeded.json` (read by `discoverFixtures()`)
4. WaterXProtocol/waterx-config defaults (lowest)

E2E / CI do not require a `.env` file. Integration tests require at least `SUI_PRIVATE_KEY`; some require `E2E_KEEPER_PRIVATE_KEY` (or an owner that is also a registered keeper).

## Coverage

```bash
pnpm test:unit --coverage
pnpm test:e2e --coverage
```
