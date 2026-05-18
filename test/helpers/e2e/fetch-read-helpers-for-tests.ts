/**
 * Read helpers used **only** by e2e simulate / integration tests. Not re-exported from `@waterx/perp-sdk`.
 *
 * Includes `simulate` return-byte extraction for one-shot view calls and WLP-pool JSON reads that
 * are coupled to on-chain object layout (`min_deposit` not on `view::token_pool_data`).
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../src/client.ts";
import type { CollateralAsset } from "../../../src/constants.ts";
import { getMarketSummary } from "../../../src/fetch.ts";
import { getAccountOwner as getAccountOwnerCall } from "../../../src/generated/waterx_perp/user_account.ts";

function extractSimulateReturnBytes(
  result: unknown,
  commandIndex = 0,
  returnIndex = 0,
): Uint8Array {
  const r = result as any;
  if (r.$kind === "FailedTransaction") {
    const err = r.FailedTransaction?.status?.error;
    throw new Error(`Simulate transaction failed: ${err?.message ?? JSON.stringify(err)}`);
  }
  const cmdResults = r.commandResults;
  if (cmdResults?.[commandIndex]?.returnValues?.[returnIndex]?.bcs) {
    return new Uint8Array(cmdResults[commandIndex].returnValues[returnIndex].bcs);
  }
  const cmdResult = r.results?.[commandIndex];
  if (cmdResult?.returnValues?.[returnIndex]) {
    const [rawBytes] = cmdResult.returnValues[returnIndex];
    return new Uint8Array(rawBytes);
  }
  throw new Error(
    `No return value at command[${commandIndex}].returnValues[${returnIndex}]. ` +
      `Transaction may have failed.`,
  );
}

/**
 * Resolve the Sui `address` that owns a WaterX UserAccount id (`accountId` / registry key),
 * via on-chain `user_account::get_account_owner`.
 */
export async function getAccountOwnerByAccountId(
  client: WaterXClient,
  accountId: string,
): Promise<string> {
  const tx = new Transaction();
  tx.add(
    getAccountOwnerCall({
      package: client.config.packageId,
      arguments: {
        registry: client.config.accountRegistry,
        accountId: (t) => t.pure.id(accountId),
      },
    }),
  );
  const result = await client.simulate(tx);
  const bytes = extractSimulateReturnBytes(result);
  return bcs.Address.parse(bytes);
}

function normalizeCoinTypeForMatch(t: string): string {
  return t.replace(/^0x/i, "").toLowerCase();
}

function moveObjectJsonFields(json: Record<string, unknown>): Record<string, unknown> {
  const f = json.fields;
  if (f && typeof f === "object") return f as Record<string, unknown>;
  return json;
}

function typeNameStringFromPoolJson(tt: unknown): string | null {
  if (typeof tt === "string") return tt;
  if (!tt || typeof tt !== "object") return null;
  const o = tt as Record<string, unknown>;
  if (typeof o.name === "string") return o.name;
  const inner = o.fields;
  if (inner && typeof inner === "object") {
    const n = (inner as Record<string, unknown>).name;
    if (typeof n === "string") return n;
  }
  return typeof o.type === "string" ? (o.type as string) : null;
}

/** One `token_types[i]` / `token_pools[i]` row from the WLP pool object JSON (`getObject`). */
export type WlpCollateralPoolRow = {
  minDeposit: bigint;
  tokenDecimal: number;
};

function parsePositiveIntJson(raw: unknown, label: string): number {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) return raw;
  if (typeof raw === "string" && /^[0-9]+$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    if (Number.isSafeInteger(n) && n >= 0) return n;
  }
  throw new Error(`${label}: expected non-negative integer, got ${typeof raw}`);
}

function pow10(decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Token decimals must be a non-negative integer. Received: ${decimals}`);
  }
  return 10n ** BigInt(decimals);
}

/**
 * Reads `TokenPoolInfo` for a collateral from the on-chain `WlpPool` shared object (`getObject` +
 * `json`). `view::token_pool_data` does not expose `min_deposit` / decimals for mint sizing.
 */
export async function getWlpCollateralPoolRow(
  client: WaterXClient,
  collateral: CollateralAsset,
): Promise<WlpCollateralPoolRow> {
  const want = normalizeCoinTypeForMatch(client.getCollateral(collateral).type);
  const { object } = await client.grpcClient.getObject({
    objectId: client.config.wlpPool,
    include: { json: true },
  });
  const json = object?.json as Record<string, unknown> | null | undefined;
  if (!json || typeof json !== "object") {
    throw new Error("getWlpCollateralPoolRow: missing WLP pool object JSON");
  }
  const root = moveObjectJsonFields(json);
  const tokenTypes = (root.token_types ?? root.tokenTypes) as unknown[] | undefined;
  const tokenPools = (root.token_pools ?? root.tokenPools) as unknown[] | undefined;
  if (!Array.isArray(tokenTypes) || !Array.isArray(tokenPools)) {
    throw new Error("getWlpCollateralPoolRow: WLP pool JSON missing token_types / token_pools");
  }
  if (tokenTypes.length !== tokenPools.length) {
    throw new Error(
      `getWlpCollateralPoolRow: token_types length ${tokenTypes.length} != token_pools ${tokenPools.length}`,
    );
  }
  for (let i = 0; i < tokenTypes.length; i++) {
    const tn = typeNameStringFromPoolJson(tokenTypes[i]);
    if (!tn) continue;
    if (normalizeCoinTypeForMatch(tn) !== want) continue;
    const row = moveObjectJsonFields(
      (tokenPools[i] && typeof tokenPools[i] === "object"
        ? (tokenPools[i] as Record<string, unknown>)
        : {}) as Record<string, unknown>,
    );
    const rawMin = row.min_deposit ?? row.minDeposit;
    if (rawMin === undefined || rawMin === null) {
      throw new Error(`getWlpCollateralPoolRow: min_deposit missing for token_types[${i}]`);
    }
    let minDeposit: bigint;
    if (typeof rawMin === "bigint") minDeposit = rawMin;
    else if (typeof rawMin === "number" && Number.isFinite(rawMin))
      minDeposit = BigInt(Math.trunc(rawMin));
    else if (typeof rawMin === "string" && rawMin.trim() !== "" && /^-?\d+$/.test(rawMin.trim())) {
      minDeposit = BigInt(rawMin.trim());
    } else {
      throw new Error(`getWlpCollateralPoolRow: unexpected min_deposit type: ${typeof rawMin}`);
    }
    const td = row.token_decimal ?? row.tokenDecimal;
    const tokenDecimal = parsePositiveIntJson(td, "getWlpCollateralPoolRow.token_decimal");
    return { minDeposit, tokenDecimal };
  }
  throw new Error(`getWlpCollateralPoolRow: collateral ${collateral} not found in WLP pool`);
}

/** Reads `TokenPoolInfo.min_deposit` for a collateral from the on-chain `WlpPool` shared object JSON. */
export async function getWlpMinDepositForCollateral(
  client: WaterXClient,
  collateral: CollateralAsset,
): Promise<bigint> {
  const row = await getWlpCollateralPoolRow(client, collateral);
  return row.minDeposit;
}

/**
 * Minimum raw collateral (smallest token units) implied by on-chain `min_coll_value` (Float-scaled
 * USD, 1e9), given `collateralUsdPerTokenScaled` for 1.0 token in that same encoding. Ceiling div.
 */
export function minCollateralRawFromMinCollValueUsd(params: {
  minCollValueUsdScaled: bigint;
  collateralTokenDecimals: number;
  collateralUsdPerTokenScaled: bigint;
}): bigint {
  const { minCollValueUsdScaled, collateralTokenDecimals, collateralUsdPerTokenScaled } = params;
  if (minCollValueUsdScaled <= 0n) return 0n;
  if (collateralUsdPerTokenScaled <= 0n) return 0n;
  const mult = pow10(collateralTokenDecimals);
  const num = minCollValueUsdScaled * mult;
  const den = collateralUsdPerTokenScaled;
  return (num + den - 1n) / den;
}

/** `getMarketSummary` + WLP pool JSON → minimum raw collateral for `collateral`. */
export async function getMarketMinCollateralRawAmount(
  client: WaterXClient,
  params: {
    marketId: string;
    baseType: string;
    collateral: CollateralAsset;
    collateralUsdPerTokenScaled: bigint;
  },
): Promise<{
  minCollateralRaw: bigint;
  minCollValueUsdScaled: bigint;
  collateralDecimals: number;
}> {
  const [summary, poolRow] = await Promise.all([
    getMarketSummary(client, params.marketId, params.baseType),
    getWlpCollateralPoolRow(client, params.collateral),
  ]);
  const minCollateralRaw = minCollateralRawFromMinCollValueUsd({
    minCollValueUsdScaled: summary.minCollValue,
    collateralTokenDecimals: poolRow.tokenDecimal,
    collateralUsdPerTokenScaled: params.collateralUsdPerTokenScaled,
  });
  return {
    minCollateralRaw,
    minCollValueUsdScaled: summary.minCollValue,
    collateralDecimals: poolRow.tokenDecimal,
  };
}
