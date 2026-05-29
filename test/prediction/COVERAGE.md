# Test coverage — 14 indexer events × test files × required keys

This SDK's tests are designed so that **the indexer in `data-infra/waterx-predict-indexer` and the API in `bucket-backend-mono/predict-bet` see exactly the on-chain payloads they decode against**. Each row below maps a Move event (`waterx_prediction::events::*`) to the SDK PTB that emits it, the E2E (dry-run simulate) tests that exercise the PTB, and the Integration (sign + execute) tests that emit + assert the event end-to-end.

## Key-tier map

| Tier | Env var | Powers |
|------|---------|--------|
| **none** | — | All E2E simulate tests (read-only, public testnet RPC). |
| **owner** | `SUI_PRIVATE_KEY` | Place orders, request close, claim, deposit, all `pnpm seed:testnet` baseline stages, all owner-side Integration tests. |
| **keeper** | `E2E_KEEPER_PRIVATE_KEY` (or owner if registered) | Fill, cancel orders, confirm / cancel close, force-claim, resolve markets. Required for `--preset=with-claim` seed + Order / Close / Claim Integration tests that need the full lifecycle. |
| **admin** | (AdminCap holder) | Pause / unpause, treasury, min-reserve / cooldown updates, keeper add / remove. Required for `--preset=admin` seed + Admin Integration tests. |

## Event → test mapping

| Move event | SDK PTB | E2E file (simulate) | Integration file (sign + execute) | Required key |
|------------|---------|---------------------|-----------------------------------|--------------|
| `OrderPlaced` | [`placeOrder`](../src/prediction.ts) / [`adminPlaceOrderFor`](../src/prediction.ts) | [order.e2e.test.ts](e2e/order.e2e.test.ts) | [order.integration.test.ts](integration/order.integration.test.ts) | owner (admin variant: admin) |
| `OrderFilled` | [`fillOrder`](../src/prediction.ts) | [order.e2e.test.ts](e2e/order.e2e.test.ts) | [order.integration.test.ts](integration/order.integration.test.ts) | keeper |
| `OrderCancelled` | [`selfCancelOrder`](../src/prediction.ts) / [`cancelOrder`](../src/prediction.ts) | [order.e2e.test.ts](e2e/order.e2e.test.ts) | [order.integration.test.ts](integration/order.integration.test.ts) | owner / keeper |
| `CloseRequested` | [`requestClose`](../src/prediction.ts) | [close.e2e.test.ts](e2e/close.e2e.test.ts) | [close.integration.test.ts](integration/close.integration.test.ts) | owner |
| `CloseConfirmed` | [`confirmClose`](../src/prediction.ts) | [close.e2e.test.ts](e2e/close.e2e.test.ts) | [close.integration.test.ts](integration/close.integration.test.ts) | keeper |
| `CloseCancelled` | [`selfCancelClose`](../src/prediction.ts) / [`cancelClose`](../src/prediction.ts) | [close.e2e.test.ts](e2e/close.e2e.test.ts) | [close.integration.test.ts](integration/close.integration.test.ts) | owner / keeper |
| `PositionClaimed` | [`claim`](../src/prediction.ts) / [`forceClaim`](../src/prediction.ts) | [claim.e2e.test.ts](e2e/claim.e2e.test.ts) | [claim.integration.test.ts](integration/claim.integration.test.ts) | owner / keeper |
| `MarketResolved` | [`resolveMarket`](../src/prediction.ts) | [market.e2e.test.ts](e2e/market.e2e.test.ts) | [claim.integration.test.ts](integration/claim.integration.test.ts) | keeper |
| `MarketPaused` / `MarketUnpaused` | [`pauseMarket`](../src/admin.ts) / [`unpauseMarket`](../src/admin.ts) | [admin.e2e.test.ts](e2e/admin.e2e.test.ts) | [admin.integration.test.ts](integration/admin.integration.test.ts) | admin |
| `MarketRegistryWithdrawn` | [`adminWithdraw`](../src/admin.ts) | [admin.e2e.test.ts](e2e/admin.e2e.test.ts) | [admin.integration.test.ts](integration/admin.integration.test.ts) | admin |
| `MinReserveUpdated` | [`setMinReserve`](../src/admin.ts) | [admin.e2e.test.ts](e2e/admin.e2e.test.ts) | [admin.integration.test.ts](integration/admin.integration.test.ts) | admin |
| `OrderCancelCooldownUpdated` | [`setOrderCancelCooldownMs`](../src/admin.ts) | [admin.e2e.test.ts](e2e/admin.e2e.test.ts) | [admin.integration.test.ts](integration/admin.integration.test.ts) | admin |
| `KeeperAdded` / `KeeperRemoved` | [`addKeeper`](../src/admin.ts) / [`removeKeeper`](../src/admin.ts) | [admin.e2e.test.ts](e2e/admin.e2e.test.ts) | [admin.integration.test.ts](integration/admin.integration.test.ts) | admin |
| (`depositSettlement` — no event by design) | [`depositSettlement`](../src/admin.ts) | [admin.e2e.test.ts](e2e/admin.e2e.test.ts) | [admin.integration.test.ts](integration/admin.integration.test.ts) | admin |

## Permanent E2E skips (by testnet design)

These are not bugs in the SDK — they are structural facts about the WaterX testnet deployment. They `ctx.skip` with a `Permanent skip on testnet:` prefix.

| Test | Why it skips |
|------|--------------|
| `account.requestWithdraw` | Withdraw policy on testnet is not `DirectRule` (`EPolicyMismatch`). |
| `account.whitelistPredictionProtocol` | Protocol is already whitelisted (`EProtocolAlreadyWhitelisted`); idempotent one-shot. |
| `order.adminPlaceOrderFor` | Dry-run sim requires the payment coin to be owned by the `AdminCap` holder. Run from the admin wallet to verify. |
| `admin.depositSettlement` | Same reason — payment coin owner must equal `AdminCap` holder. |

## Fixable E2E skips (run `pnpm seed:testnet`)

These tests skip until the matching seed stage has been run. Each skip message includes the exact command to fix it.

| Test | Run |
|------|-----|
| `order.keeper fillOrder+cancelOrder` / `fetch.getOrder` | `pnpm seed:testnet -- --stage=place-open` |
| `close.requestClose` (when no spare OPEN position) | `pnpm seed:testnet -- --stage=fill` |
| `close.keeper confirmClose+cancelClose` | `pnpm seed:testnet -- --stage=request-close` |
| `claim.claim` / `claim.forceClaim` | `pnpm seed:testnet -- --preset=with-claim` |
| `order.selfCancelOrder` / `close.selfCancelClose` (rescue paths — require expired orders) | `pnpm seed:testnet -- --preset=with-rescue` |

## Event field contract

Canonical on-chain field names live in [`contract/event-fields.ts`](contract/event-fields.ts).
Integration tests call `expectEventShape()` against that matrix so a Move rename breaks
tests and the indexer anti-corruption layer in the same PR.

## Known cross-repo gaps (out of SDK scope)

These are documented for sibling-PR reviewers; fixing them belongs in backend/indexer repos.

| Topic | SDK / indexer behaviour | API (`ChBetSource`) gap |
|-------|-------------------------|-------------------------|
| **`account_id`** | `OrderPlaced.account_id` is the **registry account object id** (0x…). Indexer stores it verbatim in `events_predict_order_placed.account_id`. | `GET /predict/bets/me` filters by JWT **wallet** `suiAddress` without `AccountResolver` — bet history returns empty until backend maps wallet → account object id ([bucket-backend-mono #498](https://github.com/Bucket-Protocol/bucket-backend-mono/pull/498)). |
| **`market_id`** | UTF-8 bytes on-chain; indexer hex-encodes to CH `market_id`. Integration tests use throwaway labels (`pred-it-…`) to avoid resolving shared testnet markets. | Bet `cardSnapshot` join expects production `market_id` = `predict_rounds.pm_market_condition_id`. SDK integration tests validate **indexer decode only**, not PG join. |
| **`position_id` join** | After `OrderFilled`, `position_id === order_id` (contract invariant). Integration asserts this explicitly. | `ChBetSource` joins close/claim tables on `position_id = p.order_id`. |
| **HTTP catalog E2E** | Not in this PR. | Opt-in `tests/api/` against `E2E_API_BASE_URL` — follow-up PR from `main`. |

## Local data-infra / API cross-check (optional)

The two PRs that this work was scoped against live in sibling repositories:

- Indexer (Rust, ClickHouse): `../data-infra/waterx-predict-indexer` ([PR #161](https://github.com/Bucket-Protocol/data-infra/pull/161))
- API (NestJS, `ChBetSource`): `../bucket-backend-mono/apps/...` ([PR #498](https://github.com/Bucket-Protocol/bucket-backend-mono/pull/498))

The Integration tests above assert event **type names** and **key field shapes** via
[`contract/event-fields.ts`](contract/event-fields.ts) and `expectEventShape()`. If a contract
update changes a field name, both the indexer and these tests must be updated together —
running `pnpm test:integration` on testnet exercises every event in the indexer's 14-handler set.

HTTP/API stack tests (`/predict/feed`, `/predict/bets/me`) are intentionally deferred to a
follow-up PR once backend infra is available locally.
