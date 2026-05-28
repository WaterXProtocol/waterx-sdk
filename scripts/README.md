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
| 3 | `mint-usd-from-mock-usdc` | step 2, MOCK_USDC in wallet | USD CREDIT in wxa | yes |
| 4 | `deposit-to-wlp` | step 3, USD in wxa | WLP in wxa | yes |
| 5 | `smoke-staking` | step 4, ≥1M WLP in wxa | stake then unstake (no net state) | yes |
| 6 | `smoke-happy-path` | step 2 | deposit + mint + place + cancel (no resting orders) | yes |
| 7 | `smoke-keeper-match` | steps 2–4, USD in wxa | market BUY → keeper match → close (no resting position) | yes |
| 8 | `smoke-custody` | MOCK_USDC in wallet | CREDIT round-trip (no net state) | yes |

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
