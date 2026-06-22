/**
 * Read helpers for e2e simulate / integration tests only (not exported from SDK).
 */

import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../../src/client.ts";
import { getAccountsByOwner } from "../../../../src/fetch.ts";
import {
  accountBalance,
  accountOwner,
  isDepositPolicyRegistered,
  isProtocolAssetAllowed,
} from "../../../../src/generated/waterx_account/account.ts";
import {
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../integration/integration-trader-key.ts";
import { e2eCanonicalWxaOwner } from "./canonical-testnet-account.ts";
import { resolveE2eNetwork } from "./e2e-client.ts";

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

/** Owners to probe via `account_ids` before legacy `account_owner(&Account)` simulate. */
function wxaOwnerHints(): string[] {
  const hints: string[] = [];
  const push = (v?: string) => {
    const t = v?.trim();
    if (t) hints.push(t);
  };
  push(process.env.WATERX_E2E_WXA_OWNER);
  push(e2eCanonicalWxaOwner(resolveE2eNetwork()));
  push(process.env.WATERX_E2E_WALLET_USDC_OWNER);
  push(process.env.WATERX_E2E_WLP_REDEEM_OWNER);
  if (isIntegrationTraderConfigured()) {
    try {
      push(loadIntegrationTraderKeypair().getPublicKey().toSuiAddress());
    } catch {
      /* misconfigured key — fall through */
    }
  }
  const seen = new Set<string>();
  return hints.filter((h) => {
    const k = normAddr(h);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractSimulateReturnBytesSync(
  result: unknown,
  commandIndex = 0,
  returnIndex = 0,
): Uint8Array {
  const r = result as Record<string, unknown>;
  if (r.$kind === "FailedTransaction") {
    const err = (r.FailedTransaction as Record<string, unknown> | undefined)?.status as
      | { error?: { message?: string } | string }
      | undefined;
    const msg =
      typeof err?.error === "string"
        ? err.error
        : typeof err?.error === "object" && err?.error && "message" in err.error
          ? String((err.error as { message?: unknown }).message)
          : JSON.stringify(err);
    throw new Error(`Simulate transaction failed: ${msg}`);
  }
  const cmdResults = r.commandResults as Array<{ returnValues?: unknown[] }> | undefined;
  const cmd = cmdResults?.[commandIndex];
  const ret = cmd?.returnValues?.[returnIndex] as
    | { bcs?: unknown; value?: { bcs?: unknown } }
    | undefined;
  if (!ret) {
    throw new Error(`No return value at command[${commandIndex}].returnValues[${returnIndex}]`);
  }
  const b = ret.bcs ?? ret.value?.bcs;
  if (b instanceof Uint8Array) return b;
  if (typeof b === "string") return fromBase64(b);
  if (b && typeof b === "object" && !Array.isArray(b)) {
    return new Uint8Array(Object.values(b as Record<string, number>));
  }
  throw new Error("Unsupported simulate return shape");
}

/**
 * Resolve wxa account owner for registry `accountId` (`0x2::object::ID`).
 *
 * Accounts live inside `AccountRegistry`, not as top-level chain objects — so
 * `account_owner(&Account)` via `tx.object(accountId)` fails. Prefer registry
 * `account_ids(owner)` membership checks using integration / e2e owner hints.
 */
export async function getAccountOwnerByAccountId(
  client: WaterXClient,
  accountId: string,
): Promise<string> {
  const want = normAddr(accountId);

  for (const owner of wxaOwnerHints()) {
    try {
      const ids = await getAccountsByOwner(client, owner);
      if (ids.some((id) => normAddr(id) === want)) return owner;
    } catch {
      /* try next owner hint */
    }
  }

  const pkg = client.config.packages.waterx_account.published_at;
  const tx = new Transaction();
  accountOwner({
    package: pkg,
    arguments: { account: tx.object(accountId) },
  })(tx);
  try {
    const result = await client.simulate(tx);
    const bytes = extractSimulateReturnBytesSync(result);
    return bcs.Address.parse(bytes);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Unable to resolve owner for wxa account ${accountId} (registry ID, not a standalone object). ` +
        `Set WATERX_E2E_WXA_OWNER or run with WATERX_INTEGRATION_PRIVATE_KEY so owner hints can be probed. ${detail}`,
      { cause: e },
    );
  }
}

function parseSimulateBoolReturn(result: unknown, commandIndex = 0): boolean {
  const bytes = extractSimulateReturnBytesSync(result, commandIndex);
  return bcs.bool().parse(bytes);
}

/** Registry-level: at least one deposit policy registered for `coinType`. */
export async function isRegistryDepositPolicyRegistered(
  client: WaterXClient,
  coinType: string,
): Promise<boolean> {
  const pkg = client.config.packages.waterx_account.published_at;
  const reg = client.config.packages.waterx_account.account_registry;
  const tx = new Transaction();
  isDepositPolicyRegistered({
    package: pkg,
    arguments: { registry: tx.object(reg) },
    typeArguments: [coinType],
  })(tx);
  const result = await client.simulate(tx);
  return parseSimulateBoolReturn(result);
}

/** `WaterXPerp` may `take<coinType>` from wxa stored balance (mint_wlp / trading gate). */
export async function isWaterXPerpProtocolAssetAllowed(
  client: WaterXClient,
  coinType: string,
): Promise<boolean> {
  const perpWitness = `${client.config.packages.waterx_perp.original_id}::account_data::WaterXPerp`;
  const pkg = client.config.packages.waterx_account.published_at;
  const reg = client.config.packages.waterx_account.account_registry;
  const tx = new Transaction();
  isProtocolAssetAllowed({
    package: pkg,
    arguments: { registry: tx.object(reg) },
    typeArguments: [perpWitness, coinType],
  })(tx);
  const result = await client.simulate(tx);
  return parseSimulateBoolReturn(result);
}

/** Stored balance for `coinType` on wxa account `accountId`. */
export async function getWxaAccountBalance(
  client: WaterXClient,
  accountId: string,
  coinType: string,
): Promise<bigint> {
  const pkg = client.config.packages.waterx_account.published_at;
  const reg = client.config.packages.waterx_account.account_registry;
  const tx = new Transaction();
  accountBalance({
    package: pkg,
    arguments: {
      registry: tx.object(reg),
      accountId,
    },
    typeArguments: [coinType],
  })(tx);
  const result = await client.simulate(tx);
  const bytes = extractSimulateReturnBytesSync(result);
  const rawBal = bcs.u64().parse(bytes);
  return typeof rawBal === "bigint" ? rawBal : BigInt(rawBal as string | number);
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

export async function getWlpCollateralPoolRow(
  client: WaterXClient,
  poolTokenTicker: string,
): Promise<WlpCollateralPoolRow> {
  const want = normalizeCoinTypeForMatch(client.getPoolTokenType(poolTokenTicker));
  const poolId = client.config.packages.wlp?.wlp_pool;
  if (!poolId) throw new Error("getWlpCollateralPoolRow: wlp_pool missing from config");
  const { object } = await client.grpcClient.getObject({
    objectId: poolId,
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
  throw new Error(`getWlpCollateralPoolRow: ticker ${poolTokenTicker} not found in WLP pool`);
}

export async function getWlpMinDepositForTicker(
  client: WaterXClient,
  poolTokenTicker: string,
): Promise<bigint> {
  const row = await getWlpCollateralPoolRow(client, poolTokenTicker);
  return row.minDeposit;
}

/** @deprecated Use {@link getWlpMinDepositForTicker}. */
export async function getWlpMinDepositForCollateral(
  client: WaterXClient,
  collateral: string,
): Promise<bigint> {
  const ticker =
    collateral === "USDC" || collateral.toUpperCase() === "USDC" ? "USDCUSD" : `${collateral}USD`;
  return getWlpMinDepositForTicker(client, ticker);
}

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

export async function getMarketMinCollateralRawAmount(
  client: WaterXClient,
  params: {
    ticker: string;
    poolTokenTicker: string;
    collateralUsdPerTokenScaled: bigint;
  },
): Promise<{
  minCollateralRaw: bigint;
  minCollValueUsdScaled: bigint;
  collateralDecimals: number;
}> {
  const { getMarketData } = await import("../../../../src/fetch.ts");
  const [market, poolRow] = await Promise.all([
    getMarketData(client, { ticker: params.ticker }),
    getWlpCollateralPoolRow(client, params.poolTokenTicker),
  ]);
  const minCollateralRaw = minCollateralRawFromMinCollValueUsd({
    minCollValueUsdScaled: BigInt(market.min_coll_value),
    collateralTokenDecimals: poolRow.tokenDecimal,
    collateralUsdPerTokenScaled: params.collateralUsdPerTokenScaled,
  });
  return {
    minCollateralRaw,
    minCollValueUsdScaled: BigInt(market.min_coll_value),
    collateralDecimals: poolRow.tokenDecimal,
  };
}
