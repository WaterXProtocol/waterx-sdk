import { describe, expect, it } from "vitest";

import { PositionData } from "../../../src/generated/waterx_perp_view/view.ts";
import { calcEstLiqPriceRawFromView } from "../../../src/perp/liq-view.ts";
import { calcEstLiqPriceRaw } from "../../../src/utils/math.ts";

/**
 * VIEW-model verification matrix for the canonical BigInt mirror of
 * `view.move::calculate_est_liq_price` (WL-2248). Expected values are
 * HAND-DERIVED: transcribed line-by-line from the Move sources
 * (float.move truncating u128 ops, math.move::amount_to_usd two-step
 * composition) into independent integer arithmetic — NOT computed with the
 * SDK implementation under test.
 *
 * These fixtures exercise the VIEW model only (fee bundle saturates at 0,
 * close fee omitted). The REAL model (`calcRealLiqNetCostUsd`, close fee
 * included, signed) is tested separately in math.test.ts — the two models
 * are intentionally different and must never be validated against each other.
 */

/**
 * Shared scaffold: a ZERO-FEE LONG of size 1.0 at avg $100, base price $100,
 * 6-dec collateral priced at $1, 1.5% maintenance margin (⇒ maintenance $1.50 on
 * the $100 current notional). Every fixture spreads it and overrides exactly the
 * fields it exercises — `collateralAmountRaw` is deliberately NOT here, so each
 * case always states its own collateral. The fully hand-derived F1/F2/F5/F6
 * override all of it.
 */
const BASE = {
  isLong: true,
  sizeRaw: 1_000_000_000n, // 1.0 base token
  avgPriceRaw: 100_000_000_000n, // $100
  collateralDecimal: 6,
  collateralPriceUsd: 1n,
  basePriceUsd: 100n,
  maintenanceMarginRaw: 15_000_000n, // 1.5% → maintenance $1.50
  borrowFeeRaw: 0n,
  fundingSign: true,
  fundingFeeRaw: 0n,
  tradingFeeRaw: 0n,
};

describe("calcEstLiqPriceRaw — hand-derived VIEW-model fixtures", () => {
  it("F1: long, 6-dec collateral, funding owed", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: true,
        sizeRaw: 2_500_000_000n, // 2.5 base tokens
        avgPriceRaw: 97_531_246_789n, // ~$97.53, truncation-sensitive
        collateralAmountRaw: 50_000_000n, // 50 USDC (6 dec)
        collateralDecimal: 6,
        basePriceUsd: 100n,
        maintenanceMarginRaw: 15_000_000n, // 1.5%
        borrowFeeRaw: 2_345_678n,
        fundingSign: true,
        fundingFeeRaw: 500_001n,
        tradingFeeRaw: 1_234_567n,
      }),
    ).toBe(80_663_345_227n);
  });

  it("F2: short, 9-dec collateral, funding income partially credited", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: false,
        sizeRaw: 1_357_000_000n,
        avgPriceRaw: 123_456_789_123n,
        collateralAmountRaw: 75_000_000_123n, // 9-dec token
        collateralDecimal: 9,
        basePriceUsd: 120n,
        maintenanceMarginRaw: 50_000_000n, // 5% (stock-market MMR)
        borrowFeeRaw: 3_000_000_001n,
        fundingSign: false, // income
        fundingFeeRaw: 2_000_000_007n, // < borrow + trading → partial credit
        tradingFeeRaw: 1_000_000_003n,
      }),
    ).toBe(171_251_925_525n);
  });

  it("F3: long, income > all fees — VIEW saturates the bundle to 0 (≡ zero-fee run)", () => {
    const incomeBeyondFees = calcEstLiqPriceRaw({
      ...BASE,
      collateralAmountRaw: 30_000_000n,
      borrowFeeRaw: 1_000_000n,
      fundingSign: false,
      fundingFeeRaw: 50_000_000n, // income far beyond borrow + trading
      tradingFeeRaw: 1_000_000n,
    });
    const zeroFees = calcEstLiqPriceRaw({ ...BASE, collateralAmountRaw: 30_000_000n });
    expect(incomeBeyondFees).toBe(71_500_000_000n);
    // The view discards income beyond the other fees — unlike the REAL check.
    expect(incomeBeyondFees).toBe(zeroFees);
  });

  it("F3b: short, income > all fees — saturating floor (≡ zero-fee run)", () => {
    const incomeBeyondFees = calcEstLiqPriceRaw({
      ...BASE,
      isLong: false,
      collateralAmountRaw: 30_000_000n,
      borrowFeeRaw: 700_000n,
      fundingSign: false,
      fundingFeeRaw: 9_000_000n,
      tradingFeeRaw: 300_000n,
    });
    expect(incomeBeyondFees).toBe(128_500_000_000n);
  });

  it("F4: near-liquidation boundary — collateral == deductions is 0n; one raw unit above is not", () => {
    const boundary = {
      ...BASE, // maintenance = $1.50
      borrowFeeRaw: 500_000n, // + trading 0.5 → fees $1.00; deductions $2.50
      tradingFeeRaw: 500_000n,
    };
    // collateral_usd == deductions → lte() → 0n (already liquidatable)
    expect(calcEstLiqPriceRaw({ ...boundary, collateralAmountRaw: 2_500_000n })).toBe(0n);
    // one raw collateral unit ($0.000001) above the boundary → tiny nonzero margin
    expect(calcEstLiqPriceRaw({ ...boundary, collateralAmountRaw: 2_500_001n })).toBe(
      99_999_999_000n,
    );
  });

  it("F5: long, 9-dec collateral, funding income partially credited", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: true,
        sizeRaw: 3_141_592_653n,
        avgPriceRaw: 87_654_321_987n,
        collateralAmountRaw: 200_000_000_042n,
        collateralDecimal: 9,
        basePriceUsd: 90n,
        maintenanceMarginRaw: 20_000_000n, // 2%
        borrowFeeRaw: 4_000_000_009n,
        fundingSign: false,
        fundingFeeRaw: 1_500_000_011n,
        tradingFeeRaw: 2_000_000_003n,
      }),
    ).toBe(27_224_739_238n);
  });

  it("F6: short, 6-dec collateral, funding owed", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: false,
        sizeRaw: 750_000_000n,
        avgPriceRaw: 64_128_256_512n,
        collateralAmountRaw: 40_000_000n,
        collateralDecimal: 6,
        basePriceUsd: 60n,
        maintenanceMarginRaw: 25_000_000n, // 2.5%
        borrowFeeRaw: 1_111_111n,
        fundingSign: true,
        fundingFeeRaw: 2_222_222n,
        tradingFeeRaw: 3_333_333n,
      }),
    ).toBe(107_072_701_817n);
  });

  it("F9: collateralDecimal at the LOWER boundary (0) — raw units are whole tokens", () => {
    // 0-dec collateral: amount_to_usd's from_fraction divides by 10^0 = 1, so a
    // raw unit IS a whole token. 40 tokens @ $1 = $40 collateral; borrow+trading
    // = 2 raw = $2, funding owed 1 raw = $1; maintenance 1.5% × $100 = $1.50.
    // margin = 40 − 3 − 1.5 = 35.5 ⇒ ratio 0.355 ⇒ long liq = 50 × 0.645 = 32.25.
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: true,
        sizeRaw: 2_000_000_000n, // 2.0
        avgPriceRaw: 50_000_000_000n, // $50
        collateralAmountRaw: 40n, // 40 whole tokens
        collateralDecimal: 0,
        basePriceUsd: 50n,
        collateralPriceUsd: 1n,
        maintenanceMarginRaw: 15_000_000n, // 1.5%
        borrowFeeRaw: 1n,
        fundingSign: true,
        fundingFeeRaw: 1n,
        tradingFeeRaw: 1n,
      }),
    ).toBe(32_250_000_000n);
  });

  it("F10: collateralDecimal at the UPPER boundary (19), short, funding income", () => {
    // 10^19 is the largest power of ten inside u64 (10^19 < 2^64 <= 10^20) — the
    // exact reason the guard stops at 19. u64::MAX ≈ 1.844e19, so a 19-dec token
    // holds at most ~1.8 whole tokens in a raw u64 amount. All the truncation
    // happens in from_fraction here (dividing by 1e19 before the price mul), so
    // this is the case most sensitive to merging amount_to_usd's two steps.
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: false,
        sizeRaw: 4_321_000_000n,
        avgPriceRaw: 101_234_567_891n,
        collateralAmountRaw: 15_123_456_789_012_345_678n, // ~1.512 tokens, 19 dec
        collateralDecimal: 19,
        basePriceUsd: 99n,
        collateralPriceUsd: 97n,
        maintenanceMarginRaw: 20_000_000n, // 2%
        borrowFeeRaw: 1_111_111_111_111_111n,
        fundingSign: false, // income, partially credited
        fundingFeeRaw: 999_999_999_999_999n,
        tradingFeeRaw: 2_222_222_222_222_222n,
      }),
    ).toBe(133_199_232_774n);
  });

  it("F11: basePriceUsd 0n zero-bases the maintenance leg — computed, not skipped", () => {
    // The documented zero-basing case (see `WholeDollarUsdPrice`): a 0 price is
    // still USED, not treated as "no price". current_notional = size × 0 = 0, so
    // maintenance collapses to 0 and the whole $30 collateral becomes margin:
    // ratio = 30/100 = 0.3 ⇒ long liq = 100 × 0.7 = $70. The same run at the
    // real $100 base price pays $1.50 maintenance and lands at $71.50 (F3).
    expect(
      calcEstLiqPriceRaw({ ...BASE, basePriceUsd: 0n, collateralAmountRaw: 30_000_000n }),
    ).toBe(70_000_000_000n);
    expect(calcEstLiqPriceRaw({ ...BASE, collateralAmountRaw: 30_000_000n })).toBe(71_500_000_000n);
  });

  it("F7/F8: long ratio >= 1 and zero size both return 0n", () => {
    // $10k collateral against a $1 notional → ratio >= 1 → 0n
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        sizeRaw: 10_000_000n,
        collateralAmountRaw: 10_000_000_000n,
      }),
    ).toBe(0n);
    // zero size → entry_notional == 0 → 0n
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        sizeRaw: 0n,
        collateralAmountRaw: 50_000_000n,
      }),
    ).toBe(0n);
  });

  it("throws RangeError on negative bigints and bad collateralDecimal", () => {
    const valid = { ...BASE, collateralAmountRaw: 50_000_000n };
    expect(() => calcEstLiqPriceRaw({ ...valid, sizeRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, avgPriceRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralAmountRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, basePriceUsd: -100n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, maintenanceMarginRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, fundingFeeRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralDecimal: 1.5 })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralDecimal: 20 })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralDecimal: -1 })).toThrow(RangeError);
  });
});

/**
 * `calcEstLiqPriceRawFromView` — the view→raw adapter (`perp/liq-view.ts`).
 *
 * The arithmetic is already pinned above; what is under test HERE is the field
 * MAPPING. The fixture is round-tripped through the real BCS struct
 * (`serialize` → `parse`), so it carries exactly the shape a `perp/fetch` read
 * decodes — string-typed u64/u128 fields and all — rather than a hand-typed
 * object that only resembles one.
 */

/** Address-shaped filler; the adapter reads no address field. */
const ADDR = `0x${"1".repeat(64)}`;

/**
 * F1's inputs as a decoded position row. Fields the adapter must NOT read carry
 * deliberately WRONG decoy values: `unrealized_borrow_fee` /
 * `unrealized_funding_fee` (the view pre-combines accrued + unrealized into
 * `borrow_fee` / `funding_fee`, so the `unrealized_*` fields are strict SUBSETS
 * of that pair — reading them instead would UNDER-count the fee legs),
 * `unrealized_funding_sign` (inverted vs `funding_fee_positive`), and
 * `oracle_price` / `collateral_price` (the probe prices come from `opts`, never
 * off the row). Any of those mis-mapped moves the result off F1's hand-derived
 * expectation.
 */
const F1_ROW = PositionData.parse(
  PositionData.serialize({
    position_id: "42",
    account_object_address: ADDR,
    market_id: ADDR,
    is_long: true,
    size: "2500000000",
    collateral_type: { name: "0x2::usdc::USDC" },
    collateral_amount: "50000000",
    collateral_decimal: 6,
    average_price: "97531246789",
    oracle_price: "999999999999",
    collateral_price: "999999999999",
    est_liq_price: "80663345227",
    leverage_bps: "50000",
    entry_borrow_index: "0",
    entry_funding_sign: true,
    entry_funding_index: "0",
    unrealized_trading_fee: "1234567",
    unrealized_borrow_fee: "999999999",
    unrealized_funding_fee: "999999999",
    unrealized_funding_sign: false,
    pnl_positive: true,
    pnl: "0",
    funding_fee_positive: true,
    funding_fee: "500001",
    borrow_fee: "2345678",
    close_fee: "777777",
    linked_order_ids: [],
    linked_order_price_keys: [],
    create_timestamp: "1700000000000",
    update_timestamp: "1700000000000",
  }).toBytes(),
);

const F1_OPTS = {
  maintenanceMarginRaw: 15_000_000n, // 1.5%
  basePriceUsd: 100n,
  collateralPriceUsd: 1n,
};

describe("calcEstLiqPriceRawFromView — PositionDataView field mapping", () => {
  it("reproduces F1's hand-derived expectation from a decoded row", () => {
    expect(calcEstLiqPriceRawFromView(F1_ROW, F1_OPTS)).toBe(80_663_345_227n);
  });

  it("matches the row's own est_liq_price (what the parity harness asserts)", () => {
    expect(calcEstLiqPriceRawFromView(F1_ROW, F1_OPTS)).toBe(BigInt(F1_ROW.est_liq_price));
  });

  // Every ROW field the adapter is supposed to read, perturbed one at a time.
  // Each must move the result off F1's hand-derived expectation — a field
  // silently dropped from the map would leave it unchanged. (Re-asserting the
  // map inline instead would pass whenever both copies are wrong the same way,
  // which is the one failure mode worth catching here.)
  const READ_FIELDS: [string, Partial<typeof F1_ROW>][] = [
    ["is_long", { is_long: false }],
    ["size", { size: "3000000000" }],
    ["average_price", { average_price: "88000000000" }],
    ["collateral_amount", { collateral_amount: "60000000" }],
    ["collateral_decimal", { collateral_decimal: 7 }],
    ["borrow_fee", { borrow_fee: "9000000" }],
    ["funding_fee_positive", { funding_fee_positive: false }],
    ["funding_fee", { funding_fee: "4000000" }],
    ["unrealized_trading_fee", { unrealized_trading_fee: "8000000" }],
  ];

  // The complement: fields the view carries but this estimate must NOT consume.
  // The `unrealized_*` pair is the sharp one — the view pre-combines accrued +
  // unrealized into `borrow_fee` / `funding_fee`, so reading the `unrealized_*`
  // fields instead would UNDER-count the fee legs.
  const IGNORED_FIELDS: [string, Partial<typeof F1_ROW>][] = [
    ["unrealized_borrow_fee", { unrealized_borrow_fee: "1" }],
    ["unrealized_funding_fee", { unrealized_funding_fee: "1" }],
    ["unrealized_funding_sign", { unrealized_funding_sign: true }],
    ["oracle_price", { oracle_price: "1" }],
    ["collateral_price", { collateral_price: "1" }],
    ["est_liq_price", { est_liq_price: "1" }],
    ["close_fee", { close_fee: "1" }],
    ["pnl", { pnl: "123456789" }],
  ];

  it("reads all nine row fields — perturbing any one of them moves the estimate", () => {
    for (const [label, patch] of READ_FIELDS) {
      expect(calcEstLiqPriceRawFromView({ ...F1_ROW, ...patch }, F1_OPTS), label).not.toBe(
        80_663_345_227n,
      );
    }
  });

  it("reads nothing else — perturbing a non-input field leaves the estimate alone", () => {
    for (const [label, patch] of IGNORED_FIELDS) {
      expect(calcEstLiqPriceRawFromView({ ...F1_ROW, ...patch }, F1_OPTS), label).toBe(
        80_663_345_227n,
      );
    }
  });

  it("takes the probe prices from opts, not from the row's price fields", () => {
    // The row's oracle_price / collateral_price are absurd decoys; changing the
    // opts price (and only that) must move the estimate.
    expect(calcEstLiqPriceRawFromView(F1_ROW, { ...F1_OPTS, basePriceUsd: 5_000n })).not.toBe(
      80_663_345_227n,
    );
  });

  it("propagates the underlying RangeError guards", () => {
    expect(() =>
      calcEstLiqPriceRawFromView(F1_ROW, { ...F1_OPTS, maintenanceMarginRaw: -1n }),
    ).toThrow(RangeError);
  });
});
