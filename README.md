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

## Oracle sources

ONE client create option, `oracleSource`, selects the price-update source. Each source is **self-contained** — it owns its own infra + config and does **not** back-stop any other source. The name is source-neutral on purpose: a future source need not be Pyth. The SDK **never reads `process.env`** — each consumer wires it from its own env var, so every environment runs the **same SDK version** and differs only by env:

| Option         | Values                                                            | What it selects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oracleSource` | `'pyth_rule'` (default) \| `'pyth_lazer_rule'` \| `'waterx_rule'` | The price-update source. `'pyth_rule'` = Pyth Core updates (Hermes VAA + per-feed update fees, keyless `hermes.pyth.network`). `'pyth_lazer_rule'` = Pyth Lazer signed updates (ONE `leEcdsa` verify per PTB, no per-feed fees); needs `packages.pyth_lazer_rule` feeds + a `pythApiKey`. `'waterx_rule'` = the first-party WaterX quote-center (Nautilus-TEE, ed25519-signed CEX prices): one signed batch envelope per build, no API key and no per-update fee; needs `packages.waterx_rule` feeds. |

**No cross-source fallback, no init guard.** Selecting a source whose feed for a requested ticker is absent is **not** an error at client creation — it fails at **tx-build** for exactly those tickers (constant-only tickers, which need no price update, are exempt). A present-but-wrong feed id is not validated by the SDK; it aborts on-chain at dry-run.

The Pyth Core infra (`client.pyth`: state ids + Hermes endpoint) is **fixed per network** by `PYTH_DEFAULTS` and is **not** deployment-overridable — the canonical `waterx-config` JSON carries no `pyth` block. The `pyth_lazer_rule` source reads only the credential/policy (`api_key`/`fetch`) from `client.pyth`; its on-chain infra comes from `LAZER_DEFAULTS` + config. The credential and fetch policy are passed at client init (`pythApiKey` / `pythFetch`), never through the JSON. `waterx_rule` touches no Pyth infra at all — its quote-center endpoint is fixed per network by `WATERX_DEFAULTS` (testnet `quote-center-staging.waterx.app` / mainnet `quote-center.waterx.app`) and it reuses only the shared fetch policy (`pythFetch`).

```ts
// Per-environment wiring — the consumer owns the env var, not the SDK:
const perp = await PerpClient.create(network, {
  waterxConfigUrl,
  oracleSource: process.env.ORACLE_SOURCE as OracleSource | undefined, // e.g. staging: 'pyth_lazer_rule' | 'waterx_rule'
  pythApiKey: process.env.PYTH_API_KEY, // Lazer is auth-first; unused by 'pyth_rule' / 'waterx_rule'
});
```

This is the staging-Lazer / prod-Core rollout pattern: staging sets `ORACLE_SOURCE=pyth_lazer_rule` (+ `PYTH_API_KEY`) — or `ORACLE_SOURCE=waterx_rule`, which needs no credential — while production leaves it unset — flipping an environment is an env-var change, never an SDK release.

### Adding an oracle source (runbook)

Every source plugs in the same way — routing is driven **only** by the client's `oracleSource` option (never a config `enabled` flag, never `process.env`):

1. **Implement `PriceUpdateRule`** in `src/oracle/rules/<name>-rule.ts` — all port fields (`src/oracle/price-update-rule.ts`): `kind`, `requiresFeeSource` (`true` iff the on-chain verify draws a per-update fee — gates the fail-fast fee-source check), `supportedTickers`, `fetchUpdateData`, `narrowUpdateData` (subset a cached whole-universe payload to one build's tickers — a divisible payload returns a per-feed subset, an indivisible one returns itself whole iff fully covered; uncovered ticker → `null` miss), `buildUpdateCalls`.
2. **Register it** in `src/oracle/rule-registry.ts` (`DEFAULT_RULES`) under a new `OracleSource` value (added to the union in `price-update-rule.ts`).
3. **Publish the on-chain rule package** — its config entry (package ids, per-ticker `feeds`) arrives via the normal `waterx-config` deploy pipeline; type it in `OraclePackages` (`src/oracle/config.ts`).
4. **Add SDK infra constants** if the source needs external infra that is not part of the config JSON (API endpoints, verifier packages, state objects) — a per-network map in `src/oracle/config.ts`, mirroring `LAZER_DEFAULTS` / `WATERX_DEFAULTS`.
5. **Consumers flip `oracleSource`** per environment — no consumer code change, no SDK re-release.

The in-house `waterx_rule` (ed25519 enclave-signed CEX prices, `src/oracle/rules/waterx-rule.ts`) took exactly this path: it pulls one enclave-signed batch envelope covering the requested tickers from the quote-center (`GET /v1/quotes/update?symbols=…`, public read — no auth), then verifies **and** feeds in a single `waterx_rule::collect_batch_latest` call per collector, so it emits no shared verify step. On-chain a freshness miss / replayed timestamp abstains (the other weighted rules cover); a config mismatch or bad signature aborts.

> **Browser consumers:** this source fetches the quote-center directly from the page, so the quote-center deployment must return `Access-Control-Allow-Origin` for the app's origin. For an origin that is not on that allowlist, point the SDK at your own proxy instead of the default host — the endpoint and the transport are both overridable at client init:
>
> ```ts
> const perp = await PerpClient.create(network, {
>   waterxConfigUrl,
>   oracleSource: "waterx_rule",
>   // absolute URL on your own origin; its base path is PRESERVED, so this
>   // fetches https://app.example/api/quote-center/v1/quotes/update
>   waterxEndpoint: "https://app.example/api/quote-center",
>   waterxFetch: { fetchImpl: myFetch, timeoutMs: 8_000 }, // optional custom transport / policy
> });
> ```
>
> Both default to `WATERX_DEFAULTS[network]` (+ the shared `pythFetch` policy) when unset, and both are inert under the Pyth sources. Node/keeper consumers are unaffected by CORS either way.

## Recipes & full surface

To avoid doc drift, per-action usage lives in maintained, lint-checked code rather than this README:

- **Perp recipes:** [`examples/`](./examples) — ~30 runnable scripts (place orders, WLP mint/redeem, account/delegates, reads). Each uses `buildClient()` + a builder + `simThenMaybeExecute`.
- **Prediction recipes:** [`test/prediction/e2e/`](./test/prediction/e2e) — the live reference for `client.predict.*` flows.
- **Authoritative export list:** [`src/perp/index.ts`](./src/perp/index.ts) (perp) and [`src/prediction/index.ts`](./src/prediction/index.ts) — clients, builders, view helpers, BCS types, and `*Calls` generated namespaces. The package root (`.`) is [`src/sdk.ts`](./src/sdk.ts) (umbrella + flat-perp re-export); the shared base is published at `@waterx/sdk/account` and `@waterx/sdk/oracle`.

Perp `build*Tx` helpers are oracle-backed (`async`; they refresh prices before the call) — through whichever source `oracleSource` selects, not Pyth specifically. The oracle layer (sources, rules, refresh) lives in [`src/oracle/`](./src/oracle).

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
