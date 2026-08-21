---
name: waterx-sdk-integration
description: Use when integrating @waterx/sdk into an app, keeper, or bot — wiring a WaterX client, creating and funding a wxa account, building perp or prediction transactions, or debugging a WaterX build/simulate failure. Covers the required waterxConfigUrl option, the config-derived oracle fed set, the build→simulate→execute discipline, and the aborts integrators hit first.
---

# Integrating `@waterx/sdk`

WaterX is a perpetual futures DEX and prediction market on Sui. The SDK **builds
transactions**; it never signs on your behalf and never reads `process.env`. Every
chain-specific value comes from a config JSON _you_ supply.

Work the steps in order. Each one has a decision you must make explicitly — the SDK has
no defaults for the first two on purpose, so that every environment runs the same build
and differs only by configuration.

## Step 1 — Choose the entry point

| You need                | Import                   | Client                   |
| ----------------------- | ------------------------ | ------------------------ |
| Both product lines      | `@waterx/sdk`            | `WaterXClient.create()`  |
| Perpetuals only         | `@waterx/sdk/perp`       | `PerpClient.create()`    |
| Prediction markets only | `@waterx/sdk/prediction` | `PredictClient.create()` |

The umbrella exposes three namespaces: `client.account` (shared wxa account + funding),
`client.perp`, `client.predict`. The two lines have colliding builder names
(`placeOrder`, `deposit`), which is why they are namespaced rather than flat.

**All factories are async** — they fetch deployment config.

```bash
pnpm add @waterx/sdk @mysten/sui @mysten/bcs   # the two Mysten packages are peers
```

Node ≥ 22. ESM and CJS both resolve.

## Step 2 — Supply the config URL

```ts
import { WaterXClient } from "@waterx/sdk";

const client = await WaterXClient.create({
  network: "TESTNET",
  waterxConfigUrl: process.env.WATERX_CONFIG_URL, // REQUIRED — no default, no env fallback
  pythApiKey: process.env.PYTH_API_KEY, // required iff the config wires pyth_lazer_rule
});
```

**`waterxConfigUrl`** points at the canonical
[`waterx-config`](https://github.com/WaterXProtocol/waterx-config) JSON. It is fetched
as-is — the SDK appends no `<network>.json` and no git ref. Your app reads the env var;
the SDK never does. Look up ids through the client (`client.perp.getMarket(ticker)`,
`client.perp.creditType()`, `client.perp.wlpType()`) rather than hardcoding them.

**The oracle fed set is DERIVED from that config** — there is no `oracleSource` option
and no `ORACLE_SOURCE` env var. A source is fed when its block is published, carries at
least one feed, and is not explicitly `enabled: false`. Every derived source's data is
fetched and fed in one PTB, and the chain's per-ticker weight tables arbitrate. Read the
answer for a live deployment with `client.perp.oracleSources`, or before a client exists
with `deriveOracleSources(config)`.

| Source            | Notes                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| `pyth_lazer_rule` | one signed verify per PTB, no per-feed fees; **requires `pythApiKey`**           |
| `waterx_rule`     | first-party TEE quote-center; no credential; browser needs a CORS-allowed origin |

(`pyth_rule` — Pyth Core / Hermes — was retired in 5.0.0. Its block is still published
in the live configs and is inert: it is not a derivable source, so nothing feeds it.)

Why derived rather than declared: **the fed set must be a superset of every ticker's
on-chain weighted rules.** Starving a weighted rule aborts `EMissingPriceSource`; feeding
an unweighted one is silently dropped. Because the failure is one-sided, taking every
source the config wires is the fail-safe answer — and a hand-typed list could only err
in the fatal direction (the classic being one copied between networks). A weight
migration is then a config change, never an env edit and never an SDK release.

Inspect what a network actually weights when you are debugging:

```bash
pnpm oracle:aggregates:testnet   # per-ticker aggregator sources + weights
```

Want to fail at BOOT rather than at the first trade that needs a missing feed? Pass the
tickers you care about to `assertOracleWriteCoverage(client.perp, tickers)`.

## Step 3 — Ensure a wxa account

Every trading call needs a `waterx_account` account id. One account serves both lines.
It is **not** a Sui address — it is an object id returned by `create_account` and emitted
in the `AccountCreated` event.

```ts
import { Transaction } from "@mysten/sui/transactions";
import { AccountCreated } from "@waterx/sdk/generated/waterx_account/events";

const tx = new Transaction();
client.account.createAccount(tx, { alias: "alice" });
const exec = await client.perp.signAndExecuteTransaction({ transaction: tx, signer });
const digest = exec.Transaction?.digest ?? "";

// The id is NOT a builder return value — read it back off the digest. Decode the
// event's `bcs`, never its `json`: only the BCS layout is the Move struct itself.
// (`as const` is load-bearing — it is what types `events` as present.)
const res = await client.perp.grpcClient.getTransaction({
  digest,
  include: { events: true } as const,
});
const ev = res.Transaction?.events?.find((e) => e.eventType.endsWith("::events::AccountCreated"));
const accountId = ev ? AccountCreated.parse(ev.bcs).account_object_address : undefined; // persist
```

A **simulate emits the same `AccountCreated` event but creates nothing** — the address
in a dry run's events is not on chain and reusing it aborts `EAccountNotFound`. Only read
an id back after a real execute. Runnable version:
`accountIdFromDigest` in `examples/_shared.ts`.

## Step 4 — Fund it

Collateral must sit **inside** the account. Depositing is two calls in one PTB:
`requestDeposit(coin)` returns a `DepositRequest` hot potato, then
`direct_rule::consume_deposit_direct(req)` finalizes it. Leaving out the second call is a
build error, not a silent no-op.

Cross-chain CREDIT (`credit.ts`) and the native PSM (`custody.ts`) are the other funding
routes.

## Step 5 — Build → simulate → execute

Builders are **build-only**: they return or mutate a `Transaction`. Signing stays with
you — a keypair, or a browser wallet.

```ts
import { rawPrice } from "@waterx/sdk/perp";

const tx = await client.perp.buildPlaceOrderTx({
  ticker: "BTCUSD",
  collateralType: client.perp.creditType(),
  accountId,
  main: {
    isLong: true,
    isStopOrder: false,
    reduceOnly: false,
    size: rawPrice(0.001),
    triggerPrice: undefined, // omit ⇒ market order
    acceptablePrice: rawPrice(120_000), // slippage cap
    collateralAmount: 5_000_000n,
  },
  preOrders: [], // optional reduce-only TP/SL legs
});

tx.setSender(address);
await client.perp.simulate(tx); // ALWAYS. Free, and catches every step-2 mistake.
await client.perp.signAndExecuteTransaction({ transaction: tx, signer });
```

`build*Tx` helpers are **async** because they prepend the oracle refresh legs. The
low-level `*Request` builders are sync and do not refresh — pair them with
`executeTrading` in the same PTB if you compose by hand.

There is no `open_position_request`. A market order is a limit order with
`triggerPrice: undefined` and a non-zero `acceptablePrice`; a keeper fills it.

## Step 6 — Read state

Reads are `simulateTransaction` + BCS decode: no signer, no gas, zero-address sender.

```ts
const positions = await client.perp.getAccountPositions({
  ticker: "BTCUSD",
  accountObjectAddress: accountId,
  basePriceUsd: 0n,
});
```

Returned structs keep their **snake_case** Move field names
(`account_object_address`, `create_timestamp`) — use them as-is.

## Red flags

Stop if you catch yourself doing any of these:

- **Hardcoding an object id.** It belongs in the config JSON, read via the client.
- **Writing `BTC/USD` or `BTC`.** Tickers are concatenated: `BTCUSD`, `ETHUSD`, `SUIUSD`.
  (Collateral _tokens_ keep a plain symbol — `USDC` — and are a different thing.)
- **Passing a plain number as a price or size.** Wrap in `rawPrice()`. The exception:
  view `basePriceUsd` arguments take a whole-dollar u64 — `parseWholeDollarU64`.
- **Skipping simulate.** Every failure in the table below is free to find at simulate.
- **Reusing one `waterx_rule` envelope across concurrent builds for the same symbol.**
  A signed timestamp is single-use per symbol and the second one aborts
  `EReplayedSignature` — weight-independent (audit F-014). Fetch per build.
- **Expecting a fallback between oracle sources.** There is none. Sources are
  self-contained; an absent feed fails at tx-build.
- **Reaching for `process.env` inside SDK calls.** Read env at your app's boundary and
  pass values in.
- **Assuming SemVer.** This package may ship a breaking change in a patch. Pin exact and
  read the CHANGELOG before upgrading.

## Aborts and errors

Which step a failure sends you back to. The **full messages, causes, and fixes live in
one place** — `README.md`'s Troubleshooting table — so that they stay accurate; do not
re-derive them from here.

| Error                                                                 | Go back to                                         |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| `loadConfig: no config URL …`                                         | Step 2 — `waterxConfigUrl`                         |
| `fed set […] has no feed for ticker(s)` (`OracleTickerUnservedError`) | Step 2 — the config's feeds                        |
| `EMissingPriceSource`                                                 | Step 2 — the fed set is too narrow for that ticker |
| `LazerApiKeyMissing …`                                                | Step 2 — `pythApiKey`                              |
| `EAccountNotFound`                                                    | Step 3 — the account id is not on this network     |
| `EReplayedSignature`                                                  | Step 5 — an envelope was reused across builds      |

## Verifying an integration

1. `client.perp.simulate(tx)` returns without `FailedTransaction` for one order build.
2. A read path returns real rows for a funded account.
3. The fed set covers every ticker you trade — cross-check `pnpm oracle:aggregates`.
4. Only then execute, and confirm the digest.

## Reference

- Runnable walkthrough: `examples/quickstart.ts`
- Every perp recipe, one file per entry point: `examples/`
- Prediction reference flows: `test/prediction/e2e/`
- Authoritative export lists: `src/perp/index.ts`, `src/prediction/index.ts`
- Architecture and contract surface: `CLAUDE.md`
