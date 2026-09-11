/**
 * Account-layer infra config — the ONE piece of deployment-adjacent data the
 * funding base (`account/funding/*`) needs that the canonical `waterx-config`
 * document does not carry: the external Wormhole infra for the credit bridge,
 * fixed per network. Every on-chain object id the account base reads comes
 * from the parsed document itself (`config.objects.account` / `.credit` /
 * `.custody` / `.bridge` / `.withdrawal_queue` / `.referral`, see
 * `src/config.ts`). This is the **base**: nothing here imports `perp/` or
 * `prediction/`.
 */

import type { Network } from "../constants.ts";

/**
 * Wormhole infra for the cross-chain credit bridge. The shared Sui Wormhole
 * `State` object is NOT here — it is a deployment value, read off
 * `config.objects.bridge.wormhole_state`.
 */
export interface WormholeInfraConfig {
  /** Wormhole core package id on Sui. */
  core_package: string;
  /** Sui's Wormhole chain id (21 on both mainnet and testnet). */
  sui_chain_id: number;
  /** Wormholescan REST base for VAA lookups (no trailing slash). */
  wormholescan_api: string;
}

/** Wormhole infra by network — fixed, not deployment-overridable. */
export const WORMHOLE_DEFAULTS: Record<Network, WormholeInfraConfig> = {
  MAINNET: {
    core_package: "0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a",
    sui_chain_id: 21,
    wormholescan_api: "https://api.wormholescan.io/api/v1",
  },
  TESTNET: {
    core_package: "0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94",
    sui_chain_id: 21,
    wormholescan_api: "https://api.testnet.wormholescan.io/api/v1",
  },
};
