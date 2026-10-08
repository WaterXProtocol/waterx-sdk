/**
 * THE canonical price-plane wire fixtures + route-aware fetch mock, shared by
 * the `oracle-canonical-*` suites. One copy on purpose (same reasoning as
 * `quote-center.ts`): these bodies pin the SERVICE's exact wire shape from the
 * cross-repo contract (2026-10-08), and the raw-TEXT builder carries the
 * numeric tokens a `JSON.stringify` fixture cannot produce — the u64
 * `*_scaled` literals the SDK must recover as exact strings.
 */
import { vi } from "vitest";

/** The contract's BTCUSD example, as the quote-center would serialise it, with `symbol` substituted. */
const CONTRACT_FIELDS: Record<string, string> = {
  status: '"ok"',
  reason: '""',
  price: "82996.7079006",
  price_scaled: "82996707900600",
  confidence: "24.903161963",
  confidence_scaled: "24903161963",
  timestamp_ms: "1791425996375",
  config_epoch: "1",
  weight_threshold: "1",
  outlier_tolerance: "5000000",
  legs:
    '[{"rule":"waterx","weight":0,"price_scaled":82990000000000,"ts_ms":1791425996000,"status":"ok"},' +
    '{"rule":"pyth_lazer","weight":1,"price_scaled":82996707900600,"ts_ms":1791425996375,"status":"ok"}]',
};

/**
 * Raw TEXT of one canonical object. `overrides` values are spliced in as
 * JSON TOKENS: a string override is emitted verbatim (so `"18446744073709551615"`
 * lands as a bare integer literal and `'"stale"'` as a JSON string), any other
 * value goes through `JSON.stringify`, and `undefined` omits the field.
 */
export function rawCanonicalQuoteText(
  symbol: string,
  overrides: Record<string, unknown> = {},
): string {
  const fields: Record<string, string | undefined> = { symbol: JSON.stringify(symbol) };
  for (const [key, token] of Object.entries(CONTRACT_FIELDS)) fields[key] = token;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete fields[key];
    } else if (typeof value === "string") {
      fields[key] = value;
    } else {
      fields[key] = JSON.stringify(value);
    }
  }
  const body = Object.entries(fields)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, token]) => `${JSON.stringify(key)}:${token}`)
    .join(",");
  return `{${body}}`;
}

/**
 * The same object, parsed — for suites that tamper with VALUES rather than
 * tokens. Here `overrides` are plain values (`{ status: "stale" }`,
 * `{ price: undefined }` to delete), as with `quote-center.ts`'s `rawItem`.
 */
export function rawCanonicalQuote(
  symbol: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const parsed = JSON.parse(rawCanonicalQuoteText(symbol)) as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete parsed[key];
    else parsed[key] = value;
  }
  return parsed;
}

/** A server-side `status: "unavailable"` item — what a batch answers for a symbol it refuses. */
export function rawUnavailableQuote(symbol: string, reason: string): Record<string, unknown> {
  return {
    symbol,
    status: "unavailable",
    reason,
    price: 0,
    price_scaled: 0,
    confidence: 0,
    confidence_scaled: 0,
    timestamp_ms: 0,
    config_epoch: 1,
    weight_threshold: 1,
    outlier_tolerance: 5_000_000,
    legs: [],
  };
}

export interface CanonicalMockRoute {
  status?: number;
  /** Object body — stringified. Use `text` when the exact token matters. */
  body?: unknown;
  /** Verbatim response text. */
  text?: string;
}

function respond(route: CanonicalMockRoute | undefined): Response {
  const status = route?.status ?? (route ? 200 : 404);
  const text =
    route?.text ?? (route?.body === undefined ? "Not Found" : JSON.stringify(route.body));
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text) as unknown,
    headers: new Headers(),
    body: null,
  } as unknown as Response;
}

/**
 * Route-aware canonical mock: the batch route and the per-symbol route each
 * get their own answer, and an unconfigured route 404s anonymously — the way a
 * gateway that does not expose it would. Pathnames are matched by SUFFIX so a
 * proxy base path (`/api/quote-center/v1/canonical`) routes the same.
 */
export function mockCanonicalRoutes(routes: {
  batch?: CanonicalMockRoute;
  single?: (symbol: string) => CanonicalMockRoute | undefined;
}): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input: unknown) => {
    const { pathname } = new URL(String(input));
    if (pathname.endsWith("/v1/canonical")) return Promise.resolve(respond(routes.batch));
    const single = /\/v1\/canonical\/([^/]+)$/.exec(pathname);
    if (single) {
      return Promise.resolve(respond(routes.single?.(decodeURIComponent(single[1]!))));
    }
    return Promise.resolve(respond(undefined));
  }) as ReturnType<typeof vi.spyOn>;
}
