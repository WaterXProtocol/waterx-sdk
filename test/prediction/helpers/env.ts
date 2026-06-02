import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import { optionalEnv } from "./e2e-env.ts";

export { optionalEnv, readFixtureOverrides, readTestnetClientOverrides } from "./e2e-env.ts";

/** @deprecated Use `readFixtureOverrides()` — kept for integration helpers. */
export const e2eEnv = {
  get accountId() {
    return optionalEnv("E2E_ACCOUNT_ID");
  },
  get orderId() {
    return optionalEnv("E2E_ORDER_ID");
  },
  get positionId() {
    return optionalEnv("E2E_POSITION_ID");
  },
  get marketId() {
    return optionalEnv("E2E_MARKET_ID");
  },
  get marketKey() {
    return optionalEnv("E2E_MARKET_KEY");
  },
  get usdCoinObjectId() {
    return optionalEnv("E2E_USD_COIN_OBJECT_ID");
  },
};

/**
 * Owner secret for seeding / integration. Accepts the prediction-native
 * `SUI_PRIVATE_KEY` or, as a fallback, the perp-native `WATERX_INTEGRATION_PRIVATE_KEY`
 * (so a single funded testnet key works for both lines in the merged repo).
 */
export function ownerSecretEnv(): string | undefined {
  return optionalEnv("SUI_PRIVATE_KEY") ?? optionalEnv("WATERX_INTEGRATION_PRIVATE_KEY");
}

export function hasWriteCredentials(): boolean {
  return Boolean(ownerSecretEnv());
}

/** Default seed/integration deposit: 1_000_000 base units (matches seed `placeOrder` maxSpend). */
export const DEFAULT_SEED_DEPOSIT_AMOUNT = 1_000_000n;

/** `SEED_DEPOSIT_AMOUNT` env or `--deposit-amount=<base units>` CLI flag. */
export function readSeedDepositAmount(argv: string[] = []): bigint {
  const flag = argv.find((a) => a.startsWith("--deposit-amount="));
  if (flag) {
    return BigInt(flag.slice("--deposit-amount=".length));
  }
  const env = optionalEnv("SEED_DEPOSIT_AMOUNT");
  if (env) return BigInt(env);
  return DEFAULT_SEED_DEPOSIT_AMOUNT;
}

const SECRET_KEY_SIZE = 32;
const LEGACY_SECRET_KEY_SIZE = 64;

/** Parses hex (`0x...`) or base64 secret key bytes for Ed25519 (32-byte seed). */
export function parseSecretKey(raw: string): Uint8Array {
  const s = raw.trim();
  if (s.startsWith("suiprivkey")) {
    throw new Error(
      "SUI_PRIVATE_KEY looks like a Sui bech32 key (suiprivkey1...). " +
        "Pass it as-is; loadSigner() decodes it automatically.",
    );
  }
  if (s.startsWith("0x") || s.startsWith("0X")) {
    const hex = s.slice(2);
    if (hex.length % 2 !== 0) throw new Error("Invalid hex secret key length");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  const bin = Buffer.from(s, "base64");
  if (bin.length > 0) return Uint8Array.from(bin);
  throw new Error(
    "Could not parse SUI_PRIVATE_KEY. Use `sui keytool export` (suiprivkey1...), " +
      "or 0x + 64 hex chars for the 32-byte seed.",
  );
}

function keypairFromEnvSecret(raw: string): Ed25519Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("suiprivkey")) {
    return Ed25519Keypair.fromSecretKey(trimmed);
  }

  const bytes = parseSecretKey(trimmed);
  if (bytes.length === SECRET_KEY_SIZE) {
    return Ed25519Keypair.fromSecretKey(bytes);
  }
  if (bytes.length === LEGACY_SECRET_KEY_SIZE) {
    return Ed25519Keypair.fromSecretKey(bytes.slice(0, SECRET_KEY_SIZE));
  }

  throw new Error(
    `SUI_PRIVATE_KEY decoded to ${bytes.length} bytes (expected ${SECRET_KEY_SIZE}, or ${LEGACY_SECRET_KEY_SIZE} legacy). ` +
      "Export with: sui keytool export --key-identity <address>  (paste the suiprivkey1... line). " +
      "Do not use your Sui address (0x...) or mnemonic phrase here.",
  );
}

export function loadSigner(): Ed25519Keypair {
  const raw = ownerSecretEnv();
  if (!raw) throw new Error("SUI_PRIVATE_KEY (or WATERX_INTEGRATION_PRIVATE_KEY) is not set");
  return keypairFromEnvSecret(raw);
}

export function loadOptionalKeeperSigner(): Ed25519Keypair | undefined {
  const raw = optionalEnv("E2E_KEEPER_PRIVATE_KEY");
  if (!raw) return undefined;
  return keypairFromEnvSecret(raw);
}
