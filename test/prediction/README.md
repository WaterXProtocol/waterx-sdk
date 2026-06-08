# Tests — quick reference

Run from the repo root.

## Run tests

| Command | What it runs |
| ------- | ------------ |
| `pnpm test:unit:predict` | `test/prediction/unit/**/*.test.ts` (offline) |
| `pnpm test:e2e:predict` | `test/prediction/e2e/**/*.test.ts` (testnet simulate; no signer) |
| `pnpm test:integration:predict:all` | Integration sign + execute (`SUI_PRIVATE_KEY`; manual, not CI) |
| `pnpm test:api:local` | HTTP API smoke (`test/prediction/api/`; backend must be up) |
| `pnpm test:api:staging` | Same against `api/environments/staging.json` |
| `E2E_API_CROSSCHECK=1 pnpm test:integration:predict:crosscheck` | On-chain place (+ fill) → poll `GET /predict/bets/me` |
| `E2E_HEADLESS_BET=1 pnpm test:integration:predict:headless` | **Full product loop**: catalog → `POST place` → sign `txBytes` → broker/keeper fill → `bets/me` |
| `pnpm test:integration:predict:journey` | User flow: API + **all PTBs simulate** (no keeper key); needs `pnpm seed:testnet`. On bypass testnet, `fillOrder` step is skipped when only `openPositionId` exists. |
| `pnpm diagnose:bets-api` | **Debug only** — print chain fixtures vs `GET /predict/bets/me` field matrix (JWT optional; not a CI gate while API/indexer catch up) |

## Layout

| Path                           | Purpose                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| [`unit/`](unit/)               | Offline mocks, snapshots, input validation                                       |
| [`e2e/`](e2e/)                 | Testnet simulate (no signer); split by event category                            |
| [`integration/`](integration/) | Signed + executed flows on testnet; one file per event family                    |
| [`api/`](api/)                 | HTTP API smoke (catalog, bets, consistency); opt-in manual                     |
| [`helpers/`](helpers/)         | `discoverFixtures`, `integration-user-journey`, `journey-assertions`, `journey-event-assertions`, `query-prediction-events`, `api-wire` / `integration-api` |
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
| [`api-crosscheck.test.ts`](integration/api-crosscheck.test.ts) | Chain `placeOrder` (+ fill) → poll `GET /predict/bets/me` (`E2E_API_CROSSCHECK=1`) |
| [`user-betting-journey.test.ts`](integration/user-betting-journey.test.ts) | **Automation suite** (7 `it`s): preconditions → API → simulate PTBs → **event↔view↔API** (`journey-event-assertions.ts`) |

See [`COVERAGE.md`](COVERAGE.md) for the full event ↔ key-tier matrix.

### API smoke files (HTTP, opt-in manual)

| File | Covers |
| ---- | ------ |
| [`predict.api.test.ts`](api/predict.api.test.ts) | `GET /predict/feed`, `/predict/browse` |
| [`markets.api.test.ts`](api/markets.api.test.ts) | `GET /predict/markets/{sport\|crypto}/:slug` |
| [`markets-negative.api.test.ts`](api/markets-negative.api.test.ts) | Invalid slug → 404 |
| [`catalog-consistency.api.test.ts`](api/catalog-consistency.api.test.ts) | Feed slug ↔ detail consistency |
| [`bets.api.test.ts`](api/bets.api.test.ts) | `GET /predict/bets/me`, `/summary`, `/claimable`, `/:betId/detail` (JWT) |
| [`bets-tx.api.test.ts`](api/bets-tx.api.test.ts) | `POST /predict/bets/place`, `/claim` (400 validation + opt-in `E2E_API_TX_BUILD=1`) |
| [`events.api.test.ts`](api/events.api.test.ts) | `GET /predict/events/:slug` |
| [`quotes.api.test.ts`](api/quotes.api.test.ts) | `GET /predict/quotes` |
| [`report.api.test.ts`](api/report.api.test.ts) | Pretty-print live JSON (`--report` flag) |

Endpoint matrix: [`helpers/api-endpoints.ts`](helpers/api-endpoints.ts).

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

1. **Shell export** (highest) — `export SUI_PRIVATE_KEY=...` before `pnpm …`
2. **`.env.local`** overrides **`.env`** for the same key (via `scripts/load-repo-env.ts`; used by integration/API setup + seed)
3. Put **secrets only in `.env.local`** (gitignored); keep `.env` for non-secret defaults or team-shared placeholders
4. `test/prediction/fixtures/testnet-seeded.json` (fixture ids for discovery)
5. `waterx-config` defaults (lowest)

**API base URL exception:** `test/prediction/api/environments/{local|staging}.json` `baseUrl` wins over `E2E_API_BASE_URL` in `.env`, so `pnpm test:api:staging` is not sent to localhost by mistake.

E2E / CI do not require a `.env` file. Integration tests require at least `SUI_PRIVATE_KEY` (or `WATERX_INTEGRATION_PRIVATE_KEY`); some require `E2E_KEEPER_PRIVATE_KEY` (or an owner that is also a registered keeper).

Integration and API tests are **manual / local only** — not wired into CI.

## API environments (Postman-style)

Switch targets via JSON environment file + env var overrides:

| Variable | Role |
| -------- | ---- |
| `E2E_API_ENV` | `local` (default) or `staging` → loads `test/prediction/api/environments/{name}.json` |
| `E2E_API_BASE_URL` | Fallback when JSON `baseUrl` is empty |
| `E2E_API_JWT` | Bearer token for `GET /predict/bets/me` |
| `E2E_API_CROSSCHECK` | `1` — integration polls `bets/me` after on-chain `placeOrder` (+ fill when keeper) |
| `E2E_HEADLESS_BET` | `1` — full catalog bet loop: `POST place` → sign `txBytes` → fill → poll `bets/me` |
| `E2E_HEADLESS_BROKER_WAIT_MS` | Optional broker wait before keeper fill (default `90000`) |
| `E2E_HEADLESS_BETS_POLL_MS` | Optional `bets/me` poll timeout (default `120000`) |
| `E2E_API_TX_BUILD` | `1` — catalog → `POST /predict/bets/place` → `txBytes` closed loop |
| `E2E_API_PLACE_ACCOUNT_ID` | wxa registry `accountId` for place tx-build (fallback: `E2E_ACCOUNT_ID`) |
| `E2E_API_PLACE_SENDER` | wallet `sender` for place tx-build (fallback: `E2E_ACCOUNT_OWNER` / JWT `suiAddress`) |

```bash
# Local backend (bucket-backend-mono: pnpm run waterx:dev → :3003)
pnpm test:api:local

# Staging (see api/environments/staging.json)
pnpm test:api:staging

# Pretty-print live JSON responses
node test/prediction/scripts/run-api-tests.mjs --env staging --report
node test/prediction/scripts/run-api-tests.mjs --env staging --report=feed,browse
node test/prediction/scripts/run-api-tests.mjs --env staging --report-only

# Chain → HTTP cross-check (needs SUI_PRIVATE_KEY + E2E_API_JWT + running API)
E2E_API_CROSSCHECK=1 pnpm test:integration:predict

# Headless frontend E2E (catalog → place → execute → fill → bets/me)
pnpm mint:api-jwt:staging   # refresh JWT if expired (30002)
E2E_HEADLESS_BET=1 pnpm test:integration:predict:headless

# Catalog → tx-build closed loop (feed/detail trade → POST place → txBytes)
# After `pnpm seed:testnet`, credentials come from testnet-seeded.json automatically.
E2E_API_TX_BUILD=1 pnpm test:api:local
# Staging: API chain must recognize your accountId (set E2E_API_PLACE_* explicitly).
E2E_API_TX_BUILD=1 E2E_API_PLACE_ACCOUNT_ID=0x... E2E_API_PLACE_SENDER=0x... pnpm test:api:staging
```

If the backend is down, API tests **skip** with `API unreachable` instead of failing.

## Expected pass / fail (this commit)

| Suite | CI / default | Notes |
| ----- | ------------ | ----- |
| `pnpm test:unit:predict` | **Should pass** (269 tests) | Offline; no backend |
| `pnpm test:e2e:predict` | Pass with `pnpm seed:testnet` | Simulate-only |
| `pnpm test:integration:predict:journey` | Pass with seed | Simulate PTBs; API steps skip when unreachable |
| `pnpm test:api:staging` | **May fail or skip** | Synced to `bucket-backend-mono` `codex/predict-position-transfer-split` (13 Bruno routes). Staging deploy is partial: `POST /predict/bets/place` works; authed `GET /predict/bets/me*` currently returns HTTP 400 `20002` (guard/deploy bug — not SDK JWT). `quotes` may 500 if CH indexer empty. |
| `E2E_HEADLESS_BET=1 …:headless` | **Step 5 often skips** | Steps 1–4 (catalog → place → fill) can pass; `bets/me` poll empty until backend `AccountResolver` + indexer align. Opt-in manual only. |

API route matrix: [`helpers/api-endpoints.ts`](helpers/api-endpoints.ts) mirrors codex backend; production `src/` unchanged.

**Local JWT (dev):** `pnpm mint:api-jwt` signs with the same `JWT_SECRET` as `apps/waterx/.env` (override via `WATERX_ENV=...`) and writes `E2E_API_JWT` into repo-root `.env`. Use `--address 0x...` or set `SUI_PRIVATE_KEY` in `.env`.

**Staging JWT:** staging uses wallet auth (`/auth/nonce` + sign), not local `JWT_SECRET`. Run `pnpm mint:api-jwt:staging` (needs `SUI_PRIVATE_KEY` or `WATERX_INTEGRATION_PRIVATE_KEY` in `.env` / `.env.local`) before `pnpm test:api:staging`; otherwise `/predict/bets/*` skips with 401.

## Coverage

```bash
pnpm test:unit --coverage
pnpm test:e2e --coverage
```
