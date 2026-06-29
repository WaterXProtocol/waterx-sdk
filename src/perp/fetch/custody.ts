/**
 * Native-custody PSM reads (`custody_vault`).
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  burnFeeRate as burnFeeRateCall,
  creditSupply as creditSupplyCall,
  hasAsset as hasAssetCall,
  mintFeeRate as mintFeeRateCall,
} from "../../generated/native_custody/custody_vault.ts";
import type { PerpClient } from "../client.ts";
import { DRY_RUN_SENDER } from "../constants.ts";
import { simulateAndExtract } from "./simulate.ts";

function requireCustody(client: PerpClient): { pkg: string; vault: string; creditType: string } {
  const nc = client.config.packages.native_custody;
  if (!nc?.vault) {
    throw new Error("native_custody not configured — set config.packages.native_custody.vault");
  }
  return { pkg: nc.published_at, vault: nc.vault, creditType: client.creditType() };
}

/** Vault-wide native-custody state. */
export interface CustodyVaultData {
  /** Total CREDIT minted by the custody vault (`credit_supply`). */
  creditSupply: bigint;
}

/** Reads vault-wide native-custody state via `custody_vault::credit_supply`. */
export async function getCustodyVaultData(client: PerpClient): Promise<CustodyVaultData> {
  const { pkg, vault, creditType } = requireCustody(client);
  const tx = new Transaction();
  creditSupplyCall({
    package: pkg,
    arguments: { vault: tx.object(vault) },
    typeArguments: [creditType],
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return { creditSupply: BigInt(bcs.u64().parse(bytes)) };
}

/** Per-asset native-custody state for one backing asset. */
export interface CustodyAssetData {
  /** Whether the asset is registered as a `SingleVault` on the custody vault. */
  registered: boolean;
  /** 1e9-scaled default mint fee rate (`0n` when the asset is not registered). */
  mintFeeRate: bigint;
  /** 1e9-scaled default burn fee rate (`0n` when the asset is not registered). */
  burnFeeRate: bigint;
}

/**
 * Reads per-asset native-custody state for backing asset `assetType`.
 *
 * Fee rates are the vault's default config — queried with the zero address as
 * caller, so no partner discount is applied — as 1e9-scaled `Float` values.
 * When the asset is not registered, returns `registered: false` with `0n` rates.
 *
 * Note: the `SingleVault` balance / decimal / backing / min-burn / deprecated
 * fields are not exposed here — the contract's getters for those return a
 * `&SingleVault<T>` reference, which a PTB simulate cannot read.
 */
export async function getCustodyAssetData(
  client: PerpClient,
  assetType: string,
): Promise<CustodyAssetData> {
  const { pkg, vault, creditType } = requireCustody(client);
  const typeArguments: [string, string] = [assetType, creditType];

  const hasTx = new Transaction();
  hasAssetCall({ package: pkg, arguments: { vault: hasTx.object(vault) }, typeArguments })(hasTx);
  const registered = bcs.bool().parse(await simulateAndExtract(client, hasTx));
  if (!registered) return { registered: false, mintFeeRate: 0n, burnFeeRate: 0n };

  const mintTx = new Transaction();
  mintFeeRateCall({
    package: pkg,
    arguments: { vault: mintTx.object(vault), caller: DRY_RUN_SENDER },
    typeArguments,
  })(mintTx);
  const mintFeeRate = BigInt(bcs.u128().parse(await simulateAndExtract(client, mintTx)));

  const burnTx = new Transaction();
  burnFeeRateCall({
    package: pkg,
    arguments: { vault: burnTx.object(vault), caller: DRY_RUN_SENDER },
    typeArguments,
  })(burnTx);
  const burnFeeRate = BigInt(bcs.u128().parse(await simulateAndExtract(client, burnTx)));

  return { registered: true, mintFeeRate, burnFeeRate };
}
