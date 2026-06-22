import {
  Transaction,
  type TransactionArgument,
  type TransactionObjectArgument,
} from "@mysten/sui/transactions";

import type { PredictClient } from "./client.ts";
import { CLOCK_OBJECT_ID } from "./constants.ts";
import type {
  AccountIdentityParams,
  IdArgument,
  MarketIdInput,
  ObjectArgument,
  Outcome,
  Selection,
} from "./types.ts";

const SELECTIONS: readonly Selection[] = ["YES", "NO"];
const OUTCOMES: readonly Outcome[] = ["YES", "NO", "INVALID"];
const U64_MAX = (1n << 64n) - 1n;

export function assertSelection(value: string): Selection {
  if (SELECTIONS.includes(value as Selection)) return value as Selection;
  throw new Error(`Invalid Selection: expected "YES" or "NO", got ${JSON.stringify(value)}`);
}

export function assertOutcome(value: string): Outcome {
  if (OUTCOMES.includes(value as Outcome)) return value as Outcome;
  throw new Error(
    `Invalid Outcome: expected "YES", "NO", or "INVALID", got ${JSON.stringify(value)}`,
  );
}

export function requireConfig<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is required. Pass it in params or PredictClient config.`);
  }
  return value;
}

function resolveOptionalString(override: string | undefined, fallback: string): string {
  if (override === undefined || override === "") return fallback;
  return override;
}

export function resolvePackageId(client: PredictClient, packageId?: string): string {
  return resolveOptionalString(packageId, client.packageId());
}

export function resolveAccountPackageId(client: PredictClient, accountPackageId?: string): string {
  return resolveOptionalString(accountPackageId, client.waterxAccountPackageId());
}

export function resolveSettlementCoinType(client: PredictClient, coinType?: string): string {
  return resolveOptionalString(coinType, client.settlementCoinType());
}

export function resolveMarketRegistry(client: PredictClient, marketRegistry?: string): string {
  return marketRegistry === undefined || marketRegistry === ""
    ? client.marketRegistry()
    : marketRegistry;
}

export function resolveAccountRegistry(client: PredictClient, accountRegistry?: string): string {
  return accountRegistry === undefined || accountRegistry === ""
    ? client.accountRegistry()
    : accountRegistry;
}

export function resolveGlobalConfig(client: PredictClient, globalConfig?: string): string {
  return globalConfig === undefined || globalConfig === "" ? client.globalConfigId() : globalConfig;
}

/** Ensures `value` is a valid unsigned 64-bit integer. */
export function assertU64(value: bigint, name = "value"): bigint {
  if (value < 0n) {
    throw new Error(`${name} must be non-negative, got ${value}`);
  }
  if (value > U64_MAX) {
    throw new Error(`${name} exceeds u64 max (${U64_MAX}), got ${value}`);
  }
  return value;
}

export function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") {
    return assertU64(value);
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Invalid integer: ${value}`);
    }
    return assertU64(BigInt(value));
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("Invalid integer: empty string");
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid integer: ${JSON.stringify(value)}`);
  }
  return assertU64(BigInt(trimmed));
}

export function objectArg(tx: Transaction, value: ObjectArgument): TransactionArgument {
  return typeof value === "string" ? tx.object(value) : value;
}

export function idArg(tx: Transaction, value: IdArgument): TransactionArgument {
  return typeof value === "string" ? tx.pure.id(value) : value;
}

export function clockArg(tx: Transaction): TransactionArgument {
  return tx.object.clock ? tx.object.clock() : tx.object(CLOCK_OBJECT_ID);
}

export function createAccountRequest(
  client: PredictClient,
  tx: Transaction,
  params: AccountIdentityParams = {},
): TransactionArgument {
  const pkg = client.bucketFrameworkPackageId();
  if (params.bucketAccount === undefined) {
    const [request] = tx.moveCall({
      target: `${pkg}::account::request`,
    });
    return request;
  }

  const [request] = tx.moveCall({
    target: `${pkg}::account::request_with_account`,
    arguments: [objectArg(tx, params.bucketAccount)],
  });
  return request;
}

/** Coerces on-chain `vector<u8>` shapes used in view decoding. */
export function marketIdBytesFromUnknown(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (Array.isArray(raw)) return bytesFromNumberArray(raw);
  if (typeof raw === "string") {
    throw new Error(
      "market_id from chain views must be Uint8Array or number[]; strings are not supported. " +
        "Use normalizeMarketId() when building PTBs from string market ids.",
    );
  }
  throw new Error(`market_id must be Uint8Array or number[], got ${typeof raw}`);
}

function bytesFromNumberArray(marketId: number[]): Uint8Array {
  const bytes = new Uint8Array(marketId.length);
  for (let i = 0; i < marketId.length; i += 1) {
    const byte = marketId[i];
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new Error(`Invalid market id byte at index ${i}: ${byte} (expected 0-255)`);
    }
    bytes[i] = byte;
  }
  return bytes;
}

function parseHexMarketId(marketId: string): Uint8Array {
  const hex = marketId.slice(2);
  if (hex.length === 0) {
    throw new Error(`Invalid hex market id: empty hex (${marketId})`);
  }
  if (hex.length % 2 !== 0) {
    throw new Error(`Invalid hex market id: ${marketId}`);
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const pair = hex.slice(i * 2, i * 2 + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) {
      throw new Error(
        `Invalid hex market id: bad nibble pair ${JSON.stringify(pair)} in ${marketId}`,
      );
    }
    bytes[i] = Number.parseInt(pair, 16);
  }
  return bytes;
}

export function normalizeMarketId(marketId: MarketIdInput): Uint8Array {
  if (marketId instanceof Uint8Array) return marketId;
  if (Array.isArray(marketId)) return bytesFromNumberArray(marketId);

  if (marketId.startsWith("0x") || marketId.startsWith("0X")) {
    return parseHexMarketId(marketId);
  }

  return new TextEncoder().encode(marketId);
}

export function marketIdArg(tx: Transaction, marketId: MarketIdInput): TransactionArgument {
  return tx.pure.vector("u8", Array.from(normalizeMarketId(marketId)));
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  const normalized = bytes instanceof Uint8Array ? bytes : bytesFromNumberArray(bytes);
  return `0x${Array.from(normalized, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function optionU64(value: bigint | number | string | null | undefined): TransactionArgument {
  return (tx) => tx.pure.option("u64", value == null ? null : toBigInt(value));
}

function formatObjectVersion(version: string | bigint | number): string {
  if (typeof version === "string") {
    const trimmed = version.trim();
    if (trimmed === "" || !/^\d+$/.test(trimmed)) {
      throw new Error(`Invalid object version: ${JSON.stringify(version)}`);
    }
    return trimmed;
  }
  return String(toBigInt(version));
}

export function receivingCoinArg(
  tx: Transaction,
  coin: { objectId: string; version: string | bigint | number; digest: string },
): TransactionObjectArgument {
  return tx.receivingRef({
    objectId: coin.objectId,
    version: formatObjectVersion(coin.version),
    digest: coin.digest,
  });
}
