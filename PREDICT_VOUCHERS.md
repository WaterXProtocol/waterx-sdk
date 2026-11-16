# Legacy Predict vouchers

Contract: waterx-contract #171, merged head `cbad571f60684e7d73a788df4b89e60dbbfbb590`.
This is `waterx_prediction`, not the general Broker/Perp Adapter.

`client.predict.placeOrderWithVoucher(tx, params)` and
`client.predict.buildPlaceVoucherOrderTx(params)` build self-account orders without a cash
sweep, receiver override or cash top-up. Amounts are raw credit units; use the credit type's
metadata, not the backing coin decimals. Every builder only constructs a PTB; the caller signs.

Use `getVoucherAccount` for available/reserved/paused and `getPositionSettlement` for live
position gross payout, actual cash payout and restored voucher credit. Values are bigint.
An unavailable/deleted view throws; it must never be interpreted as a cash-funded position.
A config package's upgrade `version` does not identify the Move logical version or Voucher capability.

Management builders: `grantVoucher` (granter AccountRequest + allowlist, additive),
`revokeVoucher` (available credit only), `setVoucherGrantBudget` (replaces remaining budget),
`setVoucherPaused`, `addVoucherGranter`, `removeVoucherGranter`. Admin operations require the
existing AdminCap. `getVoucherGranters` and `getVoucherGrantBudget` are read-only.
An issuer must durably deduplicate requests; a timeout requires digest reconciliation before retry.
No issuer signer, campaign API, expiry or issuance batch is invented by this SDK.

## Lifecycle

| Operation | Voucher credit | Actual cash |
| --- | --- | --- |
| Place | Available -> reserved | No debit |
| Fill | Cost consumed, unused reservation released; order finalized | Platform funds execution |
| Cancel | Reservation released | No refund |
| Winning claim | Spent | max(shares - cost, 0) |
| Losing claim | Spent | 0 |
| INVALID claim | Cost restored | 0 |

Existing cancel, fill, resolve, claim and force-claim builders retain their ABI: the contract
branches on the funding marker. Same-account splits retain the source and conserve cost/shares.
Sell/partial-close, cross-account transfers and gift creation are rejected by the contract.

Generated `predictionEventTypes` exposes the exact Voucher event BCS schemas. Process every
event in a transaction before treating absent source markers as cash; preserve registry + order
or position id, network + digest + actual event sequence. Order IDs and position IDs differ.
New event type origins are pinned to the package that first defined each type, not necessarily
the latest call target or initial package. Persist markers before transient orders/positions disappear.
`PositionClaimed.payout` already contains cash; do not add `VoucherPositionSettled.cash_paid` again.

Before any voucher traffic, disable ALL older Predict logical versions on shared state,
upgrade the independent Gift version gate, verify Broker/settlement targets, and deploy the
source-aware indexer/backend. Unit tests here are offline ABI/BCS tests, not a live fill/settlement proof.

## Regression coverage and optional chain verification

Offline tests cover USD/SUI/DEEP/WAL registry and credit-type routing, exact u64 values above
`Number.MAX_SAFE_INTEGER`, all Voucher builders and reads through `client.predict`, and all 13
event schemas against independently assembled BCS bytes (including winning, losing and INVALID
settlement fields). Post-build tests exercise the emitted ESM and CJS public entry points.

Regenerate bindings with the repository's `pnpm codegen` configuration, which names this package
`@waterx/prediction`. Passing a bare local contract path as a positional argument to
`sui-ts-codegen generate` overrides that configuration with an `@local-pkg/...` alias. The alias
regression test covers generated schema names and default/explicit package targets; keep the
configured alias when generating only the prediction package as well.

`test/prediction/integration/voucher.lifecycle.test.ts` is disabled by default. To run it manually,
set `E2E_VOUCHER_INTEGRATION=1`, `WATERX_E2E_NETWORK=testnet`, `WATERX_CONFIG_URL`,
`SUI_PRIVATE_KEY`, `E2E_ACCOUNT_ID`, and optionally `E2E_KEEPER_PRIVATE_KEY` and
`E2E_SETTLEMENT_ASSET` (USD/SUI/DEEP/WAL), then run:

```sh
pnpm exec vitest run --project predict-integration test/prediction/integration/voucher.lifecycle.test.ts
```

Use a dedicated, idle Account owned by the signer with at least 40 raw Voucher credit units
already granted, no reservations, and an existing registered Keeper signer. The registry must
have enough cash above its minimum reserve, and GlobalConfig must allow only logical version 8.
The suite refuses mainnet and never creates/funds accounts, issues vouchers, changes roles or
updates version gates. It creates isolated market IDs and submits real transactions only after
explicit opt-in. Reserve/fill/cancel and win/loss/INVALID claim assertions read the actual ledger
and transaction events; transaction-local events supply order/position IDs. An uncertain write
is not automatically resubmitted: inspect its digest/state before rerunning, especially after a
failure leaves a reservation. This uses manual authorized Keeper fill/resolve calls, not automatic
Broker or venue execution, and passing offline tests does not prove deployed service compatibility.
