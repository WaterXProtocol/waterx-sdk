/** Synthetic, distinct registry/type pairs for all Voucher settlement units; never live deployment data. */
import type { WaterXConfig } from "../../../src/config.ts";
import { MOCK_TESTNET_CONFIG } from "../../helpers/fixtures/mock-testnet-config.ts";

export const VOUCHER_ASSETS = ["USD", "SUI", "DEEP", "WAL"] as const;
export type VoucherAsset = (typeof VOUCHER_ASSETS)[number];

export function voucherConfig(): WaterXConfig {
  const config = structuredClone(MOCK_TESTNET_CONFIG);
  for (const [index, asset] of VOUCHER_ASSETS.entries()) {
    const address = `0x${String(index + 1).repeat(64)}`;
    config.objects.prediction.market_registries[asset] = address;
    config.objects.prediction.settlement_coin_types[asset] = `${address}::credit::${asset}`;
  }
  return config;
}
