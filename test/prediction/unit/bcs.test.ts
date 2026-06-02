import {
  mapAccountDataView,
  mapCursorView,
  mapMarketView,
  mapOrderKind,
  mapOrderView,
  mapOutcome,
  mapPositionView,
  mapRegistryView,
  mapSelection,
  mapStatus,
} from "~predict/bcs.ts";
import { describe, expect, it } from "vitest";

import {
  accountDataFixture,
  marketFixture,
  orderFixture,
  positionFixture,
  registryFixture,
} from "../fixtures/bcs-fixtures.ts";

describe("map enums", () => {
  it("mapSelection", () => {
    expect(mapSelection("Yes")).toBe("YES");
    expect(mapSelection({ $kind: "No" })).toBe("NO");
  });

  it("mapOutcome", () => {
    expect(mapOutcome("Invalid")).toBe("INVALID");
    expect(mapOutcome("Yes")).toBe("YES");
    expect(mapOutcome("No")).toBe("NO");
    expect(mapOutcome({ No: true })).toBe("NO");
  });

  it("mapOrderKind / mapStatus", () => {
    expect(mapOrderKind("Open")).toBe("OPEN");
    expect(mapOrderKind("Close")).toBe("CLOSE");
    expect(mapOrderKind({ Close: true })).toBe("CLOSE");
    expect(mapStatus("Open")).toBe("OPEN");
    expect(mapStatus("PendingClose")).toBe("PENDING_CLOSE");
    expect(mapStatus({ PendingClose: true })).toBe("PENDING_CLOSE");
    expect(mapStatus("pending_close")).toBe("PENDING_CLOSE");
  });
});

describe("map views", () => {
  it("mapRegistryView", () => {
    const v = mapRegistryView(registryFixture);
    expect(v.balance).toBe(100n);
    expect(v.resolvedMarketCount).toBe(4n);
  });

  it("mapOrderView", () => {
    const v = mapOrderView(orderFixture);
    expect(v.orderId).toBe(11n);
    expect(v.kind).toBe("OPEN");
    expect(v.createdTs).toBe(3n);
    expect(v.marketIdHex.startsWith("0x")).toBe(true);
  });

  it("mapPositionView", () => {
    const v = mapPositionView(positionFixture);
    expect(v.positionId).toBe(7n);
    expect(v.status).toBe("OPEN");
    expect(v.openedTs).toBe(4n);
  });

  it("mapMarketView", () => {
    const v = mapMarketView(marketFixture);
    expect(v.marketKey).toBe(42n);
    expect(v.outcome).toBeNull();
    expect(v.yesShares).toBe(11n);
    expect(v.noCost).toBe(14n);
  });

  it("mapAccountDataView", () => {
    const v = mapAccountDataView(accountDataFixture);
    expect(v.accountId).toMatch(/^0x/);
    expect(v.orderFront).toBe(1n);
    expect(v.positionBack).toBeNull();
  });

  it("mapCursorView", () => {
    const v = mapCursorView(5n, 2n, null);
    expect(v.count).toBe(5n);
    expect(v.front).toBe(2n);
    expect(v.back).toBeNull();
  });

  it("mapMarketView with outcome", () => {
    const v = mapMarketView({ ...marketFixture, outcome: "Yes" });
    expect(v.outcome).toBe("YES");
  });

  it("mapOrderView with position_id set", () => {
    const v = mapOrderView({ ...orderFixture, position_id: 99n });
    expect(v.positionId).toBe(99n);
  });
});

describe("map enum errors", () => {
  it("rejects unknown variants", () => {
    expect(() => mapSelection("Maybe")).toThrow(/Unknown Selection/);
    expect(() => mapOutcome("Draw")).toThrow(/Unknown Outcome/);
    expect(() => mapOrderKind("Unknown")).toThrow(/Unknown OrderKind/);
    expect(() => mapStatus("Closed")).toThrow(/Unknown Status/);
    expect(() => mapSelection(null)).toThrow(/Unable to decode enum variant/);
  });

  it("rejects empty string selection/outcome kinds", () => {
    expect(() => mapSelection("")).toThrow(/Unknown Selection/);
    expect(() => mapOutcome("")).toThrow(/Unknown Outcome/);
  });

  it("enumKind accepts object keys without $kind", () => {
    expect(mapSelection({ No: true })).toBe("NO");
  });

  it("enumKind throws when variant cannot be resolved", () => {
    expect(() => mapSelection({})).toThrow(/Unable to decode enum variant/);
  });

  it("rejects non-string non-object enum payloads", () => {
    expect(() => mapSelection(1)).toThrow(/Unable to decode enum variant/);
    expect(() => mapOutcome(true)).toThrow(/Unable to decode enum variant/);
  });
});
