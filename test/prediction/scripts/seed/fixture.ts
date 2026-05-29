import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const SEED_FIXTURE_PATH = resolve(
  process.cwd(),
  "test/prediction/fixtures/testnet-seeded.json",
);

/** Snapshot of testnet state seeded by `pnpm seed:testnet` for E2E fixture pinning. */
export interface SeedFixture {
  /** ISO timestamp of the last seed run. */
  updatedAt: string;
  owner: string;
  keeper?: string;
  /** Registry account id for `owner`. */
  accountId?: string;
  /** A market_id (hex) that always remains unresolved — used by placeOrder / requestClose tests. */
  openMarketIdHex?: string;
  /** An unfilled order on `openMarketIdHex` — used by selfCancelOrder / fetch.getOrder / keeper-style. */
  openOrderId?: string;
  /** An OPEN position (not yet requestClose) — used by requestClose. */
  openPositionId?: string;
  /** A PENDING_CLOSE position — used by selfCancelClose. */
  pendingClosePositionId?: string;
  /** A market_id (hex) intended to be resolved by the keeper for claim tests. */
  claimMarketIdHex?: string;
  /** Position id on `claimMarketIdHex` that should be claimable after resolution. */
  claimPositionId?: string;
  /** Outcome of the resolved claim market (matches winning side of `claimPositionId` selection). */
  claimMarketOutcome?: "YES" | "NO" | "INVALID";
  /** OPEN order whose expiry + cooldown have BOTH elapsed — usable by `selfCancelOrder` rescue. */
  expiredOpenOrderId?: string;
  /** PENDING_CLOSE position whose close-order expiry + cooldown have elapsed — usable by `selfCancelClose` rescue. */
  expiredPendingClosePositionId?: string;
}

export function readFixture(): SeedFixture | undefined {
  if (!existsSync(SEED_FIXTURE_PATH)) return undefined;
  try {
    const raw = readFileSync(SEED_FIXTURE_PATH, "utf8");
    return JSON.parse(raw) as SeedFixture;
  } catch {
    return undefined;
  }
}

export function writeFixture(fixture: SeedFixture): void {
  mkdirSync(dirname(SEED_FIXTURE_PATH), { recursive: true });
  writeFileSync(SEED_FIXTURE_PATH, JSON.stringify(fixture, null, 2) + "\n");
}

/** Merge a patch into the on-disk fixture (creates the file if missing). */
export function patchFixture(patch: Partial<SeedFixture>): SeedFixture {
  const current =
    readFixture() ?? ({ updatedAt: new Date().toISOString(), owner: "" } as SeedFixture);
  const next: SeedFixture = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeFixture(next);
  return next;
}
