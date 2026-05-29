import {
  AccountDataViewBcs,
  mapAccountDataView,
  mapMarketView,
  mapOrderView,
  mapPositionView,
  mapRegistryView,
  MarketViewBcs,
  OrderViewBcs,
  PositionViewBcs,
  RegistryViewBcs,
} from "~predict/bcs.ts";
import { describe, expect, it } from "vitest";

import {
  accountDataFixture,
  marketFixture,
  orderFixture,
  positionFixture,
  registryFixture,
} from "../fixtures/bcs-fixtures.ts";

function toBytes(value: Uint8Array | { toBytes(): Uint8Array }): Uint8Array {
  return value instanceof Uint8Array ? value : value.toBytes();
}

describe("BCS serialize → parse → map roundtrip", () => {
  it("RegistryView", () => {
    const bytes = toBytes(RegistryViewBcs.serialize(registryFixture));
    const mapped = mapRegistryView(RegistryViewBcs.parse(bytes));
    expect(mapped).toEqual(mapRegistryView(registryFixture));
  });

  it("OrderView with enum wire shapes", () => {
    const wire = {
      ...orderFixture,
      kind: { Open: true },
      selection: { Yes: true },
    };
    const bytes = toBytes(OrderViewBcs.serialize(wire));
    const mapped = mapOrderView(OrderViewBcs.parse(bytes));
    expect(mapped).toEqual(mapOrderView(orderFixture));
    expect(mapped.kind).toBe("OPEN");
    expect(mapped.selection).toBe("YES");
  });

  it("PositionView", () => {
    const wire = {
      ...positionFixture,
      selection: { No: true },
      status: { PendingClose: true },
    };
    const bytes = toBytes(PositionViewBcs.serialize(wire));
    const mapped = mapPositionView(PositionViewBcs.parse(bytes));
    expect(mapped.selection).toBe("NO");
    expect(mapped.status).toBe("PENDING_CLOSE");
    expect(mapped.marketIdHex).toBe(mapPositionView(positionFixture).marketIdHex);
  });

  it("MarketView with resolved Invalid outcome", () => {
    const wire = {
      ...marketFixture,
      resolved: true,
      outcome: { Invalid: true },
    };
    const bytes = toBytes(MarketViewBcs.serialize(wire));
    const mapped = mapMarketView(MarketViewBcs.parse(bytes));
    expect(mapped.outcome).toBe("INVALID");
    expect(mapped.resolved).toBe(true);
  });

  it("AccountDataView", () => {
    const bytes = toBytes(AccountDataViewBcs.serialize(accountDataFixture));
    const mapped = mapAccountDataView(AccountDataViewBcs.parse(bytes));
    expect(mapped).toEqual(mapAccountDataView(accountDataFixture));
  });
});
