import type { WaterXClient } from "../../../src/client.ts";

/** Prefix for {@link deriveTradingMatrixCases} buildTx throws → {@link lifecycle-single-ptb.test.ts} skips the matrix. */
export const MATRIX_SKIP_PREFIX = "MATRIX_SKIP:";

export type MarketTradingSizeConstraints = {
  minSize: bigint;
  lotSize: bigint;
};

function bigIntFromJsonField(raw: unknown, label: string): bigint {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return BigInt(Math.trunc(raw));
  if (typeof raw === "string" && raw.trim() !== "" && /^-?\d+$/.test(raw.trim())) {
    return BigInt(raw.trim());
  }
  throw new Error(`${label}: unexpected type ${typeof raw}`);
}

/**
 * Read trading size floors from `Market.config` via gRPC object JSON (same nesting as
 * {@link getMarketCooldownMs}).
 *
 * - **Legacy** layouts expose `min_size` / `lot_size` (raw base-token units).
 * - **v2** on-chain markets omit those keys (`min_coll_value` / Float sizing instead). The
 *   smallest valid step for `PositionData.size` (u128) in practice is **1**; e2e suites that
 *   do ~50% partial closes should still set `minPositionSize` in discovery options so the
 *   remainder can satisfy chain dust rules.
 */
export async function getMarketTradingSizeConstraints(
  client: WaterXClient,
  marketObjectId: string,
): Promise<MarketTradingSizeConstraints> {
  const { object } = await client.grpcClient.getObject({
    objectId: marketObjectId,
    include: { json: true },
  });
  const json = object?.json as Record<string, unknown> | null | undefined;
  if (!json || typeof json !== "object") {
    throw new Error(`getMarketTradingSizeConstraints: missing JSON for ${marketObjectId}`);
  }
  const root = (json.fields as Record<string, unknown> | undefined) ?? json;
  const config = root.config as Record<string, unknown> | undefined;
  if (!config || typeof config !== "object") {
    throw new Error(`getMarketTradingSizeConstraints: no config on ${marketObjectId}`);
  }
  const cfgBody = (config.fields as Record<string, unknown> | undefined) ?? config;

  const minRaw = cfgBody.min_size;
  const lotRaw = cfgBody.lot_size;
  if (minRaw != null && lotRaw != null) {
    return {
      minSize: bigIntFromJsonField(minRaw, "min_size"),
      lotSize: bigIntFromJsonField(lotRaw, "lot_size"),
    };
  }

  if (cfgBody.min_coll_value != null) {
    return { minSize: 1n, lotSize: 1n };
  }

  throw new Error(
    `getMarketTradingSizeConstraints: cannot derive size constraints for ${marketObjectId} ` +
      `(no min_size/lot_size and no min_coll_value in Market.config JSON)`,
  );
}

function alignDown(n: bigint, lot: bigint): bigint {
  if (lot <= 0n) return n;
  return n - (n % lot);
}

function alignUp(n: bigint, lot: bigint): bigint {
  if (lot <= 0n) return n;
  const r = n % lot;
  if (r === 0n) return n;
  return n + (lot - r);
}

/**
 * Choose a partial decrease amount that satisfies `trading::execute_decrease_position`:
 * lot-aligned `reduce >= min_size`, `reduce <= positionSize`, and
 * `positionSize - reduce` is either 0 or `>= min_size`.
 */
export function computeValidPartialDecreaseSize(
  positionSize: bigint,
  minSize: bigint,
  lotSize: bigint,
): bigint | null {
  if (positionSize <= 0n) return null;
  if (minSize <= 0n || lotSize <= 0n) return null;
  if (positionSize <= minSize) return null;

  const maxReduce = positionSize - minSize;

  let reduce = alignDown(positionSize / 2n, lotSize);
  if (reduce < minSize) {
    reduce = alignUp(minSize, lotSize);
  }
  if (reduce > maxReduce) {
    reduce = alignDown(maxReduce, lotSize);
  }
  if (reduce < minSize || reduce <= 0n) return null;

  const newSize = positionSize - reduce;
  if (newSize > 0n && newSize < minSize) return null;
  return reduce;
}

/**
 * Adjust an explicit `size` for `open` / `increase` paths to satisfy the same lot floor + min_size
 * check the chain applies (`size -= size % lot; assert size >= min_size`).
 */
export function alignExplicitTradingSize(
  size: bigint,
  minSize: bigint,
  lotSize: bigint,
): bigint | null {
  if (size <= 0n) return null;
  if (minSize <= 0n || lotSize <= 0n) return size;

  let s = alignDown(size, lotSize);
  if (s <= 0n) {
    s = alignUp(minSize, lotSize);
  } else if (s < minSize) {
    s = alignUp(minSize, lotSize);
  }
  if (s < minSize) return null;
  return s;
}
