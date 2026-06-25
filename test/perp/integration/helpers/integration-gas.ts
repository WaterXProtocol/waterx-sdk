/**
 * Integration gas budgets (env-overridable). Defaults are intentionally low so a nearly-empty
 * testnet wallet can still pass gas *selection*; bump via env only when a tx runs out of gas.
 *
 * `setGasBudget` is an upper cap — the node requires the wallet to hold at least that much SUI
 * to pick gas coins, so high caps hurt low-balance wallets.
 */
import type { PerpClient } from "../../../../src/client.ts";

export type IntegrationGasKind =
  | "default"
  | "accountBootstrap"
  | "custodyMint"
  | "creditWithdraw"
  | "wlp"
  | "staking"
  | "keeper"
  | "lifecycle";

/** Mist caps per flow when no env override is set. */
const DEFAULT_BUDGETS: Record<IntegrationGasKind, number> = {
  default: 10_000_000,
  accountBootstrap: 10_000_000,
  custodyMint: 10_000_000,
  creditWithdraw: 15_000_000,
  wlp: 20_000_000,
  staking: 20_000_000,
  keeper: 15_000_000,
  lifecycle: 20_000_000,
};

const ENV_BY_KIND: Record<IntegrationGasKind, string> = {
  default: "WATERX_INTEGRATION_GAS_BUDGET",
  accountBootstrap: "WATERX_INTEGRATION_GAS_BUDGET_ACCOUNT",
  custodyMint: "WATERX_INTEGRATION_GAS_BUDGET_CUSTODY_MINT",
  creditWithdraw: "WATERX_INTEGRATION_GAS_BUDGET_CREDIT_WITHDRAW",
  wlp: "WATERX_INTEGRATION_GAS_BUDGET_WLP",
  staking: "WATERX_INTEGRATION_GAS_BUDGET_STAKING",
  keeper: "WATERX_INTEGRATION_GAS_BUDGET_KEEPER",
  lifecycle: "WATERX_INTEGRATION_GAS_BUDGET_LIFECYCLE",
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim() || !/^\d+$/.test(raw.trim())) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Gas budget for a flow. `WATERX_INTEGRATION_GAS_BUDGET` overrides every kind; otherwise per-kind
 * env, then the low default for `kind`.
 */
export function integrationGasBudget(kind: IntegrationGasKind = "default"): number {
  const global = process.env.WATERX_INTEGRATION_GAS_BUDGET?.trim();
  if (global && /^\d+$/.test(global)) {
    return Number.parseInt(global, 10);
  }
  return parsePositiveInt(process.env[ENV_BY_KIND[kind]], DEFAULT_BUDGETS[kind]);
}

/**
 * Optional pre-flight SUI floor (mist). Default **disabled** (`null`) — tests always try on-chain
 * first and only skip when gas selection fails. Set `WATERX_INTEGRATION_MIN_SUI_MIST` to opt in.
 */
export function integrationMinSuiMist(): bigint | null {
  const raw = process.env.WATERX_INTEGRATION_MIN_SUI_MIST?.trim();
  if (!raw || raw === "0") return null;
  if (/^\d+$/.test(raw)) return BigInt(raw);
  return null;
}

export function isInsufficientSuiGasError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("insufficient SUI balance") ||
    msg.includes("Unable to perform gas selection") ||
    msg.includes("gas coins are required") ||
    msg.includes("No valid gas coins")
  );
}

export function insufficientSuiSkipReason(error: unknown, owner?: string): string {
  const addr = owner ? ` (${owner})` : "";
  const detail =
    error instanceof Error ? error.message.split("\n")[0]?.slice(0, 200) : String(error);
  return (
    `Insufficient SUI for gas${addr} — fund the integration wallet on testnet or set a lower ` +
    `WATERX_INTEGRATION_GAS_BUDGET. ${detail}`
  );
}

export async function getOwnerSuiBalanceMist(client: PerpClient, owner: string): Promise<bigint> {
  const { objects } = await client.listCoins({ owner, coinType: "0x2::sui::SUI" });
  let total = 0n;
  for (const o of objects) {
    total += BigInt(o.balance ?? "0");
  }
  return total;
}
