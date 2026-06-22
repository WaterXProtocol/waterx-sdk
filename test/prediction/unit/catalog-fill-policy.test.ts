import { afterEach, describe, expect, it } from "vitest";

import {
  CatalogBrokerFillTimeoutError,
  catalogFillBrokerOnly,
  hasCatalogKeeperFallbackEnabled,
} from "../helpers/catalog-fill-policy.ts";

describe("catalog-fill-policy", () => {
  afterEach(() => {
    delete process.env.E2E_CATALOG_KEEPER_FALLBACK;
  });

  it("defaults to broker-only staging fills", () => {
    expect(hasCatalogKeeperFallbackEnabled()).toBe(false);
    expect(catalogFillBrokerOnly()).toBe(true);
  });

  it("E2E_CATALOG_KEEPER_FALLBACK=1 enables keeper fallback", () => {
    process.env.E2E_CATALOG_KEEPER_FALLBACK = "1";
    expect(hasCatalogKeeperFallbackEnabled()).toBe(true);
    expect(catalogFillBrokerOnly()).toBe(false);
  });

  it("explicit brokerOnly overrides env", () => {
    process.env.E2E_CATALOG_KEEPER_FALLBACK = "1";
    expect(catalogFillBrokerOnly(true)).toBe(true);
    expect(catalogFillBrokerOnly(false)).toBe(false);
  });

  it("CatalogBrokerFillTimeoutError mentions keeper fallback env", () => {
    const err = new CatalogBrokerFillTimeoutError(42n, 30_000);
    expect(err.message).toContain("E2E_CATALOG_KEEPER_FALLBACK=1");
    expect(err.orderId).toBe(42n);
  });
});
