# Perp v4 queued execution

ABI source: WaterXProtocol/waterx-contract#167 at
`ed63a1d536a71d9c267e9185cea2fd9a523c8d88` (legacy `waterx_perp`, not Broker).
Bindings were generated from that checkout with Sui Move summaries and `@mysten/codegen`.

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

## Oracle policy

Order/position-intent composers skip Oracle refresh for deployments whose
`config.packages.waterx_perp.version >= 4`. This configuration must describe the
actual deployed package. V3 composers retain their refresh, and explicit
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
