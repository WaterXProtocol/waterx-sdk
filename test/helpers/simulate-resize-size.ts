/**
 * Test helpers: dry-run `trading::resolve_size` via {@link addPriceFeeds} + {@link buildResolveSize}.
 * Uses the same oracle wiring as production builders (sponsor path by default).
 */
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import {
  addPriceFeeds,
  buildResolveSize,
  PythCache,
  type BaseAsset,
  type CollateralAsset,
  type WaterXClient,
} from "@waterx/perp-sdk";

import { DUMMY_SENDER } from "./testnet.ts";

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
      undefined,
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
