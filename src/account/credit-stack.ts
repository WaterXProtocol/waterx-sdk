/**
 * Credit stacks — one `CreditRegistry<CREDIT>` + `CustodyVault<CREDIT>` +
 * `Queue<CREDIT>` per credit coin, keyed by the credit's short alias
 * (`USD`, `SUI`, `DEEP`, `WAL`, …).
 *
 * The config carries them as three parallel maps —
 * `objects.credit.registries`, `objects.custody.vaults`,
 * `objects.withdrawal_queue.queues` — plus the singular
 * `objects.credit.{registry,credit_type}` / `objects.custody.{vault,assets}` /
 * `objects.withdrawal_queue.{queue,executors}` fields, which are the DEFAULT
 * credit's entries (USD) kept for readers that predate the maps. This module
 * is the only place that joins them; every builder and probe that needs a
 * registry / vault / queue id resolves a {@link CreditStack} here instead of
 * indexing the singular fields, so a non-default credit can never be paired
 * with the USD registry.
 *
 * A credit can be named by alias (case-insensitive) or by its fully-qualified
 * Move type; both are accepted wherever a `credit` / `creditType` parameter is
 * documented as such. Unknown names throw — there is no fallback to USD.
 */

import { normalizeStructTag } from "@mysten/sui/utils";

import type { NativeCustodyAsset, WaterXConfig } from "../config.ts";

export interface CreditStack {
  /** Config alias (`"USD"`, `"SUI"`, …) — the key in all three maps. */
  readonly alias: string;
  /** Fully-qualified CREDIT coin Move type (normalized). */
  readonly creditType: string;
  /** Decimals of the credit coin itself (6 for every credit — `native_custody` scales backing assets to 6). */
  readonly decimals: number;
  /** Shared `CreditRegistry<CREDIT>`. */
  readonly registry: string;
  /** `coin_registry::MetadataCap` of the credit coin, when the config carries it. */
  readonly metadataCap?: string;
  /** Shared `CustodyVault<CREDIT>`. */
  readonly vault: string;
  /** Backing assets registered on the vault (`decimal` is the BACKING asset's). */
  readonly assets: readonly NativeCustodyAsset[];
  /** Shared `Queue<CREDIT>`. */
  readonly queue: string;
  /** Executor allowlist of the queue (keepers that may run `execute_native` / `execute_wormhole`). */
  readonly executors: readonly string[];
}

const STACK_MAPS = [
  ["objects.credit.registries", (c: WaterXConfig) => c.objects.credit.registries],
  ["objects.custody.vaults", (c: WaterXConfig) => c.objects.custody.vaults],
  ["objects.withdrawal_queue.queues", (c: WaterXConfig) => c.objects.withdrawal_queue.queues],
] as const;

/**
 * The three maps must carry exactly the same alias set — a credit is either
 * fully wired (registry + vault + queue) or it is not a credit. Any alias
 * present in some maps but not all is a half-wired stack, whichever map is
 * the odd one out, and the whole document is rejected rather than that
 * credit silently dropped.
 */
function assertStackMapsSymmetric(config: WaterXConfig): void {
  const union = new Set(STACK_MAPS.flatMap(([, pick]) => Object.keys(pick(config))));
  const problems: string[] = [];
  for (const alias of union) {
    const missing = STACK_MAPS.filter(([, pick]) => !(alias in pick(config))).map(([path]) => path);
    if (missing.length > 0) problems.push(`credit ${alias}: missing from ${missing.join(", ")}`);
  }
  if (problems.length > 0) throw new Error(`half-wired credit stack(s) — ${problems.join("; ")}`);
}

/**
 * Every credit stack in the config, keyed by alias. Throws when the three
 * per-credit maps disagree on the alias set (a half-wired credit).
 */
export function creditStacks(config: WaterXConfig): Readonly<Record<string, CreditStack>> {
  assertStackMapsSymmetric(config);
  const registries = config.objects.credit.registries;
  const vaults = config.objects.custody.vaults;
  const queues = config.objects.withdrawal_queue.queues;
  const out: Record<string, CreditStack> = {};
  for (const [alias, reg] of Object.entries(registries)) {
    const vault = vaults[alias]!;
    const queue = queues[alias]!;
    out[alias] = Object.freeze({
      alias,
      creditType: normalizeStructTag(reg.credit_type),
      decimals: reg.decimals,
      registry: reg.registry,
      metadataCap: reg.metadata_cap,
      vault: vault.vault,
      assets: vault.assets,
      queue: queue.queue,
      executors: queue.executors ?? [],
    });
  }
  return Object.freeze(out);
}

/**
 * The stack for `ref` — an alias (case-insensitive) or a Move type — or the
 * DEFAULT credit (the one `objects.credit.credit_type` names, USD) when `ref`
 * is omitted. Throws on an unknown credit.
 */
export function resolveCreditStack(config: WaterXConfig, ref?: string): CreditStack {
  const stacks = creditStacks(config);
  const wanted = ref === undefined ? config.objects.credit.credit_type : ref;
  if (wanted.includes("::")) {
    const type = normalizeStructTag(wanted);
    const hit = Object.values(stacks).find((s) => s.creditType === type);
    if (hit) return hit;
    throw new Error(
      `no credit stack for coin type ${wanted} (known: ${Object.values(stacks)
        .map((s) => s.creditType)
        .join(", ")})`,
    );
  }
  const alias = wanted.toUpperCase();
  const hit = Object.entries(stacks).find(([k]) => k.toUpperCase() === alias)?.[1];
  if (hit) return hit;
  throw new Error(`no credit stack named ${wanted} (known: ${Object.keys(stacks).join(", ")})`);
}

/** The stack whose vault registers `assetType` as a backing asset, or undefined. */
export function creditStackForAsset(
  config: WaterXConfig,
  assetType: string,
): CreditStack | undefined {
  const type = normalizeStructTag(assetType);
  return Object.values(creditStacks(config)).find((s) =>
    s.assets.some((a) => normalizeStructTag(a.type) === type),
  );
}
