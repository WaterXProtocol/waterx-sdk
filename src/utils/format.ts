// Display-label formatters that must be byte-identical wherever the same wire
// field is rendered. Hosted in the SDK so FE and BE share one implementation
// instead of hand-mirroring each other.

import { MS_PER_HOUR, MS_PER_MINUTE } from "../constants.ts";

/**
 * Funding-interval label from milliseconds: hour-based at or above one hour,
 * minute-based below. Non-integer hours are kept as-is:
 *
 *   3_600_000  → "1H"
 *   28_800_000 → "8H"
 *   5_400_000  → "1.5H"
 *   1_800_000  → "30M"
 *
 * Single source for the label the BE tickers payload emits and the FE reader
 * must reproduce byte-identically (output-identical port of bucket-backend-mono
 * `apps/waterx/src/core/utils/funding.ts::formatFundingInterval`).
 */
export function formatFundingInterval(intervalMs: number): string {
  const hours = intervalMs / MS_PER_HOUR;
  return hours >= 1 ? `${hours}H` : `${intervalMs / MS_PER_MINUTE}M`;
}
