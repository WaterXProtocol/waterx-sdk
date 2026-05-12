# @waterx/perp-sdk

TypeScript SDK for the WaterX perpetual protocol on Sui: build PTBs with **gRPC** (`@mysten/sui`), run read-only **simulateTransaction** queries, and optional **Pyth** helpers.

> **ABI note:** PTB entry points follow `contracts/waterx_perp` in this repo. **Read-only `view::*` helpers** resolve the module package from each **shared object’s on-chain type** (so `Market` / `WlpPool` can sit on a newer publish than `GlobalConfig` / `AccountRegistry`). BCS layouts for `MarketSummary`, `PositionInfo`, and `TokenPoolSummary` match the **deployed** `view` structs (see `contracts/waterx_perp/package_summaries/waterx_perp/view.json`). Pin `WaterXConfig` to your environment’s package and object IDs.

## Install & build

```bash
pnpm install
pnpm build
```

Consumers:

```bash
pnpm add @waterx/perp-sdk @mysten/sui
```

### Breaking changes (WLP high-level builders)

`buildMintWlpTx` and `buildSettleRedeemWlpTx` are **`async`** and return `Promise<Transaction>` (they resolve deposit / redeem coin oracle wiring). Callers must **`await`**:

```ts
const tx = await buildMintWlpTx(client, params);
const tx2 = await buildSettleRedeemWlpTx(client, { requestId: 1n });
```

### Size calculation requires explicit price

`buildOpenPositionTx` and `buildPlaceOrderTx` no longer fall back to hardcoded prices when computing position size from leverage. You must provide either **`size`** (exact) or **`approxPrice`** (USD price for leverage math). Omitting both throws.

### Naming: collateral on an open position

Move entry points are `deposit_collateral_request` / `withdraw_collateral_request`. The SDK exposes **`depositCollateral`** / **`withdrawCollateral`** as the preferred names; **`increaseCollateral`** / **`releaseCollateral`** remain as deprecated aliases (same parameters). High-level helpers: **`buildDepositCollateralTx`** / **`buildWithdrawCollateralTx`** (deprecated: `buildIncreaseCollateralTx` / `buildReleaseCollateralTx`).

Withdraw paths take **`collateralAmount`** for the size to pull from margin; **`amount`** is a deprecated alias (if both are passed, `collateralAmount` wins).

### UserAccount address in PTB params

Trading (`openPosition`, `closePosition`, …), account helpers (`depositToAccount`, delegates, …), high-level `build*Tx`, and orders (`placeOrder`, `cancelOrder`) all use **`accountObjectAddress`**: the **UserAccount object id** (hex). Trading paths pass it as `tx.pure.address`; registry calls use `tx.pure.id`. It is **not** a numeric registry index.

`getAccountsByOwner` returns **`accountObjectAddress`** on each `AccountInfo` row.

High-level `build*Tx` helpers also accept optional **`collateralTokenType`** (defaults to `WaterXConfig.usdcType`). Only token types wired in `resolveTokenPriceFeed` (`src/tx-builders.ts`) get automatic Pyth updates; extend there when the protocol adds collaterals.

---

## Initialize the client

All network I/O uses **gRPC** (`SuiGrpcClient`). Trading helpers require `bucketFrameworkPackageId` (Bucket `bucket_v2_framework` package) so the PTB can call `account::request`.

**Testnet (built-in constants):**

```ts
import { WaterXClient } from "@waterx/perp-sdk";

const client = WaterXClient.testnet();
// optional: custom fullnode gRPC URL
// const client = WaterXClient.testnet({ grpcUrl: "https://fullnode.testnet.sui.io:443" });
```

**Custom config (any network):**

```ts
import { createTestnetConfig, WaterXClient, type WaterXConfig } from "@waterx/perp-sdk";

const config: WaterXConfig = {
  ...createTestnetConfig(),
  packageId: "0x...", // your deployed waterx_perp package
  globalConfig: "0x...",
  // ...all other object IDs and token type strings
};
const client = new WaterXClient(config);
```

---

## Examples

### Read-only: pool summary & WLP metrics

Uses gRPC `simulateTransaction` + BCS (no signer).

```ts
import { getPoolSummary, getWlpTotalSupply, getWlpTvlUsd, WaterXClient } from "@waterx/perp-sdk";

const client = WaterXClient.testnet();

const pool = await getPoolSummary(client);
console.log("LP supply (raw):", pool.totalLpSupply.toString());
console.log("TVL (u128):", pool.tvlUsd.toString());

const supply = await getWlpTotalSupply(client);
const tvl = await getWlpTvlUsd(client);
```

### Read-only: accounts & position

```ts
import { getAccountsByOwner, getPosition, positionExists, WaterXClient } from "@waterx/perp-sdk";

const client = WaterXClient.testnet();
const owner = "0x..."; // Sui address

const accounts = await getAccountsByOwner(client, owner);
const accountObjectAddress = accounts[0]!.accountObjectAddress;

const market = client.config.btcMarket;
const has = await positionExists(client, market, 0n);
if (has) {
  const pos = await getPosition(client, market, 0n);
  // `accountObjectAddress` = on-chain `user_address`; `marketIndex` = pool row index (not Market object id).
  console.log(pos.accountObjectAddress, pos.marketIndex, pos.sizeAmount);
}
```

### High-level PTB: open position (Pyth + testnet IDs wired in)

Returns a `Transaction` you sign and execute with the same client.

```ts
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { buildOpenPositionTx, WaterXClient } from "@waterx/perp-sdk";

const client = WaterXClient.testnet();
// Use your own keypair or any @mysten/sui Signer (e.g. wallet adapter).
const keypair = Ed25519Keypair.generate();

const tx = await buildOpenPositionTx(client, {
  accountObjectAddress: "0x...", // UserAccount object id (hex), not a numeric id
  base: "BTC",
  isLong: true,
  leverage: 10,
  collateralAmount: 1_000_000_000n, // 1000 USDC if 6 decimals
  approxPrice: 95_000, // required when `size` is not provided
});

const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
console.log(result.digest);
```

### Low-level PTB: same flow, your oracle wiring

Create a `Transaction`, append Pyth / aggregator calls (`updatePythPrices`, `buildPythRuleFeedCalls` from this package — mirror `src/tx-builders.ts`), then call `openPosition(client, tx, openPositionParams)` (or any other builder in `src/user/`). Params are typed as `OpenPositionParams`, `ClosePositionParams`, etc.

---

## API overview

### Core

| Export                  | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `WaterXClient`          | gRPC client, `simulate()`, `signAndExecuteTransaction()`              |
| `createTestnetConfig()` | Default testnet package/object/token IDs + Pyth config                |
| `WaterXConfig`          | Full config; must include `bucketFrameworkPackageId` for trading PTBs |

### Transaction builders (append to `Transaction`)

| Group    | Functions                                                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared   | `accountSenderRequest(tx, client)`                                                                                                                                                                                          |
| Trading  | `openPosition`, `closePosition`, `increasePosition`, `decreasePosition`, `depositCollateral`, `withdrawCollateral` (`increaseCollateral` / `releaseCollateral` deprecated), `liquidate`, `matchOrders`, `updateFundingRate` |
| Orders   | `placeOrder`, `cancelOrder`                                                                                                                                                                                                 |
| WLP      | `mintWlp`, `requestRedeemWlp`, `cancelRedeemWlp`, `settleRedeemWlp`                                                                                                                                                         |
| Account  | `createAccount`, `depositToAccount`, `receiveCoin`, `transferAccount`, `addDelegate`, `removeDelegate`, `updateDelegatePermissions`                                                                                         |
| Referral | `setReferralCode`, `useReferralCode`, `registerReferralCode`, `bindReferral`                                                                                                                                                |

Param types: `OpenPositionParams`, `IncreasePositionParams`, `DecreasePositionParams`, etc. (see `src/index.ts`).

### Read-only queries (simulate + BCS)

| Area          | Functions                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account       | `getAccountsByOwner`, `getAccountDelegates`, `getAccountObjectId` (deprecated — use `accountObjectAddress` directly), `getAccountCoins`, `getAccountBalance`, `selectCoinsForAmount`           |
| Market / pool | `getMarketSummary` (`view::market_summary<LP>` — optional `typeArgs`: LP type string or `{ lpTokenType? }` only), `getPoolSummary`, `getWlpTotalSupply`, `getWlpTvlUsd`, `getTokenPoolSummary` |
| Position      | `getPosition`, `positionExists` (same LP type-arg rules as `getMarketSummary`)                                                                                                                 |

**View return shapes:** `MarketSummary` includes `marketIndex` (on-chain index). `PositionInfoView` exposes `marketIndex` (bigint) and `accountObjectAddress` (from `user_address`). `getTokenPoolSummary` maps `TokenPoolSummary.lastPriceRefreshTimestamp` when the return payload includes it; older 72-byte deployments surface `0n` (see `parseTokenPoolSummaryReturn` in `fetch.ts`).

### High-level PTB helpers

`buildOpenPositionTx`, `buildClosePositionTx`, `buildIncreasePositionTx`, `buildDecreasePositionTx`, `buildDepositCollateralTx`, `buildWithdrawCollateralTx` (`buildIncreaseCollateralTx` / `buildReleaseCollateralTx` deprecated), `buildPlaceOrderTx`, `buildCancelOrderTx` (all `async`, Pyth-backed). All WLP builders are `async` and refresh every pool token's Pyth feed before the call (required by `assert_prices_fresh`): `buildMintWlpTx`, `buildMintAndStakeWlpTx`, `buildRequestRedeemWlpTx` (requires `recipient`), `buildSettleRedeemWlpTx`, `buildCancelRedeemWlpTx`, `buildUnstakeAndRequestRedeemWlpTx`.

### Constants & Pyth

Permission bits, order tags, testnet IDs, Pyth feeds: `src/constants.ts`.  
On testnet, `TESTNET_TYPES.WLP` is the LP type wired to the live **`WlpPool` / `Market`** (`wlp_token::WLP_TOKEN`); `TESTNET_PACKAGE_IDS.WLP_STANDALONE` points at the standalone `contracts/wlp` publish for reference.  
Oracle wiring: `fetchPriceFeedsUpdateData`, `updatePythPrices`, `buildPythRuleFeedCalls`, `PythCache`, etc. in `src/utils/pyth.ts`.

---

## Development

| Command                     | Use                                  |
| --------------------------- | ------------------------------------ |
| `pnpm typecheck`            | Typecheck                            |
| `pnpm test`                 | Tests                                |
| `pnpm lint` / `pnpm format` | Prettier                             |
| `pnpm codegen`              | Regenerate `src/generated` from Move |
