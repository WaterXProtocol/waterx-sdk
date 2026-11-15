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
