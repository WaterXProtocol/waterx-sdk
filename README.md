# @waterx/sdk

TypeScript SDK for the WaterX protocol on Sui — **two product lines in one package**: **perpetuals** and **prediction markets**. Build PTBs with **gRPC** (`@mysten/sui`), run read-only **simulateTransaction** queries, and refresh oracle prices.

> Package name is `@waterx/sdk` (renamed from `@waterx/perp-sdk` in 2.3.0).

## Two lines, one package

The perp and prediction lines expose builder functions with **colliding names** (`placeOrder`, `deposit`, …), so they are kept in separate namespaces under one umbrella `WaterXClient`:

```ts
import { WaterXClient } from "@waterx/sdk";

// waterxConfigUrl and oracleSource are REQUIRED — the SDK has no built-in
// defaults and never reads env. oracleSource: see "Oracle sources" below.
const client = await WaterXClient.create({
  network: "TESTNET",
  waterxConfigUrl:
    "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json",
  oracleSource: ["waterx_rule", "pyth_lazer_rule"],
  pythApiKey: process.env.PYTH_API_KEY, // required iff 'pyth_lazer_rule' is listed
});
client.account.createAccount(tx, { alias }); // shared waterx_account + funding (credit/custody)
client.perp.buildPlaceOrderTx(params); // perpetuals
client.predict.placeOrder(tx, params); // prediction markets
// client.perp / client.predict ARE the line clients — sign/execute on them directly:
//   await client.perp.signAndExecuteTransaction({ transaction: tx, signer })
// each line can target a different network + URL (oracleSource stays top-level):
//   WaterXClient.create({ oracleSource: "waterx_rule", perp: { network: "MAINNET", waterxConfigUrl: mainnetUrl }, predict: { network: "TESTNET", waterxConfigUrl: testnetUrl } })
```

> `WaterXClient` is the umbrella entry point. `Client` is kept as a **deprecated alias** for one major cycle.

Import surfaces:

| Import                   | What                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@waterx/sdk`            | `WaterXClient` (umbrella) + `perp` / `prediction` namespaces. Perp's API is also re-exported flat here (**deprecated** — prefer `client.perp` or the `perp` namespace; removed next major). |
| `@waterx/sdk/perp`       | Perp line: `PerpClient`, builders, fetch, oracle/Wormhole utils.                                                                                                                            |
| `@waterx/sdk/prediction` | Prediction line: `PredictClient`, builders, fetch, utils.                                                                                                                                   |

## Install

```bash
pnpm add @waterx/sdk @mysten/sui @mysten/bcs
```

`@mysten/sui` (`^2.9.0`) and `@mysten/bcs` (`^1.9.0`) are **peer** dependencies — the SDK
does not bundle them, so your app and the SDK share one Sui client and one BCS registry.

- **Node ≥ 22** (declared in `engines`; CI builds and tests on 24).
- **ESM and CJS** both resolve, including on every subpath export.
- **One runtime dependency** (`@noble/hashes`), plus the two peers above.
- **Browser supported** — see the CORS note under [Oracle sources](#oracle-sources) if you
  use `waterx_rule`.

Contributor setup (building this repo rather than consuming it) is under
[Development](#development).

## Quickstart (unified client)

`WaterXClient.create()` loads each line's deployment config from the canonical `waterx-config` JSON (its URL passed via the **required** `waterxConfigUrl` option — the SDK has no default and never reads env) and returns a ready client. Builders are **build-only** — they return / mutate a `Transaction`; signing & execution stay with the caller (`client.perp` / `client.predict` are the line clients, or a frontend wallet), so multi-step oracle injection and wallet flows keep working.

```ts
import { WaterXClient, rawPrice } from "@waterx/sdk";
import { Transaction } from "@mysten/sui/transactions";

const client = await WaterXClient.create({
  network: "TESTNET",
  waterxConfigUrl: "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json",
  // REQUIRED — single source or a list (the fed set). The set must COVER each
  // ticker's on-chain weighted rules; testnet majors need both of these today.
  // Verify with `pnpm oracle:aggregates:testnet`. See "Oracle sources".
  oracleSource: ["waterx_rule", "pyth_lazer_rule"],
  pythApiKey: process.env.PYTH_API_KEY, // required iff 'pyth_lazer_rule' is listed
});
const signer = /* your Ed25519Keypair or wallet Signer */;
const accountId = "0x..."; // wxa account object id — see "First integration"

// --- Perp: place a market order ---
const tx = await client.perp.buildPlaceOrderTx({
  ticker: "BTCUSD",
  collateralType: client.perp.creditType(),
  accountId,
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
// Preconditions: `accountId` is a wxa account registered with the prediction
// protocol and holding settlement collateral; `marketId` is an OPEN market.
// Object ids (globalConfig / marketRegistry / accountRegistry / settlement coin
// type) are resolved from config — pass them only to override.
const ptx = new Transaction();
client.predict.placeOrder(ptx, {
  accountId, // payer; `receiverAccountId` defaults to this
  marketId: "0x...", // market id bytes or 0x-hex
  selection: "YES", // "YES" | "NO"
  maxSpend: 1_000_000n, // cap in settlement-coin base units
  minShares: 1n, // fill floor — chain asserts filled_shares >= this; 0 accepts any fill
  priceCapBps: 5_000n, // max price per share, bps of the 1-unit payout; MUST be <= 10_000
  expiryTs: BigInt(Date.now() + 60_000), // ms epoch
});
await client.predict.signAndExecuteTransaction({ transaction: ptx, signer });
```

> Account creation is shared: `client.account.*` builds accounts via the one on-chain `waterx_account` system (perp-backed), so an account created through `client.account.createAccount` is usable by both `client.perp.*` and `client.predict.*`. (On split-network setups `client.account` follows the perp line — reach the predict line's generic account builders via the `prediction` namespace.)

## First integration

The quickstart above starts from an `accountId` you already have. If you have none yet,
this is the whole arc. **[`examples/quickstart.ts`](./examples/quickstart.ts) is this
walkthrough as one runnable file** — being real code, it is covered by `pnpm lint` and
`pnpm typecheck`, so the API it exercises cannot go stale unnoticed:

```bash
export WATERX_CONFIG_URL=https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json
export ORACLE_SOURCE=waterx_rule,pyth_lazer_rule   # step 2 — must cover the ticker's weighted rules
export PYTH_API_KEY=...                          # required whenever pyth_lazer_rule is listed
pnpm exec tsx examples/quickstart.ts             # simulate-only; WATERX_EXECUTE=1 to sign + send
```

**1 — Get a config URL.** Every chain-specific id comes from the canonical
[`waterx-config`](https://github.com/WaterXProtocol/waterx-config) JSON. There is no
built-in default and the SDK never reads `process.env`: your app reads the URL and passes
it in. Hardcoding object ids instead is the single most common integration mistake.

**2 — Pick your oracle source(s).** `oracleSource` is required, and the fed set must
**cover every ticker's on-chain weighted rules** — starving a weighted rule aborts
`EMissingPriceSource` at simulate. Check what a network actually weights before you wire
it up:

```bash
pnpm oracle:aggregates:testnet    # per-ticker aggregator sources + weights
```

Weights are on-chain state that changes without an SDK release, so read them rather than
trusting any list written here. [Oracle sources](#oracle-sources) has the full model.

**3 — Create a wxa account.** One account serves both product lines; every trading call
needs one. The id is **not** a builder return value — it lands in the `AccountCreated`
event, so read it back off the digest, then treat it as the user's durable handle. (A
simulate emits the same event but creates nothing; only read an id back after a real
execute.)

```ts
import { Transaction } from "@mysten/sui/transactions";
import { AccountCreated } from "@waterx/sdk/generated/waterx_account/events";

const tx = new Transaction();
client.account.createAccount(tx, { alias: "alice" });
const exec = await client.perp.signAndExecuteTransaction({ transaction: tx, signer });
const digest = exec.Transaction?.digest ?? "";

// Decode the event's `bcs`, never its `json` — only the BCS layout is the Move
// struct. (`as const` is load-bearing: it is what types `events` as present.)
const res = await client.perp.grpcClient.getTransaction({
  digest,
  include: { events: true } as const,
});
const ev = res.Transaction?.events?.find((e) => e.eventType.endsWith("::events::AccountCreated"));
const accountId = ev ? AccountCreated.parse(ev.bcs).account_object_address : undefined;
```

→ [`examples/actions/action-create-account.ts`](./examples/actions/action-create-account.ts)

**4 — Fund it.** Collateral must sit _inside_ the account before an order will fill.
Deposit is two calls in one PTB — `requestDeposit(coin)` then
`direct_rule::consume_deposit_direct(req)`.

→ [`examples/actions/action-request-deposit.ts`](./examples/actions/action-request-deposit.ts)
· cross-chain CREDIT and the native PSM are in
[`src/account/funding/credit.ts`](./src/account/funding/credit.ts) and
[`src/account/funding/custody.ts`](./src/account/funding/custody.ts)

**5 — Build, simulate, then execute.** Builders are **build-only**: they return or mutate
a `Transaction` and never sign. Always simulate first — that is where a bad fed set, an
unfunded account, or a stale id surfaces, for free.

```ts
const tx = await client.perp.buildPlaceOrderTx({ ... });   // async: prepends oracle legs
tx.setSender(address);
const result = await client.perp.simulate(tx);             // no signer, no gas
await client.perp.signAndExecuteTransaction({ transaction: tx, signer });
```

**6 — Read state back.** Reads are `simulateTransaction` + BCS decode — no signer, no gas,
zero-address sender.

```ts
const positions = await client.perp.getAccountPositions({
  ticker: "BTCUSD",
  accountObjectAddress: accountId,
  basePriceUsd: 0n, // WHOLE-DOLLAR u64 (not rawPrice); 0n zero-bases the PnL fields
});
```

→ [`examples/views/`](./examples/views) for every read path

## Per-line clients

If you only need one line, construct it directly (both factories are **async** — they fetch deployment config; `waterxConfigUrl` is **required**):

```ts
import { PerpClient } from "@waterx/sdk/perp";
import { PredictClient } from "@waterx/sdk/prediction";

const waterxConfigUrl =
  "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json";
// oracleSource must cover each ticker's weighted rules — see "Oracle sources".
const perp = await PerpClient.create("TESTNET", {
  waterxConfigUrl,
  oracleSource: ["waterx_rule", "pyth_lazer_rule"],
  pythApiKey: process.env.PYTH_API_KEY, // required iff 'pyth_lazer_rule' is listed
}); // or PerpClient.testnet({ ... })
const predict = await PredictClient.create("TESTNET", { waterxConfigUrl }); // predict line needs no oracle source
```

Read-only queries use gRPC `simulateTransaction` (no signer) — the `getX` view helpers, e.g. `await perp.simulate(tx)` or `getMarketData(perp, …)`.

## Oracle sources

ONE **required** client create option, `oracleSource`, names the price-update source(s) — a single value or a **list (the fed set)**. Each source is **self-contained** — it owns its own infra + config and does **not** back-stop any other source. There is **no default source**: a client that has not named its sources fails at creation. The name is source-neutral on purpose: a source need not be Pyth (Pyth Core was removed outright in 4.4.0). The SDK **never reads `process.env`** — each consumer wires it from its own env var, so every environment runs the **same SDK version** and differs only by env:

| Option         | Values                                                                                            | What it selects                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oracleSource` | `OracleSource \| OracleSource[]` of `'pyth_lazer_rule'` \| `'waterx_rule'` — REQUIRED, no default | The price-update source(s). `'pyth_lazer_rule'` = Pyth Lazer signed updates (ONE `leEcdsa` verify per PTB); needs `packages.pyth_lazer_rule` feeds + a `pythApiKey`. `'waterx_rule'` = the first-party WaterX quote-center (Nautilus-TEE, ed25519-signed CEX prices): one signed Merkle leaf per ticker, no API key; needs `packages.waterx_rule` feeds. Neither charges an on-chain update fee — Pyth Core, which did, was removed in 4.4.0. |

**Multi-source fed sets.** With a list, ONE build fetches and feeds EVERY listed source's data in the same PTB; the chain's per-ticker aggregator **weight tables** decide which contributions count — feeding an unweighted rule's price is dropped on-chain, while starving a weighted rule aborts. That asymmetry is what makes weight migrations (Lazer↔waterx coexistence) safe: keep the list a **superset** of every ticker's weighted rule set and flip weights per ticker at any time — an env edit, never an SDK release. (One caveat: waterx's feed call burns a per-symbol signed-timestamp high-water mark regardless of weights — see the replay note below.)

**No cross-source fallback, no feeds guard anywhere.** Construction rejects an empty/nullish `oracleSource` **and any value outside `ORACLE_SOURCES`** (a legacy `'core'` / `'pyth'` / `'pyth_rule'` string fails at `create`). Beyond that, the fed set names what the client is **willing** to push and the loaded config decides what it **can**: a listed source the deployment has no package block for — or whose `feeds` map is empty — simply contributes nothing, at init _and_ at tx-build. A requested ticker that **no** listed source serves is **skipped**, not fatal: `refreshOraclePrices` returns `{ refreshed, skipped }` so a caller can log or alert on it, and the PTB carries the legs the deployment actually has (a ticker is servable with no update leg only when `constant_rule` is the sole rule wired for it). A skipped ticker keeps whatever price the on-chain `Oracle` already holds — the trading call is what rejects it if too stale. A present-but-wrong feed id is likewise not validated by the SDK; it aborts on-chain at dry-run.

Every source's external infra is a **rule-owned per-network table**, never deployment-overridable and never in the config JSON: `LAZER_INFRA` (`src/oracle/rules/pyth-lazer-rule.ts`), `WATERX_INFRA` (`src/oracle/rules/waterx-rule.ts` — testnet `quote-center-staging.waterx.app` / mainnet `quote-center.waterx.app`, accessor `waterxQuoteCenterEndpoint(network)`). For **price READS**, `resolveOracleReadPlan(host, source, tickers)` gives the per-source served set; only `waterx_rule` has a read plane (the quote-center). **`pyth_lazer_rule` is write-only** — it pushed prices with integer feed ids and read them through the hex ids `pyth_rule.feeds` carried, so removing Pyth Core removed its read plane too; every lazer-written ticker now comes back in the plan's `unreadable` list. Price facades should read through `waterx_rule` (on mainnet its feed set is a superset of lazer's) or their own source. `client.pyth` is the access-only `PythAccessConfig` — just the caller-supplied `pythApiKey` / `pythFetch` create options for Lazer (a secret has no place in a public CDN JSON); `client.waterx` is likewise `WaterxAccessConfig` (`waterxEndpoint` / `waterxFetch` overrides only; fetch policy resolves **`waterxFetch` → built-in defaults** — deliberately no `pythFetch` fallback, sources never share config). See the browser/CORS note below.

```ts
// Per-environment wiring — the consumer owns the env var, not the SDK.
// parseOracleSourceList is THE canonical parser (trim, drop empty entries,
// validate every value, dedupe, throw operator-actionably) — never a bare
// split-and-cast, which would hand the strict constructor untrimmed junk.
import { parseOracleSourceList } from "@waterx/sdk/oracle";

const perp = await PerpClient.create(network, {
  waterxConfigUrl,
  oracleSource: parseOracleSourceList(process.env.ORACLE_SOURCE), // REQUIRED; comma list = the fed set
  pythApiKey: process.env.PYTH_API_KEY, // required iff 'pyth_lazer_rule' is listed (Lazer is auth-first)
});
```

This is the coexistence rollout pattern: staging lists every source under migration (`ORACLE_SOURCE=pyth_lazer_rule,waterx_rule` + `PYTH_API_KEY`) while production stays single-value (`ORACLE_SOURCE=waterx_rule`) until its weight tables move — flipping an environment is an env-var change, never an SDK release.

### Adding an oracle source (runbook)

Every source plugs in the same way — routing is driven **only** by the client's `oracleSource` option (never a config `enabled` flag, never `process.env`):

1. **Implement `PriceUpdateRule`** in `src/oracle/rules/<name>-rule.ts` — all port fields (`src/oracle/price-update-rule.ts`): `kind`, `requiresFeeSource` (`true` iff the on-chain verify draws a per-update fee — gates the fail-fast fee-source check), `supportedTickers`, `fetchUpdateData`, `narrowUpdateData` (subset a cached whole-universe payload to one build's tickers — a divisible payload returns a per-feed subset, an indivisible one returns itself whole iff fully covered; uncovered ticker → `null` miss), `buildUpdateCalls`.
2. **Register it** in `src/oracle/rule-registry.ts` (`DEFAULT_RULES`) under a new `OracleSource` value — added to `ORACLE_SOURCES` in `price-update-rule.ts` (the union derives from that list; a registry test pins every listed value to a registered rule).
3. **Publish the on-chain rule package** — its config entry (package ids, per-ticker `feeds`) arrives via the normal `waterx-config` deploy pipeline; type it in `OraclePackages` (`src/oracle/config.ts`).
4. **Add SDK infra constants** if the source needs external infra that is not part of the config JSON (API endpoints, verifier packages, state objects) — a **rule-owned** per-network table inside the rule's own file, mirroring `LAZER_INFRA` / `WATERX_INFRA` (never on the shared client, never in `oracle/config.ts`). Wire its read-plane served-set/ids into `resolveOracleReadPlan` (`src/oracle/read-plane.ts`).
5. **Consumers flip `oracleSource`** per environment — no consumer code change, no SDK re-release.

The in-house `waterx_rule` (ed25519 enclave-signed CEX prices, `src/oracle/rules/waterx-rule.ts`) took exactly this path: it pulls one signed Merkle **leaf** per requested ticker from the quote-center (`GET /v1/quotes/leaves?symbols=…`, public read — no auth), then verifies **and** feeds in a single `waterx_rule::collect_single_with_proof` call per collector, so it emits no shared verify step. Each leaf carries its own membership proof and the enclave's signature over the snapshot root, so a PTB rebuilds exactly ONE price item however wide the snapshot was. Against a quote-center with no leaf route (404) it falls back to the older shape — one signature over a whole batch (`GET /v1/quotes/update`) fed through `collect_batch_latest`, which is indivisible and therefore has to rebuild _every_ item in the batch in-PTB just to use one symbol's price.

On-chain, both entries dispose of failures identically: a **freshness** miss abstains (the other weighted rules cover), and so does a **replayed** signed timestamp (the per-symbol high-water mark of audit F-014 — already recorded means the chain already holds a price at least this fresh, so concurrent builds sharing one snapshot no longer kill each other; only the single-rule `feed_*` entries abort on a replay). A config mismatch, a bad signature, or a signed timestamp **ahead of the on-chain `Clock`** aborts.

> **Browser consumers:** this source fetches the quote-center directly from the page, so the quote-center deployment must return `Access-Control-Allow-Origin` for the app's origin. For an origin that is not on that allowlist, point the SDK at your own proxy instead of the default host — the endpoint and the transport are both overridable at client init:
>
> ```ts
> const perp = await PerpClient.create(network, {
>   waterxConfigUrl,
>   oracleSource: "waterx_rule",
>   // absolute URL on your own origin; its base path is PRESERVED, so this
>   // fetches https://app.example/api/quote-center/v1/quotes/leaves
>   waterxEndpoint: "https://app.example/api/quote-center",
>   waterxFetch: { fetchImpl: myFetch, timeoutMs: 8_000 }, // optional custom transport / policy
> });
> ```
>
> Unset, `waterxEndpoint` falls back to the rule-owned `WATERX_INFRA[network]` and `waterxFetch` to the built-in policy (15s timeout, 2 retries) — there is deliberately no `pythFetch` fallback. Both are inert under `pyth_lazer_rule`. They are also top-level options on the umbrella `WaterXClient.create({ oracleSource, waterxEndpoint, waterxFetch, … })`, which forwards them to the perp line. Node/keeper consumers are unaffected by CORS either way.

## Recipes & full surface

To avoid doc drift, per-action usage lives in maintained, lint-checked code rather than this README:

- **Start here:** [`examples/quickstart.ts`](./examples/quickstart.ts) — the [First integration](#first-integration) walkthrough as one runnable file.
- **Perp recipes:** [`examples/`](./examples) — ~30 runnable scripts (place orders, WLP mint/redeem, account/delegates, reads). Each uses `buildClient()` + a builder + `simThenMaybeExecute`.
- **Prediction recipes:** [`test/prediction/e2e/`](./test/prediction/e2e) — the live reference for `client.predict.*` flows.
- **Authoritative export list:** [`src/perp/index.ts`](./src/perp/index.ts) (perp) and [`src/prediction/index.ts`](./src/prediction/index.ts) — clients, builders, view helpers, BCS types, and `*Calls` generated namespaces. The package root (`.`) is [`src/sdk.ts`](./src/sdk.ts) (umbrella + flat-perp re-export); the shared base is published at `@waterx/sdk/account` and `@waterx/sdk/oracle`.

Perp `build*Tx` helpers are oracle-backed (`async`; they refresh prices before the call) — through whichever source `oracleSource` selects. The oracle layer (sources, rules, refresh) lives in [`src/oracle/`](./src/oracle).

## Troubleshooting

Every row below is a message the SDK or the chain actually emits. Simulate first — all of
these surface at simulate, before you spend gas.

| Message                                                                       | What it means, and what to do                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadConfig: no config URL — pass opts.waterxConfigUrl`                       | `waterxConfigUrl` is unset; there is no default and no env fallback. Read the URL in your app and pass it to `create()`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `oracleSource is REQUIRED and must name at least one of …`                    | Missing, empty, or a retired value — `'core'`, `'pyth'`, and now **`'pyth_rule'`** (Pyth Core was removed in 4.4.0). Parse env with `parseOracleSourceList`, not a bare `split`.                                                                                                                                                                                                                                                                                                                          |
| A ticker appears in `refreshOraclePrices`'s returned `skipped` list           | No listed source serves it in this deployment, so nothing was emitted for it (this is a skip, not a throw — it was one before v4.4.0). Add the feed under a listed source, or list a source that serves it. Constant-only tickers are never skipped.                                                                                                                                                                                                                                                      |
| `EMissingPriceSource` (Move abort in `aggregator::remove_outliers`)           | The fed set does not cover that ticker's on-chain weighted rules — starving a weighted rule aborts, feeding an unweighted one is a no-op. Run `pnpm oracle:aggregates:testnet` and widen `oracleSource` to a superset.                                                                                                                                                                                                                                                                                    |
| `LazerApiKeyMissing: pyth_lazer_rule requires a Pyth Lazer access token`      | `'pyth_lazer_rule'` is listed but `pythApiKey` was not passed. The SDK never reads `process.env` for it — pass it at client creation.                                                                                                                                                                                                                                                                                                                                                                     |
| `EAccountNotFound` (Move abort in `account::borrow_account`)                  | The `accountId` does not exist on this network — usually a fixture from another deployment, or a Sui address used where a wxa account id belongs. Create one with `client.account.createAccount`.                                                                                                                                                                                                                                                                                                         |
| `EReplayedSignature`                                                          | One `waterx_rule` envelope was fed twice for the same symbol; a signed timestamp is single-use per symbol (audit F-014). Fetch per build — never share one across concurrent builds.                                                                                                                                                                                                                                                                                                                      |
| CORS failure fetching the quote-center (browser only)                         | `waterx_rule` fetches from the page and your origin is not on the allowlist. Point `waterxEndpoint` at a same-origin proxy; its base path is preserved. Node and keeper consumers are unaffected.                                                                                                                                                                                                                                                                                                         |
| Ticker lookups return nothing                                                 | Wrong format. Tickers are concatenated — `BTCUSD`, never `BTC/USD` or `BTC`. Canonical list: the config JSON's `markets` keys.                                                                                                                                                                                                                                                                                                                                                                            |
| Prices off by 10⁹, or an order fills far from the intended level              | A human-readable number was passed where a raw 1e9-scaled `u64` belongs. Wrap in `rawPrice()`. Exception: view `basePriceUsd` args take a **whole-dollar** u64 — use `parseWholeDollarU64`.                                                                                                                                                                                                                                                                                                               |
| Everything lands in `skipped` on `MAINNET` with a fed set copied from testnet | The two networks configure **different sources**, and the set moves over time. Listing a source the network doesn't configure is harmless — it contributes no tickers — but a fed set that names _only_ such sources serves nothing. Confirm per network with `pnpm oracle:aggregates:mainnet`, and check the config's rule blocks (`packages.pyth_lazer_rule` / `waterx_rule`) rather than assuming either is present. A `packages.pyth_rule` block, if the config still ships one, is ignored entirely. |

## Documentation map

| Document                                                           | What it answers                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`SKILLS.md`](./SKILLS.md)                                         | The fixed integration flow, for an agent or a developer                    |
| [`examples/README.md`](./examples/README.md)                       | Every runnable perp recipe, one file per entry point                       |
| [`CHANGELOG.md`](./CHANGELOG.md)                                   | What changed per release — **read before upgrading** (see versioning note) |
| [`PACKAGES.md`](./PACKAGES.md)                                     | The Move packages behind the SDK                                           |
| [`CLAUDE.md`](./CLAUDE.md)                                         | Architecture and contract surface, for people hacking on the SDK           |
| [`test/perp/README.md`](./test/perp/README.md)                     | Perp test tiers, fixtures, and known skips                                 |
| [`test/prediction/README.md`](./test/prediction/README.md)         | Prediction test tiers and the live `client.predict.*` reference            |
| [`waterx-config`](https://github.com/WaterXProtocol/waterx-config) | The canonical deployment JSON schema                                       |

## Development

Working on the SDK itself (rather than consuming it):

```bash
pnpm install
pnpm build
```

| Command                          | Use                                                                      |
| -------------------------------- | ------------------------------------------------------------------------ |
| `pnpm typecheck`                 | Typecheck the whole tree                                                 |
| `pnpm docs:check`                | Resolve every relative link in the docs                                  |
| `pnpm test` / `pnpm test:unit`   | Unit tests (perp + prediction)                                           |
| `pnpm test:e2e`                  | Testnet simulate e2e (perp + prediction)                                 |
| `pnpm test:integration`          | On-chain integration (needs `SUI_PRIVATE_KEY`; local-only)               |
| `pnpm lint` / `pnpm format`      | ESLint + Prettier                                                        |
| `pnpm codegen`                   | Regenerate `src/generated` from Move                                     |
| `pnpm oracle:aggregates:testnet` | Per-ticker aggregator sources + weights (diagnose `EMissingPriceSource`) |
| `pnpm seed:testnet`              | Seed prediction testnet fixtures (needs `SUI_PRIVATE_KEY`)               |

Tests are split per line under `test/perp/` and `test/prediction/`, each with `unit` / `e2e` / `integration` tiers. See the per-line `README.md` in each.
