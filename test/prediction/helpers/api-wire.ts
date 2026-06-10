/** Predict API wire types + pure helpers (no Vitest — safe for CLI scripts). */

export interface BetsMeListData {
  bets: BetWire[];
  nextCursor?: string | null;
}

export interface BetWire {
  betId?: string;
  orderId?: string | number;
  order_id?: string | number;
  positionId?: string | number;
  position_id?: string | number;
  status?: string;
  /** Bruno wire: `side` (`up` | `teamA` …); legacy rows may use `selection` (`YES`). */
  side?: string;
  selection?: string;
  lockedOddsCents?: number;
  stake?: { amountUsd?: number | string; token?: string };
  stakeUsd?: number | string;
  shares?: number | string;
  priceCapBps?: number | string;
  placedAt?: number;
  settledAt?: number | null;
  outcome?: string;
  submissionState?: string;
  payoutUsd?: number | null;
  cardSnapshot?: Record<string, unknown>;
  marketSlug?: string;
  marketId?: string;
  roundId?: string;
}

export function betWireId(bet: BetWire): string | undefined {
  if (bet.betId !== undefined && String(bet.betId).length > 0) return String(bet.betId);
  return betOrderId(bet);
}

export function betOrderId(bet: BetWire): string | undefined {
  const raw = bet.orderId ?? bet.order_id ?? bet.positionId ?? bet.position_id;
  if (raw === undefined) return undefined;
  return String(raw);
}

export function betListIncludesOrderId(bets: BetWire[], orderId: string | bigint): boolean {
  const want = String(orderId);
  return bets.some((b) => betOrderId(b) === want);
}

/** Resting order on book — broker has not filled yet (`order-state` rule 9). */
export function betWireAwaitingBrokerFill(bet: BetWire): boolean {
  if (bet.submissionState === "submitting") return true;
  return (
    bet.outcome === "pending" && betWireShares(bet) === 0 && bet.submissionState !== "confirmed"
  );
}

/**
 * Broker/keeper filled — `order-state` rule 8/9: resting `submitting` → `confirmed` + `outcome: pending`.
 * Wire `Bet` has no `shares` field (only `stake`); do not gate on `shares`.
 */
export function betWireBrokerFilled(bet: BetWire): boolean {
  return bet.submissionState === "confirmed" && bet.outcome === "pending";
}

export function betWireShares(bet: BetWire): number {
  const raw = bet.shares;
  if (raw === undefined) return 0;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(n) ? n : 0;
}

export function betListIncludesPositionId(bets: BetWire[], positionId: string | bigint): boolean {
  const want = String(positionId);
  return bets.some((b) => {
    const raw = b.positionId ?? b.position_id;
    return raw !== undefined && String(raw) === want;
  });
}

/** Match API row by chain fixture id (order and/or position; some APIs only set `positionId`). */
export function findBetForChainFixture(
  bets: BetWire[],
  fixture: { orderId?: bigint; positionId?: bigint },
): BetWire | undefined {
  // Prefer position id — order cursor can collide with another row's `positionId` on catalog wire.
  if (fixture.positionId !== undefined) {
    const byPos = bets.find((b) => betListIncludesPositionId([b], fixture.positionId!));
    if (byPos) return byPos;
    const want = String(fixture.positionId);
    const byOrderField = bets.find((b) => betOrderId(b) === want);
    if (byOrderField) return byOrderField;
    // Bypass/catalog wire: indexer may expose `order_id` in `positionId` (chain position differs).
    if (fixture.orderId !== undefined) {
      const wantOrder = String(fixture.orderId);
      const byBypassWire = bets.find((b) => {
        const raw = b.positionId ?? b.position_id;
        return raw !== undefined && String(raw) === wantOrder;
      });
      if (byBypassWire) return byBypassWire;
    }
    return undefined;
  }
  if (fixture.orderId !== undefined) {
    const want = String(fixture.orderId);
    const byExplicitOrder = bets.find((b) => {
      const raw = b.orderId ?? b.order_id;
      return raw !== undefined && String(raw) === want;
    });
    if (byExplicitOrder) return byExplicitOrder;
    const hit = bets.find((b) => betOrderId(b) === want);
    if (hit) return hit;
  }
  return undefined;
}

/** Minimal shape check for CLI (no Vitest). */
export function isBetsMeListData(data: unknown): data is BetsMeListData {
  return (
    typeof data === "object" &&
    data !== null &&
    "bets" in data &&
    Array.isArray((data as BetsMeListData).bets)
  );
}
