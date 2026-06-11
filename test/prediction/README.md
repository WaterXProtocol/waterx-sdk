# Tests — quick reference

Run from the repo root.

## Run tests

| Command                                                     | What it runs                                                                                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:unit:predict`                                    | `test/prediction/unit/**/*.test.ts` (offline)                                                                                                                                            |
| `pnpm test:e2e:predict`                                     | `test/prediction/e2e/**/*.test.ts` (testnet simulate; no signer)                                                                                                                         |
| `pnpm test:integration:predict:all`                         | Integration sign + execute (`SUI_PRIVATE_KEY`; manual, not CI)                                                                                                                           |
| `pnpm test:api:local`                                       | HTTP API smoke (`test/prediction/api/`; backend must be up)                                                                                                                              |
| `pnpm test:api:staging`                                     | Same against `api/environments/staging.json`                                                                                                                                             |
| `pnpm test:integration:predict:crosscheck`                  | **Catalog** place + fill → poll `bets/me` → **hard** OrderFilled ↔ API; skips on indexer lag only                                                                                        |
| `pnpm predict:scan-claimable`                               | **Read-only** scan: `GET /claimable` `projectedPayoutUsd` ↔ chain (no place/fill; needs `E2E_API_ADDRESS` only)                                                                          |
| `pnpm test:integration:predict:settlement-crosscheck`       | Same audit as Vitest (`E2E_SETTLEMENT_CROSSCHECK=1`); simulate claim optional with `SUI_PRIVATE_KEY`                                                                                     |
| `E2E_HEADLESS_BET=1 pnpm test:integration:predict:headless` | **Full product loop**: catalog → `POST place` → sign `txBytes` → broker/keeper fill → `bets/me`                                                                                          |
| `pnpm test:integration:predict:journey`                     | User flow: API + **all PTBs simulate** + **catalog place → bets/me pending→filled** (same contract as `place-all-markets`); needs `pnpm seed:testnet` + `SUI_PRIVATE_KEY` + staging API. |
| `pnpm diagnose:bets-api`                                    | **Debug only** — print chain fixtures vs `GET /predict/bets/me` field matrix (`E2E_API_ADDRESS` or JWT; not a CI gate)                                                                   |
| `pnpm predict:scan-claimable`                               | **Read-only** — `GET /claimable` vs chain claim formula; no place/fill (`E2E_API_ADDRESS` only)                                                                                          |
| `pnpm predict:place-all-markets`                            | **Staging script** — scan browse, place + fill **$1.11** on **every tradeable side** (both sides per market by default)                                                                  |
| `pnpm predict:place-dry-run`                                | Same scan as above, **no txs** (`E2E_PLACE_ALL_DRY_RUN=1`)                                                                                                                               |
| `pnpm predict:place-broker-only`                            | Quick probe: 1 market, 1 side, broker-only fill wait                                                                                                                                     |
| `pnpm predict:place-and-watch`                              | **Place only** — one **$1.12** order, print `orderId`, exit (watch fill on frontend)                                                                                                     |
| `pnpm predict:refund-probe`                                 | **Refund probe** — unfillable `priceCapBps` → `OrderCancelled` + full wxa balance restore                                                                                                |
| `pnpm test:integration:predict:refund`                      | Vitest收錄同上（`E2E_CATALOG_REFUND=1`）                                                                                                                                                 |
| `pnpm predict:broker-matrix`                                | **Broker 入參矩陣** — 不同 priceCap/maxSpend，觀察 API + 鏈上 fill/cancel                                                                                                                |
| `pnpm test:integration:predict:broker-matrix`               | Vitest 收錄（`E2E_BROKER_MATRIX=1`）                                                                                                                                                     |

### CI vs local integration

| 層級             | CI（`.github/workflows/ci.yml`）                  | 本機 only                                                 |
| ---------------- | ------------------------------------------------- | --------------------------------------------------------- |
| **unit**         | `predict-unit`                                    | —                                                         |
| **e2e simulate** | `predict-e2e`（唯讀 RPC，無 key）                 | —                                                         |
| **integration**  | 不跑（需 `SUI_PRIVATE_KEY`、staging API、真錢包） | `test:integration:predict:*`、refund/broker-matrix probes |

Refund / broker-matrix / headless / crosscheck / settlement-crosscheck 都屬 **staging 實盤探測**，適合本機或手動 pipeline，不進 PR CI。

**Staging fill policy:** catalog integration（headless / crosscheck / place-all）預設只 **place + 等 backend broker**，不送 local `fillOrder`。後端掛了要解耦測試時設 `E2E_CATALOG_KEEPER_FALLBACK=1`。Keeper PTB 形狀仍用 `predict-e2e` simulate；testnet keeper execute 用 `predict-integration-keeper`。

## Layout

| Path                           | Purpose                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`unit/`](unit/)               | Offline mocks, snapshots, input validation                                                                                                                  |
| [`e2e/`](e2e/)                 | Testnet simulate (no signer); split by event category                                                                                                       |
| [`integration/`](integration/) | Signed + executed flows on testnet; one file per event family                                                                                               |
| [`api/`](api/)                 | HTTP API smoke (catalog, bets, consistency); opt-in manual                                                                                                  |
| [`helpers/`](helpers/)         | `discoverFixtures`, `integration-user-journey`, `journey-assertions`, `journey-event-assertions`, `query-prediction-events`, `api-wire` / `integration-api` |
| [`contract/`](contract/)       | Canonical Move event field matrix (`event-fields.ts`) for indexer contract tests                                                                            |
| [`fixtures/`](fixtures/)       | Test-only IDs + the (git-ignored) `testnet-seeded.json` snapshot                                                                                            |
| [`COVERAGE.md`](COVERAGE.md)   | 14 indexer event × test file × required-key matrix                                                                                                          |

### E2E files (simulate only)

| File                                                     | Indexer events exercised                                                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
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

| File                                                                                                                     | Asserts events                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| [`account.test.ts`](integration/account.test.ts)                                                                         | `AccountCreated` (from `waterx_account`)                                                                                          |
| [`order.test.ts`](integration/order.test.ts)                                                                             | `OrderPlaced` / `OrderFilled` / `OrderCancelled`                                                                                  |
| [`close.test.ts`](integration/close.test.ts)                                                                             | `CloseRequested` / `CloseConfirmed` / `CloseCancelled`                                                                            |
| [`claim.test.ts`](integration/claim.test.ts)                                                                             | `MarketResolved` / `PositionClaimed`                                                                                              |
| [`admin.test.ts`](integration/admin.test.ts)                                                                             | All admin events (round-trips so the suite is idempotent)                                                                         |
| [`api-crosscheck.test.ts`](integration/api-crosscheck.test.ts)                                                           | Catalog place (+ fill) → poll `bets/me` + hard assert / field audit (`E2E_API_CROSSCHECK=1`)                                      |
| [`settlement-claimable-crosscheck.integration.test.ts`](integration/settlement-claimable-crosscheck.integration.test.ts) | Read-only: `GET /claimable` vs chain (`E2E_SETTLEMENT_CROSSCHECK=1`, wallet only); optional claim simulate with `SUI_PRIVATE_KEY` |
| [`headless-catalog-bet.integration.test.ts`](integration/headless-catalog-bet.integration.test.ts)                       | Full catalog loop (`E2E_HEADLESS_BET=1`)                                                                                          |
| [`catalog-refund.integration.test.ts`](integration/catalog-refund.integration.test.ts)                                   | Unfillable cap → refund (`E2E_CATALOG_REFUND=1`)                                                                                  |
| [`broker-matrix.integration.test.ts`](integration/broker-matrix.integration.test.ts)                                     | Place-input matrix (`E2E_BROKER_MATRIX=1`)                                                                                        |
| [`user-betting-journey.test.ts`](integration/user-betting-journey.test.ts)                                               | **Automation suite** (7 `it`s): preconditions → API → simulate PTBs → **event↔view↔API** (`journey-event-assertions.ts`)          |

See [`COVERAGE.md`](COVERAGE.md) for the full event ↔ key-tier matrix.

### API smoke files (HTTP, opt-in manual)

| File                                                                     | Covers                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [`predict.api.test.ts`](api/predict.api.test.ts)                         | `GET /predict/feed`, `/predict/browse`                                                  |
| [`markets.api.test.ts`](api/markets.api.test.ts)                         | `GET /predict/markets/{sport\|crypto}/:slug`                                            |
| [`markets-negative.api.test.ts`](api/markets-negative.api.test.ts)       | Invalid slug → 404                                                                      |
| [`catalog-consistency.api.test.ts`](api/catalog-consistency.api.test.ts) | Feed slug ↔ detail consistency                                                          |
| [`bets.api.test.ts`](api/bets.api.test.ts)                               | `GET /predict/bets/me`, `/summary`, `/claimable`, `/:betId/detail` (`?address=` wallet) |
| [`bets-tx.api.test.ts`](api/bets-tx.api.test.ts)                         | `POST /predict/bets/place`, `/claim` (400 validation + opt-in `E2E_API_TX_BUILD=1`)     |
| [`events.api.test.ts`](api/events.api.test.ts)                           | `GET /predict/events/:slug`                                                             |
| [`quotes.api.test.ts`](api/quotes.api.test.ts)                           | `GET /predict/quotes`                                                                   |
| [`report.api.test.ts`](api/report.api.test.ts)                           | Pretty-print live JSON (`--report` flag)                                                |

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

| Variable                                     | Role                                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_API_ENV`                                | `staging` (default) or `local` → loads `test/prediction/api/environments/{name}.json` (`https://api-waterx.up.railway.app`)                     |
| `E2E_API_BASE_URL`                           | Fallback when JSON `baseUrl` is empty                                                                                                           |
| `E2E_API_ADDRESS`                            | Wallet for `GET /predict/bets/me*` (`?address=0x…`; preferred over JWT decode)                                                                  |
| `E2E_API_JWT`                                | Optional — `suiAddress` claim used as bets wallet when `E2E_API_ADDRESS` unset                                                                  |
| `E2E_API_CROSSCHECK`                         | `1` — integration polls `bets/me` after place+fill; hard-asserts fill wire vs chain when row found                                              |
| `E2E_SETTLEMENT_CROSSCHECK`                  | `1` — read-only claimable scan in Vitest; **no** `SUI_PRIVATE_KEY` required for the main `it`                                                   |
| `E2E_SETTLEMENT_CROSSCHECK_POLL`             | `1` — CLI `predict:scan-claimable` polls when chain ahead of API (or pass `--poll`)                                                             |
| `E2E_SETTLEMENT_CROSSCHECK_POLL_MS`          | Settlement crosscheck: poll claimable when chain has resolved position but API empty (default `60000`)                                          |
| `E2E_SETTLEMENT_CROSSCHECK_POLL_INTERVAL_MS` | Settlement crosscheck poll interval (default `2000`)                                                                                            |
| `E2E_SETTLEMENT_CROSSCHECK_MAX_ROWS`         | Cap rows asserted per run (default `20`)                                                                                                        |
| `E2E_API_CROSSCHECK_STRICT`                  | `1` — also fail on supplemental field-audit mismatches (default: log only)                                                                      |
| `E2E_API_CROSSCHECK_BROKER_WAIT_MS`          | Crosscheck: broker wait before keeper fill (default `30000`; bypass fills are usually seconds)                                                  |
| `E2E_API_CROSSCHECK_BETS_POLL_MS`            | Crosscheck: `bets/me` poll timeout (default `60000`)                                                                                            |
| `E2E_API_CROSSCHECK_BETS_POLL_INTERVAL_MS`   | Crosscheck: poll interval (default `2000`)                                                                                                      |
| `E2E_STAGING_BET_USD`                        | Staging catalog place + keeper fill in USD (default **`1.11`**; **`1.12`** on `predict:place-and-watch`; use `2.22`, `3.33` for parallel slots) |
| `E2E_STAGING_MAX_SPEND`                      | Override in settlement base units (`1110000` = $1.11); alias: `E2E_API_CROSSCHECK_MAX_SPEND`                                                    |
| `E2E_CATALOG_REFUND`                         | `1` — run `catalog-refund.integration.test.ts` / `test:integration:predict:refund`                                                              |
| `E2E_CATALOG_REFUND_WAIT_MS`                 | Refund probe: wait for `OrderCancelled` (default **90000**)                                                                                     |
| `E2E_BROKER_MATRIX`                          | `1` — run `broker-matrix.integration.test.ts`                                                                                                   |
| `E2E_BROKER_MATRIX_SCENARIOS`                | Comma filter, e.g. `fillable-normal,tight-701`                                                                                                  |
| `E2E_BROKER_MATRIX_FILL_WAIT_MS`             | Matrix fillable scenarios (default **45000**)                                                                                                   |
| `E2E_BROKER_MATRIX_REFUND_WAIT_MS`           | Matrix tight-cap scenarios (default **90000**)                                                                                                  |
| `E2E_HEADLESS_BET`                           | `1` — full catalog bet loop: `POST place` → sign `txBytes` → fill → poll `bets/me`                                                              |
| `E2E_HEADLESS_BROKER_WAIT_MS`                | Headless: broker wait before keeper fill (default **90000**)                                                                                    |
| `E2E_HEADLESS_BETS_POLL_MS`                  | Headless: `bets/me` poll timeout (default **120000**)                                                                                           |
| `E2E_PLACE_EXPIRY_MS`                        | Catalog place order expiry window (default **90000** ≈ 90s)                                                                                     |
| `E2E_PLACE_PRICE_CAP_BPS`                    | Override `priceCapBps` on catalog place (default: `oddsCents + 1`)                                                                              |
| `E2E_PLACE_ALL_DRY_RUN`                      | `1` — scan catalog only, no place txs (`pnpm predict:place-dry-run`)                                                                            |
| `E2E_PLACE_ALL_LIMIT`                        | Cap number of markets (× sides unless `ONE_SIDE`)                                                                                               |
| `E2E_PLACE_ALL_ONE_SIDE`                     | `1` — first tradeable side per market only                                                                                                      |
| `E2E_PLACE_ALL_PLACE_ONLY`                   | `1` — place tx only, skip fill wait (`predict:place-and-watch`)                                                                                 |
| `E2E_CATALOG_KEEPER_FALLBACK`                | `1` — **opt-in** local `fillOrder` after broker wait (default: broker-only; decoupled testing when backend is down)                             |
| `E2E_PLACE_ALL_BROKER_ONLY`                  | `1` force broker-only; `0` force keeper fallback for place-all only                                                                             |
| `E2E_PLACE_ALL_BROKER_WAIT_MS`               | Broker fill poll (default **45000** broker-only / **10000** with keeper fallback)                                                               |
| `E2E_PLACE_ALL_CONCURRENCY`                  | Parallel **broker wait** after sequential place (default **1**; keep ≤3 on public RPC)                                                          |
| `E2E_PLACE_ALL_DELAY_MS`                     | Pause between markets (default **1500**)                                                                                                        |
| `E2E_PLACE_ALL_SEGMENTS`                     | Comma filter: `sport,crypto,politics` (default: sport+crypto)                                                                                   |
| `E2E_PLACE_ALL_INCLUDE_FEED`                 | `1` — also probe `GET /predict/feed`                                                                                                            |
| `E2E_PLACE_ALL_FEED_LIMIT`                   | Browse/feed page size (default **500**)                                                                                                         |
| `E2E_PLACE_ALL_CRYPTO_EPOCHS`                | `1` — include crypto upcoming windows (`?epoch=<endsAt>`)                                                                                       |
| `E2E_PLACE_ALL_CRYPTO_EPOCH_LIMIT`           | Max upcoming windows per crypto slug (default **3**)                                                                                            |
| `E2E_API_TX_BUILD`                           | Staging API smoke enables tx-build by default; set `0` to opt out. `1` — catalog → `POST /predict/bets/place` → `txBytes` closed loop           |
| `E2E_API_PLACE_ACCOUNT_ID`                   | wxa registry `accountId` for place tx-build (fallback: `E2E_ACCOUNT_ID`)                                                                        |
| `E2E_API_PLACE_SENDER`                       | wallet `sender` for place tx-build (fallback: `E2E_ACCOUNT_OWNER` / JWT `suiAddress`)                                                           |

**Staging bet amounts:** catalog / crosscheck / headless default to **$1.11** (`helpers/staging-amounts.ts`). Parallel runs: `E2E_STAGING_BET_USD=2.22` or `3.33` (slot × $1.11). Example bulk run:

```bash
E2E_STAGING_BET_USD=1.03 E2E_PLACE_ALL_BROKER_ONLY=1 E2E_PLACE_ALL_CONCURRENCY=3 pnpm predict:place-all-markets
```

```bash
# Local backend (bucket-backend-mono: pnpm run waterx:dev → :3003)
pnpm test:api:local

# Staging (see api/environments/staging.json)
pnpm test:api:staging

# Pretty-print live JSON responses
node test/prediction/scripts/run-api-tests.mjs --env staging --report
node test/prediction/scripts/run-api-tests.mjs --env staging --report=feed,browse
node test/prediction/scripts/run-api-tests.mjs --env staging --report-only

# Chain → HTTP cross-check (staging API; wallet from integration signer)
pnpm test:integration:predict:crosscheck

# Read-only claimable scan (no place/fill — safe while broker is under test)
E2E_API_ADDRESS=0x… pnpm predict:scan-claimable
# Poll when chain has resolved positions but API list is still empty:
E2E_API_ADDRESS=0x… pnpm predict:scan-claimable --poll

# Vitest gate (same audit; optional simulate if SUI_PRIVATE_KEY set)
E2E_API_ADDRESS=0x… pnpm test:integration:predict:settlement-crosscheck

# Headless frontend E2E (catalog → place → execute → fill → bets/me)
E2E_HEADLESS_BET=1 pnpm test:integration:predict:headless

# Catalog → tx-build closed loop (feed/detail trade → POST place → txBytes)
# After `pnpm seed:testnet`, credentials come from testnet-seeded.json automatically.
E2E_API_TX_BUILD=1 pnpm test:api:local
# Staging: API chain must recognize your accountId (set E2E_API_PLACE_* explicitly).
E2E_API_TX_BUILD=1 E2E_API_PLACE_ACCOUNT_ID=0x... E2E_API_PLACE_SENDER=0x... pnpm test:api:staging
```

If the backend is down, API tests **skip** with `API unreachable` instead of failing.

## Expected pass / fail (this commit)

| Suite                                   | CI / default                  | Notes                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:unit:predict`                | **Should pass** (~290 tests)  | Offline; no backend                                                                                                                                                                                                   |
| `pnpm test:e2e:predict`                 | Pass with `pnpm seed:testnet` | Simulate-only                                                                                                                                                                                                         |
| `pnpm test:integration:predict:journey` | Pass with seed                | Simulate PTBs; API steps skip when unreachable                                                                                                                                                                        |
| `pnpm test:api:staging`                 | **May skip** without wallet   | `GET /predict/bets/me*` is public since backend #601 — requires `?address=0x…` (`E2E_API_ADDRESS` or JWT `suiAddress`). Empty `bets[]` is valid when the wallet has no history. `quotes` may 500 if CH indexer empty. |
| `…:crosscheck`                          | Opt-in manual                 | Catalog place+fill → hard OrderFilled ↔ `bets/me`; skip only on poll lag                                                                                                                                              |
| `E2E_HEADLESS_BET=1 …:headless`         | Opt-in manual                 | Catalog place+fill; step 5 asserts `marketSlug` + id match when `bets/me` returns                                                                                                                                     |
| `…:settlement-crosscheck`               | Opt-in manual                 | Claimable `projectedPayoutUsd` ↔ chain formula; skip when no resolved unclaimed rows                                                                                                                                  |

API route matrix: [`helpers/api-endpoints.ts`](helpers/api-endpoints.ts) mirrors codex backend; production `src/` unchanged.

**Local JWT (dev):** `pnpm mint:api-jwt` signs with the same `JWT_SECRET` as `apps/waterx/.env` (override via `WATERX_ENV=...`) and writes `E2E_API_JWT` into repo-root `.env`. Use `--address 0x...` or set `SUI_PRIVATE_KEY` in `.env`.

**Staging bets wallet:** set `E2E_API_ADDRESS=0x…` (same wallet as your seed/integration signer), or run `pnpm mint:api-jwt:staging` so `E2E_API_JWT` carries `suiAddress`. Without a wallet, bets/me tests skip; HTTP 400 `20002` means `?address=` was omitted (not a JWT failure).

## Coverage

```bash
pnpm test:unit --coverage
pnpm test:e2e --coverage
```
