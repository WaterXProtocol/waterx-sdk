/**
 * Dummy Sui IDs and a non-routable Hermes URL for offline unit tests.
 * Pyth-related tests mock `fetch`; PTB builders do not hit the network.
 */

const BYTE2 = /^[0-9a-f]{2}$/i;

/**
 * `0x` + single byte repeated 32 times (uniform 32-byte address), e.g. `mockSuiAddress("ab")` → `0xabab…`.
 */
export function mockSuiAddress(twoHexDigits: string): string {
  const b = twoHexDigits.replace(/^0x/i, "").toLowerCase();
  if (!BYTE2.test(b)) {
    throw new Error(
      `mockSuiAddress: expected one byte like "a1", got ${JSON.stringify(twoHexDigits)}`,
    );
  }
  return `0x${b.repeat(32)}`;
}

/**
 * `0x` + `headByte` + `pairByte` repeated 31 times (32 bytes total).
 * Used where tests previously used `0x71` + `11`×31-style IDs.
 */
export function mockSuiAddrHeadPair(headByte: string, pairByte: string): string {
  const h = headByte.replace(/^0x/i, "").toLowerCase();
  const p = pairByte.replace(/^0x/i, "").toLowerCase();
  if (!BYTE2.test(h) || !BYTE2.test(p)) {
    throw new Error(
      "mockSuiAddrHeadPair: headByte and pairByte must each be one byte (two hex digits)",
    );
  }
  return `0x${h}${p.repeat(31)}`;
}

/** Full Move type string for a Pyth price table dynamic field row in mocks. */
export function mockPythPriceIdentifierType(packageAddress: string): string {
  return `${packageAddress}::price_identifier::PriceIdentifier`;
}

/**
 * Hermes REST origin for tests. **Not a real service** — pair with mocked `fetch` or unused code paths.
 */
export const MOCK_HERMES_URL = "https://hermes.test.invalid";

/** Default “package id” strings embedded in `createMockGrpcForPythBuild`-style mocks. */
export const MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT = mockSuiAddress("1a");
export const MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT = mockSuiAddress("de");

const MOCK_PYTH_PRICE_TABLE_PKG = mockSuiAddress("fe");

/** Default `valueType` for price table rows in grpc mocks. */
export const DEFAULT_MOCK_PYTH_ROW_TYPE = mockPythPriceIdentifierType(MOCK_PYTH_PRICE_TABLE_PKG);

// PTB unit-test recipient/coin IDs + Bucket float stubs: `ptb-test-dummies.ts`
