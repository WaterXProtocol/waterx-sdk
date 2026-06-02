# @waterx/perp-sdk

TypeScript SDK for the WaterX protocol on Sui — **two product lines in one package**: **perpetuals** and **prediction markets**. Build PTBs with **gRPC** (`@mysten/sui`), run read-only **simulateTransaction** queries, and optional **Pyth** helpers.

> Package name & version are set at publish time — this repo keeps the inherited `name`/`version`.

## Two lines, one package

The perp and prediction lines expose builder functions with **colliding names** (`placeOrder`, `createAccount`, `deposit`, …), so they are kept in separate namespaces:

```ts
import { Client } from "@waterx/perp-sdk";

const client = await Client.create({ network: "TESTNET" });
client.perp.buildPlaceOrderTx(params);   // perpetuals
client.predict.placeOrder(tx, params);   // prediction markets
// raw line clients for signing/executing: client.perpClient / client.predictClient
// each line can target a different network: Client.create({ perp: { network: "MAINNET" }, predict: { network: "TESTNET" } })
```

Import surfaces:

| Import | What |
|--------|------|
| `@waterx/perp-sdk` | `Client` (unified) + `perp` / `prediction` namespaces. Perp's API is also re-exported flat here (**deprecated** — prefer `client.perp` or the `perp` namespace; removed next major). |
| `@waterx/perp-sdk/perp` | Perp line: `WaterXClient`, builders, fetch, Pyth/Wormhole utils. |
| `@waterx/perp-sdk/prediction` | Prediction line: `PredictClient`, builders, fetch, utils. |

## Install

```bash
pnpm install
pnpm build
```

Consumers: `pnpm add @waterx/perp-sdk @mysten/sui`

## Quickstart (unified client)

`Client.create()` loads each line's deployment config from the canonical `waterx-config` JSON and returns a ready client. Builders are **build-only** — they return / mutate a `Transaction`; signing & execution stay with the caller (the line client, or a frontend wallet), so multi-step Pyth injection and wallet flows keep working.

```ts
import { Client, rawPrice } from "@waterx/perp-sdk";
import { Transaction } from "@mysten/sui/transactions";

const client = await Client.create({ network: "TESTNET" });
const signer = /* your Ed25519Keypair or wallet Signer */;

// --- Perp: place a market order ---
const tx = await client.perp.buildPlaceOrderTx({
  ticker: "BTCUSD",
  collateralType: client.perpClient.creditType(),
  accountId: "0x...", // UserAccount object id (hex)
  main: {
    isLong: true,
    isStopOrder: false,
    reduceOnly: false,
    size: rawPrice(0.001),
    acceptablePrice: rawPrice(100_000),
    collateralAmount: 5_000_000n,
  },
  preOrders: [],
});
await client.perpClient.signAndExecuteTransaction({ transaction: tx, signer });

// --- Prediction: same pattern under client.predict ---
const ptx = new Transaction();
client.predict.placeOrder(ptx, params);
await client.predictClient.signAndExecuteTransaction({ transaction: ptx, signer });
```

> Account creation is shared: both lines build accounts via the same on-chain `waterx_account` system, so an account created through `client.perp.createAccount` is usable by `client.predict.*` (and vice versa).

## Per-line clients

If you only need one line, construct it directly (both factories are **async** — they fetch deployment config):

```ts
import { WaterXClient } from "@waterx/perp-sdk/perp";
import { PredictClient } from "@waterx/perp-sdk/prediction";

const perp = await WaterXClient.create("TESTNET"); // or WaterXClient.testnet()
const predict = await PredictClient.create("TESTNET"); // or PredictClient.testnet()
```

Read-only queries use gRPC `simulateTransaction` (no signer) — the `getX` view helpers, e.g. `await perp.simulate(tx)` or `getMarketData(perp, …)`.

## Recipes & full surface

To avoid doc drift, per-action usage lives in maintained, lint-checked code rather than this README:

- **Perp recipes:** [`examples/`](./examples) — ~30 runnable scripts (place orders, WLP mint/redeem, account/delegates, reads). Each uses `buildClient()` + a builder + `simThenMaybeExecute`.
- **Prediction recipes:** [`test/prediction/e2e/`](./test/prediction/e2e) — the live reference for `client.predict.*` flows.
- **Authoritative export list:** [`src/index.ts`](./src/index.ts) (perp) and [`src/prediction/index.ts`](./src/prediction/index.ts) — clients, builders, view helpers, BCS types, and `*Calls` generated namespaces.

Perp `build*Tx` helpers are Pyth-backed (`async`; they refresh feeds before the call). Pyth/Wormhole helpers live in [`src/utils/`](./src/utils).

## Development

| Command | Use |
| --- | --- |
| `pnpm typecheck` | Typecheck the whole tree |
| `pnpm test` / `pnpm test:unit` | Unit tests (perp + prediction) |
| `pnpm test:e2e` | Testnet simulate e2e (perp + prediction) |
| `pnpm test:integration` | On-chain integration (needs `SUI_PRIVATE_KEY`; local-only) |
| `pnpm lint` / `pnpm format` | ESLint + Prettier |
| `pnpm codegen` | Regenerate `src/generated` from Move |
| `pnpm seed:testnet` | Seed prediction testnet fixtures (needs `SUI_PRIVATE_KEY`) |

Tests are split per line under `test/perp/` and `test/prediction/`, each with `unit` / `e2e` / `integration` tiers. See the per-line `README.md` in each.
