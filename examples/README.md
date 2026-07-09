# examples/

Single-file, runnable TypeScript examples for every public SDK entry point.
Each file demonstrates **one** function. Read the top docstring to see
required env vars; run with `pnpm exec tsx examples/<path>`.

**Required:** set `WATERX_CONFIG_URL` to a canonical `waterx-config` JSON URL —
`buildClient()` reads it and passes it to the SDK as `waterxConfigUrl` (the SDK
has no default). e.g.

```
export WATERX_CONFIG_URL=https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json
```

## Defaults

- **Views** (read-only): no signing, no gas. Sender is the zero address.
- **Actions** (write): `client.simulate(tx)` only by default. Pass
  `WATERX_EXECUTE=1` to actually sign + send via the local Sui CLI keypair
  (`~/.sui/sui_config/`). Examples that need an existing account take
  `WATERX_ACCOUNT_ID=0x...`.

## View functions (`examples/views/`)

Frontend-facing read paths via `simulateTransaction` + BCS-decode:

| File | What it shows |
| --- | --- |
| `view-market-data.ts` | `getMarketData(ticker)` — market config + OI + funding |
| `view-global-config.ts` | `getGlobalConfigData()` — protocol-wide config |
| `view-pool-data.ts` | `getPoolData()` — WLP pool aggregate (TVL, supply) |
| `view-token-pool-data.ts` | `getTokenPoolData(tokenIndex)` — per-pool-token entry |
| `view-account-data.ts` | `getAccountData(accountId)` — perp data slot |
| `view-account-positions.ts` | `getAccountPositions({ ticker, ... })` |
| `view-account-orders.ts` | `getAccountOrders({ ticker, ... })` |
| `view-position.ts` | `getPosition({ positionId, ... })` with live PnL |
| `view-order.ts` | `getOrder({ orderId, orderTypeTag, ... })` |
| `view-position-exists.ts` | `positionExists({ positionId })` |
| `view-market-positions.ts` | paginated `getMarketPositions({ ticker, ... })` |
| `view-market-orders.ts` | paginated `getMarketOrders({ ticker, ... })` |
| `view-redeem-requests.ts` | paginated `getRedeemRequests()` |
| `view-referer-for.ts` | `getRefererFor(referee)` |
| `view-is-valid-referral-code.ts` | `isValidReferralCode(code)` syntax check |
| `view-referral-code-exists.ts` | `referralCodeExists(code)` on-chain check |

## User actions (`examples/actions/`)

Each builds the PTB, runs `client.simulate(tx)`, optionally executes:

### Account / wxa
- `action-create-account.ts` — `createAccount({ alias })`
- `action-set-alias.ts` — rename a wxa account
- `action-request-deposit.ts` — deposit USDC via `requestDeposit` + `consumeDepositDirect`
- `action-request-withdraw.ts` — withdraw from a wxa account
- `action-transfer-to-account.ts` — push a coin directly to a wxa account balance
- `action-consolidate-to-usd.ts` — fold USDC/USDSUI parked at an account address into USD via `requestDepositFromFunds` + `requestDepositFromReceivings`
- `action-add-delegate.ts` — grant a delegate with permission bitmask
- `action-remove-delegate.ts` — revoke a delegate
- `action-set-delegate-permission.ts` — per-protocol permission grant

### Trading
- `action-place-market-order.ts` — `triggerPrice: undefined`, parks at tick 0
- `action-place-limit-order.ts` — limit/stop at a real tick
- `action-place-order-with-tp-sl.ts` — main + reduce-only TP/SL pre-orders
- `action-cancel-order.ts` — cancel by id (supports wildcard tag)
- `action-update-order.ts` — change size / trigger price in place
- `action-cancel-pre-order.ts` — drop a TP/SL leg
- `action-add-pre-order.ts` — add a TP/SL leg
- `action-close-position.ts` — direct `close_position_request`
- `action-increase-position.ts` — add size + collateral
- `action-decrease-position.ts` — partial close
- `action-deposit-collateral.ts` — top-up collateral (de-lever)
- `action-withdraw-collateral.ts` — pull collateral (re-lever)

### WLP
- `action-mint-wlp.ts` — convert deposit asset → WLP
- `action-request-redeem-wlp.ts` — enqueue redeem
- `action-cancel-redeem-wlp.ts` — drop a pending redeem
- `action-settle-redeem-wlp.ts` — keeper-side settle

### Staking
- `action-stake.ts` / `action-unstake.ts` / `action-claim-reward.ts`

### Referral
- `action-set-referral-code.ts` — claim a code
- `action-use-referral-code.ts` — bind as referee

## End-to-end flows

Higher-level smokes that chain multiple steps live under `scripts/`:

- `scripts/smoke-keeper-match.ts` — market BUY + keeper match + direct close,
  with all `simulateTransaction` shapes (dry-run, view helpers, raw simulate,
  inter-step state checks).
- `scripts/smoke-happy-path.ts` — deposit → mint WLP → place/cancel.
- `scripts/smoke-real-account.ts` — wxa account creation + view sanity.

## Shared helpers

`examples/_shared.ts` exports:

- `buildClient(network?)` — async `PerpClient.create` wrapper (reads `WATERX_CONFIG_URL`)
- `loadActiveKeypair()` — read the local CLI's active ed25519 keypair
- `sim(client, tx, label, sender?)` — dry-run, returns `true`/`false`
- `execute(client, signer, tx, label)` — sign + dispatch
- `simThenMaybeExecute(client, tx, label, signer?)` — sim, then execute iff
  `WATERX_EXECUTE=1`
- `dump(label, value)` — pretty-print a BCS-parsed struct (BigInts stringified)
- `requireEnv(name)` — throw if missing
- `run(main)` — example entry point with consistent error output
