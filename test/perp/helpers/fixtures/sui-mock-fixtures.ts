/**
 * Dummy Sui IDs for offline unit tests. PTB builders do not hit the network;
 * suites that need an off-chain response mock `fetch` themselves.
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

// PTB unit-test recipient/coin IDs + Bucket float stubs: `ptb-test-dummies.ts`
