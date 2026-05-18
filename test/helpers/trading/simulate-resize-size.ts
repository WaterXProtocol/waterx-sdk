/**
 * Test helpers: dry-run `trading::resolve_size` via {@link addPriceFeeds} + {@link buildResolveSize}.
 * Enables Hermes + `pyth_rule::feed` in the same PTB (gas-paid Pyth updates) so simulate matches
 * `scripts/print-oracle-aggregates.ts` and avoids stale `PriceInfoObject` → `err_total_weight_not_enough` (204).
 */
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import {
  addPriceFeeds,
  buildResolveOrderSize,
  buildResolveSize,
  PythCache,
  type BaseAsset,
  type CollateralAsset,
  type WaterXClient,
} from "@waterx/perp-sdk";

import { DUMMY_SENDER } from "../e2e/testnet.ts";

export type ResizeSizingProbeParams = {
  collateralAmount: bigint | number;
  leverage: number;
  collateral?: CollateralAsset;
};

export type BuildResizeSizingProbeOptions = {
  sender?: string;
  gasBudget?: number;
  pythCache?: PythCache;
};

function extractReturnBytes(result: unknown, commandIndex: number, returnIndex = 0): Uint8Array {
  const r = result as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } | string } };
    commandResults?: Array<{ returnValues?: Array<{ bcs?: Uint8Array | number[] }> }>;
    results?: Array<{ returnValues?: unknown[] }>;
  };
  if (r.$kind === "FailedTransaction") {
    const err = r.FailedTransaction?.status?.error;
    const msg =
      typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : JSON.stringify(err);
    throw new Error(`Simulate transaction failed: ${msg}`);
  }
  const cmdResults = r.commandResults;
  if (cmdResults?.[commandIndex]?.returnValues?.[returnIndex]?.bcs) {
    return new Uint8Array(cmdResults[commandIndex]!.returnValues![returnIndex]!.bcs!);
  }
  const cmdResult = r.results?.[commandIndex];
  if (cmdResult?.returnValues?.[returnIndex]) {
    const [rawBytes] = cmdResult.returnValues[returnIndex] as [Uint8Array | number[]];
    return new Uint8Array(rawBytes);
  }
  throw new Error(
    `No return value at command[${commandIndex}].returnValues[${returnIndex}]. Transaction may have failed.`,
  );
}

/**
 * Builds one PTB that, for each base in order: runs {@link addPriceFeeds} (Hermes + oracle feeds),
 * then calls `trading::resolve_size`. Records the command index of each `resolve_size`
 * for {@link parseResizeSizingProbeResult}.
 */
export async function buildResizeSizingProbeTransaction(
  client: WaterXClient,
  bases: readonly BaseAsset[],
  params: ResizeSizingProbeParams,
  opts?: BuildResizeSizingProbeOptions,
): Promise<{ tx: Transaction; resizeCommandIndexByBase: Record<BaseAsset, number> }> {
  if (bases.length === 0) {
    throw new Error("buildResizeSizingProbeTransaction: bases must be non-empty");
  }

  const tx = new Transaction();
  tx.setSender(opts?.sender ?? DUMMY_SENDER);
  tx.setGasBudget(opts?.gasBudget ?? 1_200_000_000);

  const cache = opts?.pythCache ?? new PythCache();
  const resizeCommandIndexByBase = {} as Record<BaseAsset, number>;

  for (const base of bases) {
    const { basePriceResult, collateralPriceResult } = await addPriceFeeds(
      client,
      tx,
      base,
      params.collateral ?? "USDC",
      cache,
      /* updatePythPrice: */ true,
      /* selfPayPyth: */ true,
    );
    resizeCommandIndexByBase[base] = tx.getData().commands.length;
    buildResolveSize(client, tx, {
      base,
      collateral: params.collateral,
      priceResult: basePriceResult,
      collateralPriceResult,
      collateralAmount: params.collateralAmount,
      leverage: params.leverage,
    });
  }

  return { tx, resizeCommandIndexByBase };
}

/** Parses `u128` return values from each `resolve_size` command (see {@link buildResizeSizingProbeTransaction}). */
export function parseResizeSizingProbeResult(
  result: unknown,
  bases: readonly BaseAsset[],
  resizeCommandIndexByBase: Record<BaseAsset, number>,
): Record<BaseAsset, bigint> {
  const out = {} as Record<BaseAsset, bigint>;
  for (const base of bases) {
    const idx = resizeCommandIndexByBase[base];
    if (idx === undefined) {
      throw new Error(`parseResizeSizingProbeResult: missing command index for ${base}`);
    }
    const bytes = extractReturnBytes(result, idx, 0);
    const raw = bcs.u128().parse(bytes) as bigint | number | string;
    out[base] = typeof raw === "bigint" ? raw : BigInt(raw);
  }
  return out;
}

/**
 * One `simulateTransaction` per call: returns sizes matching on-chain `resolve_size` for all
 * `bases`. Throws if simulation fails (caller can inspect the message and skip on oracle flakes).
 */
export async function simulateResizeDerivedSizesForBases(
  client: WaterXClient,
  bases: readonly BaseAsset[],
  params: ResizeSizingProbeParams,
  opts?: BuildResizeSizingProbeOptions,
): Promise<Record<BaseAsset, bigint>> {
  const { tx, resizeCommandIndexByBase } = await buildResizeSizingProbeTransaction(
    client,
    bases,
    params,
    opts,
  );
  const raw = await client.simulate(tx);
  return parseResizeSizingProbeResult(raw, bases, resizeCommandIndexByBase);
}

/** Convenience for a single market. */
export async function simulateResizeDerivedSize(
  client: WaterXClient,
  base: BaseAsset,
  params: ResizeSizingProbeParams,
  opts?: BuildResizeSizingProbeOptions,
): Promise<bigint> {
  const sizes = await simulateResizeDerivedSizesForBases(client, [base], params, opts);
  return sizes[base]!;
}

export type ResolveOrderSizingProbeParams = {
  collateralAmount: bigint | number;
  leverage: number;
  collateral?: CollateralAsset;
  /** 1e9-scaled Float trigger price (same as `placeOrder` `triggerPrice`). */
  triggerPriceScaled: bigint;
};

/**
 * Dry-run `trading::resolve_order_size` at a trigger price: Hermes + feeds + `resolve_order_size`.
 */
export async function simulateResolveOrderDerivedSize(
  client: WaterXClient,
  base: BaseAsset,
  params: ResolveOrderSizingProbeParams,
  opts?: BuildResizeSizingProbeOptions,
): Promise<bigint> {
  const tx = new Transaction();
  tx.setSender(opts?.sender ?? DUMMY_SENDER);
  tx.setGasBudget(opts?.gasBudget ?? 1_200_000_000);
  const cache = opts?.pythCache ?? new PythCache();

  const { collateralPriceResult } = await addPriceFeeds(
    client,
    tx,
    base,
    params.collateral ?? "USDC",
    cache,
    /* updatePythPrice: */ true,
    /* selfPayPyth: */ true,
  );
  const resolveCmdIdx = tx.getData().commands.length;
  buildResolveOrderSize(client, tx, {
    collateral: params.collateral,
    collateralPriceResult,
    triggerPrice: params.triggerPriceScaled,
    collateralAmount: params.collateralAmount,
    leverage: params.leverage,
  });

  const raw = await client.simulate(tx);
  const bytes = extractReturnBytes(raw, resolveCmdIdx, 0);
  const parsed = bcs.u128().parse(bytes) as bigint | number | string;
  return typeof parsed === "bigint" ? parsed : BigInt(parsed);
}
