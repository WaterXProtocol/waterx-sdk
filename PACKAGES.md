# Move packages behind the SDK

**There is no ID table here, on purpose.** Every chain-specific value — package ids, shared
objects, per-market objects, per-source feed maps — lives in the canonical
[`waterx-config`](https://github.com/WaterXProtocol/waterx-config) JSON and is fetched at
client init. A table in this file would be a second source of truth that silently rots; the
previous one did exactly that, and ended up describing a contract generation the SDK no
longer speaks to.

Hardcoding ids is the single most common integration mistake. Read them off the client.

## Reading ids

```ts
const client = await WaterXClient.create({ network: "TESTNET", waterxConfigUrl });

client.perp.config.packages.waterx_perp.published_at; // package id
client.perp.config.packages.waterx_perp.global_config; // shared GlobalConfig
client.perp.config.packages.waterx_perp.market_registry_wlp; // shared MarketRegistry<WLP>
client.perp.getMarket("BTCUSD"); // { market, config } — throws if absent
client.perp.wlpType(); // `${wlp.original_id}::wlp::WLP`
client.perp.creditType();
client.perp.oracleSources; // the fed set this deployment wires (see below)
```

## The packages

The v3 contracts live in `../waterx-contract/` as sibling Move packages. What each one is,
rather than where it is:

| Package             | Role                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `waterx_perp`       | Core perp protocol — markets, positions, orders, the trading request flow |
| `waterx_perp_view`  | Simulate-only view module; every read path goes through it                |
| `waterx_account`    | Generalized multi-account framework (`Pool` / `Account` / `Request<P>`)   |
| `waterx_oracle`     | One shared `Oracle`, keyed by ticker string                               |
| `waterx_staking`    | Staking + reward vault                                                    |
| `waterx_prediction` | Prediction markets (the `client.predict` line)                            |
| `waterx_referral`   | Referral codes                                                            |
| `wlp`               | The WLP coin (OTW)                                                        |
| `bucket_framework`  | `Float` / `Double` / `LinkedTable` / `Account` / `Sheet`                  |

### Oracle rules

An **oracle rule** is a source of signed prices the `Oracle` aggregates. Which ones a build
feeds is **derived from the config, not passed as an argument** — see below.

| Rule                | What it is                                                                    |
| ------------------- | ----------------------------------------------------------------------------- |
| `pyth_lazer_rule`   | Pyth Lazer signed updates (leEcdsa). Auth-first — needs a `pythApiKey`        |
| `waterx_rule`       | First-party Nautilus-TEE quote-center, ed25519 signed. No credential, no fee  |
| `constant_rule`     | Pins a ticker to a fixed price (e.g. `USDCUSD`). Not a source — no update leg |
| `supra_rule`        | Auxiliary weighted leg, fed alongside a source when wired                     |
| `pyth_rule`         | **RETIRED in 5.0.0** (Pyth Core / Hermes). Block still published; inert       |
| `pyth_sponsor_rule` | **RETIRED in 5.0.0** — paid Pyth Core's per-feed fees, which no longer exist  |

## The fed set is derived, never passed

There is no `oracleSource` create option and no `ORACLE_SOURCE` env var. A source is fed
when its config block is published, carries at least one feed, and is not explicitly
`enabled: false`. So mainnet derives `[pyth_lazer_rule, waterx_rule]` and testnet
`[waterx_rule]` with no per-environment wiring at all.

The reason is that the chain arbitrates and the failure is one-sided: feeding an
**unweighted** rule is dropped on-chain, while starving a **weighted** one aborts
`EMissingPriceSource`. Taking every source the config wires is therefore the fail-safe
answer, and a hand-typed list could only err in the fatal direction — the classic being one
copied between networks, naming a source that deployment does not carry.

The two retired blocks above are inert for a structural reason worth knowing: neither is a
member of `ORACLE_SOURCES`, so no rule module exists that could feed one. Their continued
presence in the live configs changes nothing.

```ts
import { deriveOracleSources } from "@waterx/sdk/oracle";

deriveOracleSources(config); // before a client exists — e.g. a boot assert
client.perp.oracleSources; // the same value, on a live client
```

See [Oracle sources](./README.md#oracle-sources) for the full treatment, and
`pnpm oracle:aggregates:testnet` to read what a network actually weights on chain.
