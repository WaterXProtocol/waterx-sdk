---
name: waterx-sdk-integration
description: Use when integrating @waterx/sdk into an app, keeper, or bot — wiring a WaterX client, creating and funding a wxa account, building perp or prediction transactions, or debugging a WaterX build/simulate failure. Covers the required waterxConfigUrl and oracleSource options, the build→simulate→execute discipline, and the aborts integrators hit first.
---

# Integrating `@waterx/sdk`

WaterX is a perpetual futures DEX and prediction market on Sui. The SDK **builds
transactions**; it never signs on your behalf and never reads `process.env`. Every
chain-specific value comes from a config JSON *you* supply.

Work the steps in order. Each one has a decision you must make explicitly — the SDK has
no defaults for the first two on purpose, so that every environment runs the same build
and differs only by configuration.

## Step 1 — Choose the entry point

| You need                     | Import                                                | Client                    |
| ---------------------------- | ----------------------------------------------------- | ------------------------- |
| Both product lines           | `@waterx/sdk`                                         | `WaterXClient.create()`   |
| Perpetuals only              | `@waterx/sdk/perp`                                    | `PerpClient.create()`     |
| Prediction markets only      | `@waterx/sdk/prediction`                              | `PredictClient.create()`  |

The umbrella exposes three namespaces: `client.account` (shared wxa account + funding),
`client.perp`, `client.predict`. The two lines have colliding builder names
(`placeOrder`, `deposit`), which is why they are namespaced rather than flat.

**All factories are async** — they fetch deployment config.

```bash
pnpm add @waterx/sdk @mysten/sui @mysten/bcs   # the two Mysten packages are peers
```

Node ≥ 22. ESM and CJS both resolve.

## Step 2 — Supply the two required options

```ts
const client = await WaterXClient.create({
  network: "TESTNET",
  waterxConfigUrl: process.env.WATERX_CONFIG_URL, // REQUIRED — no default, no env fallback
  oracleSource: parseOracleSourceList(process.env.ORACLE_SOURCE), // REQUIRED — no default
});
```

**`waterxConfigUrl`** points at the canonical
[`waterx-config`](https://github.com/WaterXProtocol/waterx-config) JSON. It is fetched
as-is — the SDK appends no `<network>.json` and no git ref. Your app reads the env var;
the SDK never does. Look up ids through the client (`client.perp.getMarket(ticker)`,
`client.perp.creditType()`, `client.perp.wlpType()`) rather than hardcoding them.

**`oracleSource`** is one source or a **list — the fed set**. Every listed source's data
is fetched and fed in one PTB, and the chain's per-ticker weight tables arbitrate.

| Source            | Notes                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| `pyth_rule`       | Pyth Core; per-feed update fees; no credential                            |
| `pyth_lazer_rule` | one signed verify per PTB, no per-feed fees; **requires `pythApiKey`**    |
| `waterx_rule`     | first-party TEE quote-center; no credential; browser needs a CORS-allowed origin |

The rule that decides the value: **the fed set must be a superset of every ticker's
on-chain weighted rules.** Starving a weighted rule aborts `EMissingPriceSource`; feeding
an unweighted one is silently dropped. That asymmetry is what makes a weight migration an
env edit rather than an SDK release.

Never guess the set — read it off chain:

```bash
pnpm oracle:aggregates:testnet   # per-ticker aggregator sources + weights
```

Parse env with `parseOracleSourceList` (it trims, drops empties, validates, dedupes, and
throws actionably), never a bare `split(",")`.

## Step 3 — Ensure a wxa account

Every trading call needs a `waterx_account` account id. One account serves both lines.
It is **not** a Sui address — it is an object id returned by `create_account` and emitted
in the `AccountCreated` event.

```ts
const tx = new Transaction();
client.account.createAccount(tx, { alias: "alice" });
const res = await client.perp.signAndExecuteTransaction({ transaction: tx, signer });
// read account_object_address out of the AccountCreated event; persist it
```

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
const tx = await client.perp.buildPlaceOrderTx({
  ticker: "BTCUSD",
  collateralType: client.perp.creditType(),
  accountId,
  main: {
    isLong: true,
    isStopOrder: false,
    reduceOnly: false,
    size: rawPrice(0.001),
    triggerPrice: undefined,          // omit ⇒ market order
    acceptablePrice: rawPrice(120_000), // slippage cap
    collateralAmount: 5_000_000n,
  },
  preOrders: [],                      // optional reduce-only TP/SL legs
});

tx.setSender(address);
await client.perp.simulate(tx);       // ALWAYS. Free, and catches every step-2 mistake.
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
  (Collateral *tokens* keep a plain symbol — `USDC` — and are a different thing.)
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

| Error | Go back to |
| ----- | ---------- |
| `loadConfig: no config URL …` | Step 2 — `waterxConfigUrl` |
| `oracleSource is REQUIRED …` / `… has no feed configured for ticker(s)` | Step 2 — `oracleSource` |
| `EMissingPriceSource` | Step 2 — the fed set is too narrow for that ticker |
| `LazerApiKeyMissing …` | Step 2 — `pythApiKey` |
| `EAccountNotFound` | Step 3 — the account id is not on this network |
| `EReplayedSignature` | Step 5 — an envelope was reused across builds |

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
