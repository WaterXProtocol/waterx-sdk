/**
 * Shared probe helpers for {@link appendConsolidateToUsd} and
 * {@link getSpendableCreditBalance} — one asset list, one gRPC read pattern,
 * so display totals match what the next async tx-builder would sweep.
 */
import type { PerpClient } from "../client.ts";
import { COLLATERAL_DECIMALS } from "../constants.ts";

/** CREDIT parked at a wxa account's Sui address (funds accumulator + owned coins). */
export interface AddressCreditBalance {
  /** `getBalance.addressBalance` — funds accumulator path. */
  fundsRaw: bigint;
  /** Sum of `listCoins` object balances — TTO'd / owned `Coin<CREDIT>` path. */
  coinsRaw: bigint;
}

/** One native-custody backing asset parked at a wxa account's Sui address. */
export interface ParkedBackingAssetBalance {
  assetType: string;
  decimals: number;
  /** `getBalance.addressBalance` — funds accumulator (`send_funds` path). */
  fundsRaw: bigint;
  /** Sum of `listCoins` object balances — TTO'd / owned `Coin<T>` path. */
  coinsRaw: bigint;
}

/** Rescale a u64 raw amount between token decimal precisions (truncates on downscale). */
export function rescaleRawAmount(
  raw: bigint,
  fromDecimals: number,
  toDecimals: number = COLLATERAL_DECIMALS,
): bigint {
  if (fromDecimals === toDecimals) return raw;
  if (fromDecimals < toDecimals) {
    return raw * 10n ** BigInt(toDecimals - fromDecimals);
  }
  return raw / 10n ** BigInt(fromDecimals - toDecimals);
}

/**
 * Probe every backing asset registered on `native_custody` for non-zero balances
 * parked at `accountId`'s Sui address. Matches the pre-tx scan inside
 * {@link appendConsolidateToUsd}.
 */
export async function probeParkedBackingAssets(
  client: PerpClient,
  accountId: string,
): Promise<ParkedBackingAssetBalance[]> {
  if (!client.config.packages.native_custody?.vault) return [];
  if (!client.config.packages.waterx_credit?.credit_type) return [];

  const out: ParkedBackingAssetBalance[] = [];
  for (const asset of client.getNativeAssets()) {
    const bal = (await client.getBalance({
      owner: accountId,
      coinType: asset.type,
    })) as { balance?: { addressBalance?: string } };
    const fundsRaw = BigInt(bal.balance?.addressBalance ?? "0");

    const coins = (await client.listCoins({
      owner: accountId,
      coinType: asset.type,
    })) as { objects?: { balance?: string }[] };
    let coinsRaw = 0n;
    for (const coin of coins.objects ?? []) {
      coinsRaw += BigInt(coin.balance ?? "0");
    }

    if (fundsRaw > 0n || coinsRaw > 0n) {
      out.push({
        assetType: asset.type,
        decimals: asset.decimal,
        fundsRaw,
        coinsRaw,
      });
    }
  }
  return out;
}

/**
 * Probe non-zero CREDIT parked at `accountId`'s Sui address. Matches the
 * address-CREDIT legs inside {@link appendConsolidateAddressCredit}.
 */
export async function probeAddressCreditBalance(
  client: PerpClient,
  accountId: string,
): Promise<AddressCreditBalance> {
  if (!client.config.packages.waterx_credit?.credit_type) {
    return { fundsRaw: 0n, coinsRaw: 0n };
  }

  const creditType = client.creditType();
  let fundsRaw = 0n;
  let coinsRaw = 0n;

  try {
    const bal = (await client.getBalance({
      owner: accountId,
      coinType: creditType,
    })) as { balance?: { addressBalance?: string } };
    fundsRaw = BigInt(bal.balance?.addressBalance ?? "0");
  } catch {
    // ignore — treat as zero parked funds
  }

  try {
    const coins = (await client.listCoins({
      owner: accountId,
      coinType: creditType,
    })) as { objects?: { balance?: string }[] };
    for (const coin of coins.objects ?? []) {
      coinsRaw += BigInt(coin.balance ?? "0");
    }
  } catch {
    // ignore — treat as zero owned coins
  }

  return { fundsRaw, coinsRaw };
}

/** Sum parked backing assets into CREDIT base units at the 1:1 PSM peg. */
export function sumParkedBackingAsCreditRaw(
  parked: readonly ParkedBackingAssetBalance[],
  creditDecimals: number = COLLATERAL_DECIMALS,
): bigint {
  let sum = 0n;
  for (const row of parked) {
    sum += rescaleRawAmount(row.fundsRaw + row.coinsRaw, row.decimals, creditDecimals);
  }
  return sum;
}
