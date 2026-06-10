# Scripts

## Testnet seed (`pnpm seed:testnet`)

Builds on-chain state for `pnpm test:e2e` and `pnpm test:integration`. Each stage is **idempotent** — re-runs reuse existing on-chain state when a usable instance already exists. The resulting fixture ids are dumped to `test/prediction/fixtures/testnet-seeded.json` (git-ignored) and consumed by `discoverFixtures()`.

### 1. Create test-only keys

```bash
sui keytool generate ed25519        # owner key (your account)
sui keytool generate ed25519        # optional separate keeper key
```

### 2. Configure `.env`

```bash
cp .env.example .env
```

```env
SUI_PRIVATE_KEY=suiprivkey1...               # owner — required
E2E_KEEPER_PRIVATE_KEY=suiprivkey1...        # optional — registered keeper
SEED_DEPOSIT_AMOUNT=1000000                  # optional — default 1_000_000 base units
```

If `E2E_KEEPER_PRIVATE_KEY` is unset the script checks whether the owner itself is registered as a keeper; if not, **keeper-only stages skip with a clear message** and tests that depend on them will skip in turn.

### 3. Fund the wallet(s) on testnet

| Asset                                   | Purpose                                        |
| --------------------------------------- | ---------------------------------------------- |
| **SUI**                                 | Gas — [testnet faucet](https://faucet.sui.io/) |
| **USD** (`client.settlementCoinType()`) | `deposit` + `placeOrder` payments              |

## Place all staging markets (`pnpm predict:place-all-markets`)

Scans `GET /predict/browse?sort=trending` (and optionally feed), then places + fills on every tradeable side. Default stake **$1.11** (`E2E_STAGING_BET_USD`). Requires `SUI_PRIVATE_KEY` + staging API (`E2E_API_ENV=staging` is set by the npm script).

| Command / env | Effect |
| ------------- | ------ |
| `pnpm predict:place-dry-run` | `E2E_PLACE_ALL_DRY_RUN=1` — list markets/odds/caps only |
| `pnpm predict:place-broker-only` | 1 market, broker-only fill (`BROKER_ONLY` + `LIMIT=1` + `ONE_SIDE`) |
| `pnpm predict:place-and-watch` | Place one **$1.12** order, print `orderId`, exit |
| `E2E_STAGING_BET_USD=1.03` | Override stake in USD (6-decimal settlement base internally) |
| `E2E_PLACE_ALL_LIMIT=5` | First N markets (× sides unless `ONE_SIDE`) |
| `E2E_PLACE_ALL_ONE_SIDE=1` | First side only per market |
| *(default)* | Broker-only — no local `fillOrder` (backend owns fill) |
| `E2E_CATALOG_KEEPER_FALLBACK=1` | After broker wait, local keeper `fillOrder` (backend down / decoupled) |
| `E2E_PLACE_ALL_BROKER_ONLY=1` | Force broker-only even if keeper fallback env is set |
| `E2E_PLACE_ALL_CONCURRENCY=3` | Parallel broker wait (place txs stay sequential) |
| `E2E_PLACE_ALL_CRYPTO_EPOCHS=1` | Extra crypto time windows from `neighbors.upcoming` |
| `E2E_PLACE_ALL_SEGMENTS=sport,crypto` | Segment filter |

Full env matrix: [`../README.md`](../README.md#api-environments-postman-style).

### Other staging probes

```bash
pnpm predict:refund-probe              # unfillable priceCap → OrderCancelled + wxa refund
pnpm predict:broker-matrix             # vary place inputs, observe API + chain outcomes
E2E_BROKER_MATRIX_SCENARIOS=fillable-normal,tight-701 pnpm predict:broker-matrix
```

### 4. Run a seed preset (recommended)

```bash
pnpm seed:testnet                            # preset=baseline
pnpm seed:testnet -- --preset=with-claim     # baseline + resolved claim market
pnpm seed:testnet -- --preset=admin          # admin round-trips (AdminCap holder only)
pnpm seed:testnet -- --dry-run               # plan only, no transactions
```

| Preset               | Stages                                                      | Required keys                                 |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| `baseline` (default) | `account`, `deposit`, `place-open`, `fill`, `request-close` | owner (+ keeper for `fill` / `request-close`) |
| `with-claim`         | baseline + `place-and-resolve`                              | owner + keeper                                |
| `with-rescue`        | with-claim + `expired-rescue` (sleeps ~33s for cooldown)    | owner + keeper                                |
| `full`               | same as `with-rescue`                                       | owner + keeper                                |
| `admin`              | `min-reserve`, `cooldown`, `pause`, `keeper`, `treasury`    | AdminCap holder                               |

### 5. Run individual stages

```bash
pnpm seed:testnet -- --stage=account,deposit,place-open
```

| Stage               | Effect                                                                                                                                               | Idempotency check                                          | Required keys                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `account`           | `createAccount`                                                                                                                                      | reuse first `account_ids(owner)` if any                    | owner                                    |
| `deposit`           | `deposit` until `hasData=true`                                                                                                                       | skip when `getAccountData(...).hasData`                    | owner                                    |
| `place-open`        | `placeOrder` on `pred-e2e-open-v1`                                                                                                                   | skip when account already has an OPEN order on this market | owner                                    |
| `fill`              | place + `fillOrder` → fresh OPEN position                                                                                                            | skip when account already has any OPEN position            | owner + keeper                           |
| `request-close`     | `requestClose` on a spare OPEN position                                                                                                              | skip when account already has a PENDING_CLOSE position     | owner (+ keeper if no spare OPEN exists) |
| `place-and-resolve` | place + fill + `resolveMarket("YES")` on `pred-e2e-claim-v1`                                                                                         | skip when claim position + resolved market both exist      | owner + keeper                           |
| `expired-rescue`    | place a 2s-expiry order + (with keeper) place+fill+requestClose, then sleep `cooldown+3s` so `selfCancelOrder` / `selfCancelClose` rescue paths work | skip when the saved expired ids are still expired on chain | owner (+ keeper for close-rescue arm)    |
| `min-reserve`       | `setMinReserve` round-trip                                                                                                                           | always runs (round-trip = idempotent)                      | AdminCap holder                          |
| `cooldown`          | `setOrderCancelCooldownMs` round-trip                                                                                                                | always runs                                                | AdminCap holder                          |
| `pause`             | `pauseMarket` + `unpauseMarket` on `pred-e2e-open-v1`                                                                                                | always runs                                                | AdminCap holder                          |
| `keeper`            | `addKeeper` + `removeKeeper` (dummy address)                                                                                                         | always runs                                                | AdminCap holder                          |
| `treasury`          | `depositSettlement(1)` + `adminWithdraw(1)`                                                                                                          | always runs                                                | AdminCap holder                          |

### 6. Run tests

```bash
pnpm test:e2e            # simulate (dry-run, public RPC OK, no secrets needed beyond seed)
pnpm test:integration    # sign + execute, opt-in (SUI_PRIVATE_KEY required)
```

`discoverFixtures()` prefers `test/prediction/fixtures/testnet-seeded.json` when present; otherwise it walks the registry cursors. Env vars like `E2E_ACCOUNT_ID` / `E2E_ORDER_ID` still override anything discovered.

## List accounts (`list-accounts.ts`)

**Developer CLI** — not run by Vitest or CI. Use when you need a registry `E2E_ACCOUNT_ID` after several `createAccount` runs:

```bash
pnpm predict:list-accounts 0xYourWalletAddress
```

Same data as SDK `getAccountIds(client, { owner })`.
