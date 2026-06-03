# Smoke Chain Order

The smoke scripts under `scripts/` are runnable standalone, but each step
expects state produced by the previous one. Running them out of order
silently fails or, worse, partially succeeds in a confusing way.

`pnpm smoke:chain` (or `tsx scripts/run-smoke-chain.ts`) runs the chain
in the right order and pipes the wxa account id from `create-wxa-account`
into every downstream step via `WATERX_SMOKE_ACCOUNT_ID`. Fail-fast: a
non-zero exit aborts the chain and prints a summary.

## Chain order

| # | Step | Requires | Produces | Idempotent? |
|---|------|----------|----------|-------------|
| 0 | `smoke-remote` | network reachable | — | yes |
| 1 | `smoke` | none | — (PTB simulate sanity) | yes |
| 2 | `create-wxa-account` | local sui CLI keypair | `WATERX_SMOKE_ACCOUNT_ID` (printed) | no — creates a new account each run |
| 3 | `mint-usd-from-collateral` | step 2, USDC + USDSUI in wallet | USD CREDIT in wxa (one mint per vault asset) | yes |
| 4 | `smoke-credit-withdraw` | step 3, USD in wxa | requestCreditWithdraw + enqueue (sim unless `WATERX_CREDIT_WITHDRAW_EXECUTE=1`) | yes |
| 5 | `deposit-to-wlp` | step 3, USD in wxa | WLP in wxa | yes |
| 6 | `smoke-staking` | step 5, ≥1M WLP in wxa | stake then unstake (no net state) | yes |
| 7 | `mint-and-stake-wlp` | step 3, ≥1 USD CREDIT in wxa | atomic mint WLP + stake in one PTB | yes |
| 8 | `smoke-happy-path` | step 2 | deposit + mint + place + cancel (no resting orders) | yes |
| 9 | `smoke-keeper-match` | steps 2–5, USD in wxa | market BUY → keeper match → close (no resting position) | yes |
| 10 | `smoke-custody` | USDC in wallet | CREDIT round-trip (no net state) | yes |

Each step's preflight throws an actionable error naming the prior step
that would produce the missing state, so a forgotten dependency is
visible at step 1 instead of step 5.

## Opt-in steps (not in default chain)

| Step | Flag | Why opt-in |
|------|------|------------|
| `smoke-staking-claim` | `--include-claim` | testnet's WLP staking pool has no rewarders configured; the script aborts in preflight unless that changes. |

## Running

```bash
# default chain, executes on-chain
pnpm smoke:chain

# every step in simulate-only mode (no on-chain writes)
# Uses the committed default fixture account (DEFAULT_SMOKE_ACCOUNT_ID in
# run-smoke-chain.ts) when WATERX_SMOKE_ACCOUNT_ID is unset — owned by the
# smoke signer (sui alias `waterx-sdk-smoke-ci`) and pre-funded with standing
# USD CREDIT + WLP, so the dry chain passes with no per-machine setup. This is
# what the `smoke-chain-dry` CI job runs. Transient Hermes/network errors are
# retried (not failed).
pnpm smoke:chain:dry

# with optional steps
pnpm exec tsx scripts/run-smoke-chain.ts --include-claim

# reuse an existing account (skips creating a new one)
WATERX_SMOKE_ACCOUNT_ID=0x… pnpm smoke:chain

# run any single step manually (each enforces its own preflight)
WATERX_SMOKE_ACCOUNT_ID=0x… EXECUTE=1 pnpm exec tsx scripts/deposit-to-wlp.ts
```

## Why the orchestrator captures account-id from stdout

`create-wxa-account.ts` prints
`WATERX_SMOKE_ACCOUNT_ID=0x<id>` on success. The orchestrator regex-matches
that line and injects it into every downstream child process's env. If
the env var is already set when the orchestrator starts, the capture is
ignored and the existing id is reused — so re-running the chain on an
account you already created costs you no extra account-creation gas.
