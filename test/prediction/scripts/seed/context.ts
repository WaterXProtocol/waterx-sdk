import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { createE2eClient } from "~predict-tests/helpers/e2e-context.ts";
import {
  hasWriteCredentials,
  loadOptionalKeeperSigner,
  loadSigner,
  readSeedDepositAmount,
} from "~predict-tests/helpers/env.ts";
import type { PredictClient } from "~predict/client.ts";
import { isKeeper } from "~predict/fetch.ts";

import { patchFixture, readFixture, type SeedFixture } from "./fixture.ts";

export interface SeedContext {
  client: PredictClient;
  /** Owner signer (loaded from `SUI_PRIVATE_KEY`). */
  owner: Ed25519Keypair;
  ownerAddress: string;
  /** Optional keeper signer; falls back to `owner` only if the owner is registered as a keeper. */
  keeper?: Ed25519Keypair;
  keeperAddress?: string;
  /** USD base units to deposit when seeding. */
  depositAmount: bigint;
  /** Console logger prefixed with `[seed]`. */
  log: (step: string, detail?: string) => void;
  /** Current persisted fixture (mutated in-place by `setFixture`). */
  fixture: SeedFixture;
  /** Merge a patch into the in-memory + on-disk fixture. */
  setFixture: (patch: Partial<SeedFixture>) => void;
  /** True when no transactions should be sent (preview mode). */
  dryRun: boolean;
}

export function log(step: string, detail?: string): void {
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`[seed] ${step}${suffix}`);
}

/**
 * Builds a SeedContext. `SUI_PRIVATE_KEY` is required (owner). `E2E_KEEPER_PRIVATE_KEY` is used
 * as the keeper if present and registered; otherwise the owner is checked for keeper membership.
 */
export async function buildContext(argv: string[], dryRun: boolean): Promise<SeedContext> {
  if (!hasWriteCredentials()) {
    throw new Error(
      "No owner key set. Add SUI_PRIVATE_KEY (or WATERX_INTEGRATION_PRIVATE_KEY) to .env " +
        "(suiprivkey1... from `sui keytool export`).",
    );
  }
  const owner = loadSigner();
  const ownerAddress = owner.toSuiAddress();
  const client = await createE2eClient();

  const explicitKeeper = loadOptionalKeeperSigner();
  let keeper: Ed25519Keypair | undefined;
  if (explicitKeeper) {
    const ok = await isKeeper(client, { keeper: explicitKeeper.toSuiAddress() });
    keeper = ok ? explicitKeeper : undefined;
    if (!ok) {
      log(
        "keeper key not registered",
        `${explicitKeeper.toSuiAddress()} is not in keeper list — keeper stages will be skipped.`,
      );
    }
  } else {
    const ownerIsKeeper = await isKeeper(client, { keeper: ownerAddress });
    if (ownerIsKeeper) keeper = owner;
  }

  const initial =
    readFixture() ?? ({ updatedAt: new Date().toISOString(), owner: ownerAddress } as SeedFixture);
  const fixture: SeedFixture = { ...initial, owner: ownerAddress };
  if (keeper) fixture.keeper = keeper.toSuiAddress();

  const ctx: SeedContext = {
    client,
    owner,
    ownerAddress,
    keeper,
    keeperAddress: keeper?.toSuiAddress(),
    depositAmount: readSeedDepositAmount(argv),
    log,
    fixture,
    setFixture(patch) {
      const merged = patchFixture(patch);
      Object.assign(ctx.fixture, merged);
    },
    dryRun,
  };

  if (!dryRun) {
    await assertGasBudget(ctx);
    if (keeper && keeper.toSuiAddress() !== ownerAddress) {
      await assertGasBudget({ ...ctx, ownerAddress: keeper.toSuiAddress() });
    }
  }
  return ctx;
}

const SUI_COIN_TYPE = "0x2::sui::SUI";
/** Roughly enough for a handful of seed PTBs (one PTB ≈ 5-25M MIST). */
const RECOMMENDED_GAS_MIST = 100_000_000n;
const HARD_MIN_GAS_MIST = 25_000_000n;

async function assertGasBudget(ctx: SeedContext): Promise<void> {
  const page = await ctx.client.listCoins({ owner: ctx.ownerAddress, coinType: SUI_COIN_TYPE });
  const objs = (page as { objects?: { balance?: string }[] }).objects ?? [];
  const total = objs.reduce((sum, o) => sum + BigInt(o.balance ?? 0), 0n);
  if (total < HARD_MIN_GAS_MIST) {
    throw new Error(
      `Insufficient SUI gas for ${ctx.ownerAddress} (have ${total} MIST, need at least ${HARD_MIN_GAS_MIST}). ` +
        `Fund via https://faucet.sui.io/?address=${ctx.ownerAddress} and re-run.`,
    );
  }
  if (total < RECOMMENDED_GAS_MIST) {
    ctx.log(
      "warning: low SUI balance",
      `${ctx.ownerAddress} has ${total} MIST (< ${RECOMMENDED_GAS_MIST} recommended). Some stages may run out of gas.`,
    );
  }
}
