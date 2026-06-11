/** Normalise event `market_id` (hex / utf8 label) for comparison with `OrderView.marketIdHex`. */
export function normalizeEventMarketIdHex(value: unknown): string {
  if (typeof value === "string") {
    const s = value.trim();
    if (s.startsWith("0x")) return s.toLowerCase();
    if (/^[0-9a-f]+$/i.test(s)) return `0x${s.toLowerCase()}`;
    try {
      return `0x${Buffer.from(s, "utf8").toString("hex")}`;
    } catch {
      return s;
    }
  }
  if (value instanceof Uint8Array) {
    return `0x${Buffer.from(value).toString("hex")}`;
  }
  return String(value);
}
