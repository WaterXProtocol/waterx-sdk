# @waterx/sdk

TypeScript SDK for the WaterX protocol on Sui — **two product lines in one package**: **perpetuals** and **prediction markets**. Build PTBs with **gRPC** (`@mysten/sui`), run read-only **simulateTransaction** queries, and optional **Pyth** helpers.

> Package name is `@waterx/sdk` (renamed from `@waterx/perp-sdk` in 2.3.0).

## Two lines, one package

The perp and prediction lines expose builder functions with **colliding names** (`placeOrder`, `deposit`, …), so they are kept in separate namespaces under one umbrella `WaterXClient`:

```ts
import { WaterXClient } from "@waterx/sdk";

// waterxConfigUrl is REQUIRED — the SDK has no built-in default and never reads env.
const client = await WaterXClient.create({
  network: "TESTNET",
  waterxConfigUrl:
    "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json",
});
client.account.createAccount(tx, { alias }); // shared waterx_account + funding (credit/custody)
client.perp.buildPlaceOrderTx(params); // perpetuals
client.predict.placeOrder(tx, params); // prediction markets
// client.perp / client.predict ARE the line clients — sign/execute on them directly:
//   await client.perp.signAndExecuteTransaction({ transaction: tx, signer })
// each line can target a different network + URL:
//   WaterXClient.create({ perp: { network: "MAINNET", waterxConfigUrl: mainnetUrl }, predict: { network: "TESTNET", waterxConfigUrl: testnetUrl } })
```

> `WaterXClient` is the umbrella entry point. `Client` is kept as a **deprecated alias** for one major cycle.

Import surfaces:

| Import                   | What                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@waterx/sdk`            | `WaterXClient` (umbrella) + `perp` / `prediction` namespaces. Perp's API is also re-exported flat here (**deprecated** — prefer `client.perp` or the `perp` namespace; removed next major). |
| `@waterx/sdk/perp`       | Perp line: `PerpClient`, builders, fetch, Pyth/Wormhole utils.                                                                                                                              |
| `@waterx/sdk/prediction` | Prediction line: `PredictClient`, builders, fetch, utils.                                                                                                                                   |

## Install

```bash
pnpm install
pnpm build
```

Consumers: `pnpm add @waterx/sdk @mysten/sui`

## Quickstart (unified client)

`WaterXClient.create()` loads each line's deployment config from the canonical `waterx-config` JSON (its URL passed via the **required** `waterxConfigUrl` option — the SDK has no default and never reads env) and returns a ready client. Builders are **build-only** — they return / mutate a `Transaction`; signing & execution stay with the caller (`client.perp` / `client.predict` are the line clients, or a frontend wallet), so multi-step Pyth injection and wallet flows keep working.

```ts
import { WaterXClient, rawPrice } from "@waterx/sdk";
import { Transaction } from "@mysten/sui/transactions";

const client = await WaterXClient.create({
  network: "TESTNET",
  waterxConfigUrl: "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json",
});
const signer = /* your Ed25519Keypair or wallet Signer */;

// --- Perp: place a market order ---
const tx = await client.perp.buildPlaceOrderTx({
  ticker: "BTCUSD",
  collateralType: client.perp.creditType(),
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
await client.perp.signAndExecuteTransaction({ transaction: tx, signer });

// --- Prediction: same pattern under client.predict ---
const ptx = new Transaction();
client.predict.placeOrder(ptx, params);
await client.predict.signAndExecuteTransaction({ transaction: ptx, signer });
```

> Account creation is shared: `client.account.*` builds accounts via the one on-chain `waterx_account` system (perp-backed), so an account created through `client.account.createAccount` is usable by both `client.perp.*` and `client.predict.*`. (On split-network setups `client.account` follows the perp line — reach the predict line's generic account builders via the `prediction` namespace.)

## Per-line clients

If you only need one line, construct it directly (both factories are **async** — they fetch deployment config; `waterxConfigUrl` is **required**):

```ts
import { PerpClient } from "@waterx/sdk/perp";
import { PredictClient } from "@waterx/sdk/prediction";

const waterxConfigUrl =
  "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json";
const perp = await PerpClient.create("TESTNET", { waterxConfigUrl }); // or PerpClient.testnet({ waterxConfigUrl })
const predict = await PredictClient.create("TESTNET", { waterxConfigUrl }); // or PredictClient.testnet({ waterxConfigUrl })
```

Read-only queries use gRPC `simulateTransaction` (no signer) — the `getX` view helpers, e.g. `await perp.simulate(tx)` or `getMarketData(perp, …)`.

## Oracle sources & the Pyth Pro migration

ONE client create option controls oracle behavior. The SDK **never reads `process.env`** — each consumer wires it from its own env var, so every environment runs the **same SDK version** and differs only by env:

| Option           | Values                        | What it flips                                                                                                                                                                                                                                                                     |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pythGeneration` | `'core'` (default) \| `'pro'` | The whole oracle mode. `'core'` = `pyth_rule` updates on Core infra (keyless `hermes.pyth.network`). `'pro'` = `pyth_lazer_rule` updates (ONE Lazer leEcdsa verify per PTB, no per-feed update fees) + the auth-first Pro Hermes (`https://pyth.dourolabs.app/hermes`) for reads. |

The on-chain rule source is **derived** (`'pro'` → `pyth_lazer_rule`) — there is no separate `oracleSource` option, so the previously-broken off-diagonal combinations are unrepresentable. `PerpClient.create` fails fast (`OracleSourceNotConfiguredError`) when `'pro'` is selected against a config with no `packages.pyth_lazer_rule`.

The `pyth_rule` path (the `'core'` mode, and the per-ticker fallback under `'pro'` for tickers without a Lazer feed) is **Core-infra by construction** — the deployed rule package is compiled against Core pyth, so both its feed leg (Core `PythState`) and its update leg (Core price-info objects, keyless Core Hermes) pin Core via `resolveCorePythInfra`, regardless of generation. An explicit `pyth` block in the config JSON overrides the generation constants for the paths that read `client.pyth` (Lazer/read infra under `'pro'`; everything under `'core'`).

```ts
// Per-environment wiring — the consumer owns the env var, not the SDK:
const perp = await PerpClient.create(network, {
  waterxConfigUrl,
  pythGeneration: process.env.PYTH_GENERATION as PythGeneration | undefined, // e.g. staging: 'pro'
});
// Pro-generation Hermes requires a key (Lazer signed updates + auth-first reads):
perp.pyth = { ...perp.pyth, api_key: process.env.PYTH_API_KEY };
```

This is the staging-Pro / prod-Core rollout pattern: staging sets `PYTH_GENERATION=pro` (+ `PYTH_API_KEY`) while production leaves it unset — flipping an environment is an env-var change, never an SDK release. After August 18, 2026 (the Core-upgrade cutover — see https://docs.pyth.network/price-feeds/core/upgrade), consumers set `pythGeneration: 'pro'` + `pyth.api_key`.

### Adding an oracle source (runbook)

Every rule generation plugs in the same way — routing is driven **only** by the client's derived `OracleHost.oracleSource` (never a config `enabled` flag, never `process.env`):

1. **Implement `PriceUpdateRule`** in `src/oracle/rules/<name>-rule.ts` — all port fields (`src/oracle/price-update-rule.ts`): `kind`, `requiresFeeSource` (`true` iff the on-chain verify draws a per-update fee — gates the fail-fast fee-source check), `supportedTickers`, `fetchUpdateData`, `narrowUpdateData` (subset a cached whole-universe payload to one build's tickers — a divisible payload returns a per-feed subset, an indivisible one returns itself whole iff fully covered; uncovered ticker → `null` miss), `buildUpdateCalls`.
2. **Register it** in `src/oracle/rule-registry.ts` (`DEFAULT_RULES`) under a new `OracleSource` value (added to the union in `price-update-rule.ts`).
3. **Publish the on-chain rule package** — its config entry (package ids, per-ticker `feeds`) arrives via the normal `waterx-config` deploy pipeline; type it in `OraclePackages` (`src/oracle/config.ts`).
4. **Add SDK infra constants** if the source needs external infra that is not part of the config JSON (API endpoints, verifier packages, state objects) — a per-network map in `src/oracle/config.ts`, mirroring `LAZER_DEFAULTS` / `PYTH_PRO_DEFAULTS`.
5. **Consumers flip `PYTH_GENERATION`** per environment (the rule source derives from it) — no consumer code change, no SDK re-release.

The in-house `waterx_rule` (ed25519 enclave-signed CEX prices) follows exactly this path when it lands.

## Recipes & full surface

To avoid doc drift, per-action usage lives in maintained, lint-checked code rather than this README:

- **Perp recipes:** [`examples/`](./examples) — ~30 runnable scripts (place orders, WLP mint/redeem, account/delegates, reads). Each uses `buildClient()` + a builder + `simThenMaybeExecute`.
- **Prediction recipes:** [`test/prediction/e2e/`](./test/prediction/e2e) — the live reference for `client.predict.*` flows.
- **Authoritative export list:** [`src/perp/index.ts`](./src/perp/index.ts) (perp) and [`src/prediction/index.ts`](./src/prediction/index.ts) — clients, builders, view helpers, BCS types, and `*Calls` generated namespaces. The package root (`.`) is [`src/sdk.ts`](./src/sdk.ts) (umbrella + flat-perp re-export); the shared base is published at `@waterx/sdk/account` and `@waterx/sdk/oracle`.

Perp `build*Tx` helpers are Pyth-backed (`async`; they refresh feeds before the call). Oracle (Pyth/Hermes) helpers live in [`src/oracle/`](./src/oracle).

## Development

| Command                        | Use                                                        |
| ------------------------------ | ---------------------------------------------------------- |
| `pnpm typecheck`               | Typecheck the whole tree                                   |
| `pnpm test` / `pnpm test:unit` | Unit tests (perp + prediction)                             |
| `pnpm test:e2e`                | Testnet simulate e2e (perp + prediction)                   |
| `pnpm test:integration`        | On-chain integration (needs `SUI_PRIVATE_KEY`; local-only) |
| `pnpm lint` / `pnpm format`    | ESLint + Prettier                                          |
| `pnpm codegen`                 | Regenerate `src/generated` from Move                       |
| `pnpm seed:testnet`            | Seed prediction testnet fixtures (needs `SUI_PRIVATE_KEY`) |

Tests are split per line under `test/perp/` and `test/prediction/`, each with `unit` / `e2e` / `integration` tiers. See the per-line `README.md` in each.
