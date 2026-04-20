# Admin Setup Scripts

Scripts for deploying and configuring the WaterX Perp protocol. All require `AdminCap` ownership.

## Prerequisites

```bash
export ADMIN_SECRET_KEY=<base64-encoded-ed25519-secret-key>
```

Run without the env var to see a dry-run preview.

## Deployment Order

After publishing the Move packages, run these scripts in order:

```bash
# 1. Add USDC (and other tokens) to the WLP pool
npx tsx scripts/add-token-pool.ts

# 2. Create all trading markets (BTC, ETH, SOL, SUI, DEEP, WAL)
npx tsx scripts/create-markets.ts
# → Copy the created Market object IDs into TESTNET_MARKETS in constants.ts

# 3. Set up Pyth + Supra oracle feeds (identifiers, pair IDs, aggregator weights)
ADMIN_SECRET_KEY=<base64> npx tsx scripts/setup-oracle.ts
# Or Supra-only via CLI (no secret key needed):
./scripts/setup-supra-oracle.sh

# 4. Add keeper addresses for order matching / liquidation / funding
npx tsx scripts/setup-keepers.ts

# 5. (Optional) Add USDSUI token pool + rebalance weights
./scripts/add-usdsui-pool.sh
```

## Scripts

| Script                  | Description                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `create-markets.ts`     | Create `Market<BASE_TOKEN, LP_TOKEN>` for all assets                                    |
| `add-token-pool.ts`     | Add collateral token (USDC) to WLP pool                                                 |
| `setup-oracle.ts`       | Configure Pyth identifiers + Supra pair IDs + SupraRule aggregator weights (all-in-one) |
| `setup-supra-oracle.sh` | Supra-only setup via `sui client call` (no secret key, uses active CLI address)         |
| `setup-keepers.ts`      | Authorize keeper addresses in GlobalConfig                                              |
| `market-params.ts`      | Market creation parameters (imported by create-markets)                                 |
| `add-usdsui-pool.sh`    | Add USDSUI to WLP pool + rebalance USDC weight to 50/50                                 |

## Adding a New Market

1. Add the asset to `BaseAsset` type in `src/constants.ts`
2. Add creation params to `scripts/market-params.ts`
3. Add base token type to `BASE_TYPES` in `scripts/create-markets.ts`
4. Add token feed to `TOKEN_FEEDS` in `scripts/setup-oracle.ts`
5. Run `create-markets.ts`, `setup-oracle.ts`, and `setup-supra-oracle.sh`
6. Add the new market entry to `TESTNET_MARKETS` in `src/constants.ts`
7. Add Supra pair ID to `SUPRA_PAIR_IDS` in `src/constants.ts` (if available)
