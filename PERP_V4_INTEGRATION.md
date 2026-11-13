# Perp v4 queued execution

ABI source: WaterXProtocol/waterx-contract#167 as merged to `main` at
`96079479893bf899fd1b751909d59d82eccd6594` (legacy `waterx_perp`, not Broker).
Bindings were generated from that checkout with Sui Move summaries and `@mysten/codegen`.
The public signatures are the ones of the earlier `ed63a1d` head; the behaviour
changes that landed after it are the delegate-permission rule, the linked-order
cap and the extra cancellation reason described below.

## Submission and settlement

In contract v4, close/increase/decrease submit linked market orders. Confirmation
of the submitting PTB is not a fill. Read the actual order ID from `ExecutionQueued`
(or the submission receipt), then observe OrderFilled/OrderCancelled and the
position events. A bucket-level `match_orders` success does not prove that a
particular order filled. Do not synthesize refunds; rejection refunds are performed
by the contract and also emit OrderCancelled.

`ExecutionQueuedBcs` and `OrderRejectedByKeeperBcs` schemas are exported from
`@waterx/sdk/perp`. Decode only events whose full package/type identity matches the
deployment; a matching struct suffix alone is not sufficient.

`increasePositionRequest` requires `orderId` to be omitted in v4, including when
its value would be zero. The queue allocates the ID. Legacy v3 inputs remain supported.

## Delegate permissions for market orders

On v4 a market order (`triggerPrice: undefined`) is authorized by the operation it
performs, not by `PERM_PLACE_ORDER`:

| Market order                                 | Permission required      |
| -------------------------------------------- | ------------------------ |
| No linked position (opens a position)        | `PERM_OPEN_POSITION`     |
| Linked position, same side                   | `PERM_INCREASE_POSITION` |
| Linked position, opposite side, partial size | `PERM_DECREASE_POSITION` |
| Linked position, opposite side, full size    | `PERM_CLOSE_POSITION`    |

Limit and stop orders still need `PERM_PLACE_ORDER`. A delegate or session key that
was granted only `PERM_PLACE_ORDER` could submit market orders on v3; on v4 the same
transaction aborts `EUnauthorized`. Widen the delegate's permissions before the
cutover.

## Linked orders and cancellation reasons

A position holds at most 10 resting limit / stop orders (`ETooManyLinkedOrders`
beyond that; the cap was 5 on v3). The pending market order awaiting a Keeper is not
counted, so a full set of TP/SL orders never blocks a close.

A linked market increase the Keeper cannot execute (collateral, leverage, open
interest, reserve, or a paused market) is cancelled and refunded with the
OrderCancelled memo `position cannot be increased`, releasing the position's
reservation. Treat it like the other cancellation memos: terminal for that order.

## Oracle policy

Order/position-intent composers skip Oracle refresh for deployments whose
`config.packages.waterx_perp.version >= 4`. This configuration must describe the
actual deployed package. That field is the on-chain upgrade counter, which equals
the Move `PACKAGE_VERSION` for `waterx_perp` on both networks (3 before this
upgrade, 4 after); the SDK switches flow when the config document is updated, so
publish the pin together with the package upgrade. V3 composers retain their refresh, and explicit
collateral deposit/withdraw composers retain their Oracle/checklist requirements.
Size/slippage calculations done by a consumer may still need an off-chain price;
this change only removes unnecessary on-chain refresh from intent submission.

## Cutover and limitations

Publish/release the SDK separately. This PR does not upgrade a package or change
config/permissions. Follow #167's cutover: enable v4 and disable earlier versions
on GlobalConfig, WlpPool and MarketRegistry before admitting v4 traffic. A frontend
flag is not the cutover gate.

A pending linked market order reserves a position. Keeper priority handling is
implemented separately in waterx-keeper#138/#139. A request blocked before it is
on-chain cannot be discovered by a scanning Keeper; use the user's authorized
cancel-and-resubmit flow. No arbitrary-account rejection API is provided here.

Validation is offline PTB, BCS and unit testing; it is not a deployed-chain test.
