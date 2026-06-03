/**
 * Read-only snapshot of the WLP pool state (simulate via waterx_perp_view).
 *
 * Run:
 *   pnpm exec tsx scripts/wlp-pool-status.ts
 */
import { getPoolData, getTokenPoolData } from "../src/fetch.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";
import { makeSmokeClient } from "./make-smoke-client.ts";

const FLOAT_SCALE = 1_000_000_000n; // 1e9 Float scale (src/constants.ts)

function fmtUsd(v: bigint): string {
  const whole = v / FLOAT_SCALE;
  const frac = ((v % FLOAT_SCALE) * 10000n) / FLOAT_SCALE; // 4 dp
  return `${whole}.${frac.toString().padStart(4, "0")} USD (raw ${v})`;
}

function shortType(t: string): string {
  const parts = t.split("::");
  return parts.length >= 3 ? `…${parts.slice(-2).join("::")}` : t;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const client = await makeSmokeClient();

  const pool = await getPoolData(client);
  console.log("=== WLP Pool ===");
  console.log(`wlp_pool obj:    ${client.config.packages.wlp.wlp_pool}`);
  console.log(`wlp_aum obj:     ${client.config.packages.wlp.wlp_aum}`);
  console.log(`lp_token:        ${shortType(pool.lp_token.name)}`);
  console.log(`is_active:       ${pool.is_active}`);
  console.log(`lp_decimal:      ${pool.lp_decimal}`);
  console.log(`total_lp_supply: ${pool.total_lp_supply} (raw)`);
  console.log(`tvl_usd:         ${fmtUsd(BigInt(pool.tvl_usd))}`);
  console.log(`token_count:     ${pool.token_count}`);

  const n = Number(pool.token_count);
  for (let i = 0; i < n; i++) {
    const t = await getTokenPoolData(client, { tokenIndex: i });
    console.log(`\n--- token[${i}] ${shortType(t.token_type.name)} ---`);
    console.log(`  token_decimal:        ${t.token_decimal}`);
    console.log(`  liquidity_amount:     ${t.liquidity_amount} (raw)`);
    console.log(`  reserved_amount:      ${t.reserved_amount} (raw)`);
    console.log(`  value_usd:            ${fmtUsd(BigInt(t.value_usd))}`);
    console.log(`  target_weight_bps:    ${t.target_weight_bps}`);
    console.log(`  mint_fee_bps:         ${t.mint_fee_bps}`);
    console.log(`  burn_fee_bps:         ${t.burn_fee_bps}`);
    console.log(`  last_price_refresh:   ${t.last_price_refresh_timestamp}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
