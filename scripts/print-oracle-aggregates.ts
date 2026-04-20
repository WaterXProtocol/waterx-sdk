import { Transaction } from "@mysten/sui/transactions";
import {
  buildOracleFeed,
  PYTH_PRICE_FEED_IDS,
  PYTH_TESTNET_FEED_IDS,
  updatePythPrices,
  WaterXClient,
} from "@waterx/perp-sdk";

const network = process.argv.includes("--mainnet") ? "mainnet" : "testnet";
const client = network === "mainnet" ? WaterXClient.mainnet() : WaterXClient.testnet();
const DUMMY_SENDER = "0x1111111111111111111111111111111111111111111111111111111111111111";

type TokenFeed = {
  label: string;
  tokenType: string;
  aggregatorId: string;
  priceInfoId: string;
  /** Pyth price feed id for Hermes (no `0x` prefix); used with `updatePythPrices`. */
  pythFeedId: string | undefined;
};

function pythFeedIdTable(): Record<string, string> {
  return client.config.network === "TESTNET" ? PYTH_TESTNET_FEED_IDS : PYTH_PRICE_FEED_IDS;
}

type OutputFormat = "pretty" | "raw";

type SuiEventRecord = {
  type?: string;
  /** gRPC simulate / some RPC shapes use this instead of `type` */
  eventType?: string;
  moveEventType?: string;
  parsedJson?: unknown;
  json?: unknown;
  event?: { type?: string; eventType?: string; moveEventType?: string };
};

/** Match `signAndExecute` and gRPC simulate event shapes (field names differ by API). */
function eventRecordType(e: SuiEventRecord | Record<string, unknown>): string {
  const o = e as Record<string, unknown>;
  const direct =
    o.type ??
    o.eventType ??
    o.moveEventType ??
    (typeof o.event_type === "string" ? o.event_type : undefined) ??
    (typeof o.move_event_type === "string" ? o.move_event_type : undefined);
  if (typeof direct === "string" && direct) return direct;
  const inner = o.event;
  if (inner && typeof inner === "object") {
    const ie = inner as Record<string, unknown>;
    const nested =
      ie.type ??
      ie.eventType ??
      ie.moveEventType ??
      (typeof ie.event_type === "string" ? ie.event_type : undefined) ??
      (typeof ie.move_event_type === "string" ? ie.move_event_type : undefined);
    if (typeof nested === "string" && nested) return nested;
  }
  return "";
}

type AggregatedRow = {
  source: string;
  weight: number | null;
  price: string;
};

type AggregatedView = {
  eventType: string;
  aggregatorId: string | undefined;
  threshold: string;
  result: string;
  rows: AggregatedRow[];
  weightsRawNote: string | undefined;
};

function parseArgs(argv: string[]): OutputFormat {
  const tail = argv.slice(2);
  const tokens = tail[0] && !tail[0].startsWith("-") ? tail.slice(1) : tail;

  let format: OutputFormat = "pretty";
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]!;
    if (a === "--help" || a === "-h") {
      console.log(`Usage: tsx scripts/print-oracle-aggregates.ts [--format pretty|raw]

  --format pretty   Human-readable output (default): decoded weights, aligned blocks.
  --format raw      Original debug style (compact JSON, one field per line).

  Dry-runs each feed via gRPC simulateTransaction (no private key, no on-chain execution).
  Before each aggregate, refreshes Pyth via Hermes (same PTB as buildOracleFeed), so
  Pyth is not dropped as stale when Supra is still accepted.

  -h, --help        Show this message.`);
      process.exit(0);
    }
    if (a === "--format" || a === "-f") {
      const v = tokens[i + 1]?.toLowerCase();
      i++;
      if (v === "pretty" || v === "raw") format = v;
      else {
        console.error(`Unknown --format value (use pretty or raw): ${v ?? "(missing)"}`);
        process.exit(1);
      }
    }
  }
  return format;
}

function allTokenFeeds(): TokenFeed[] {
  const ids = pythFeedIdTable();
  const marketFeeds = Object.entries(client.config.markets).map(([base, m]) => ({
    label: `MARKET:${base}`,
    tokenType: m.baseType,
    aggregatorId: m.aggregatorId,
    priceInfoId: m.priceInfoId,
    pythFeedId: ids[m.feedKey]?.replace(/^0x/, ""),
  }));
  const collateralFeeds = Object.entries(client.config.collaterals).map(([asset, c]) => ({
    label: `COLLATERAL:${asset}`,
    tokenType: c.type,
    aggregatorId: c.aggregatorId,
    priceInfoId: c.priceInfoId,
    pythFeedId: ids[c.feedKey]?.replace(/^0x/, ""),
  }));
  return [...marketFeeds, ...collateralFeeds];
}

function eventPayload(e: SuiEventRecord): unknown {
  return e.parsedJson ?? e.json;
}

/** Sui JSON often encodes `vector<u8>` as a Base64 string instead of a number[]. */
function decodeWeightBytes(weights: unknown): number[] | null {
  if (weights == null) return null;
  if (Array.isArray(weights)) {
    const out: number[] = [];
    for (const w of weights) {
      const n = typeof w === "number" ? w : Number(w);
      if (!Number.isFinite(n)) return null;
      out.push(n);
    }
    return out;
  }
  if (typeof weights === "string") {
    try {
      return [...Buffer.from(weights, "base64")];
    } catch {
      return null;
    }
  }
  return null;
}

function isAggregatedPayload(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const w = o.weights;
  const weightsOk = typeof w === "string" || (Array.isArray(w) && w.length >= 0);
  return (
    Array.isArray(o.sources) &&
    Array.isArray(o.prices) &&
    weightsOk &&
    (o.current_threshold !== undefined || o.currentThreshold !== undefined) &&
    o.result !== undefined
  );
}

function parseAggregatedView(ev: SuiEventRecord): AggregatedView | null {
  const parsed = eventPayload(ev);
  if (!parsed || typeof parsed !== "object") return null;
  if (!isAggregatedPayload(parsed)) return null;

  const o = parsed as Record<string, unknown>;
  const sources = (o.sources as unknown[]).map(String);
  const prices = (o.prices as unknown[]).map(String);
  const weightBytes = decodeWeightBytes(o.weights);
  const threshold = String(o.current_threshold ?? o.currentThreshold ?? "-");
  const result = String(o.result ?? "-");
  const aggregatorId =
    o.aggregator_id != null
      ? String(o.aggregator_id)
      : o.aggregatorId != null
        ? String(o.aggregatorId)
        : undefined;

  const rows: AggregatedRow[] = [];
  let weightsRawNote: string | undefined;

  for (let i = 0; i < sources.length; i++) {
    let w: number | null = null;
    if (weightBytes?.length) {
      if (weightBytes.length === sources.length) w = weightBytes[i]!;
      else if (weightBytes.length === 1) w = weightBytes[0]!;
      else if (i < weightBytes.length) w = weightBytes[i]!;
    }
    rows.push({
      source: sources[i] ?? "-",
      weight: w,
      price: prices[i] ?? "-",
    });
  }

  if (!weightBytes?.length) {
    weightsRawNote = `weights raw: ${JSON.stringify(o.weights)}`;
  } else if (weightBytes.length !== sources.length && weightBytes.length !== 1) {
    weightsRawNote = `weights bytes [${weightBytes.join(", ")}] (length ${weightBytes.length} ≠ ${sources.length} sources)`;
  }

  return {
    eventType: eventRecordType(ev) || "(unknown type)",
    aggregatorId,
    threshold,
    result,
    rows,
    weightsRawNote,
  };
}

function getAggregatedViews(events: SuiEventRecord[]): AggregatedView[] {
  const out: AggregatedView[] = [];
  for (const e of events) {
    const t = eventRecordType(e);
    if (
      t.includes("bucket_v2_oracle::aggregator::PriceAggregated") ||
      isAggregatedPayload(eventPayload(e))
    ) {
      const v = parseAggregatedView(e);
      if (v) out.push(v);
    }
  }
  return out;
}

function printAggregatedRaw(ev: SuiEventRecord) {
  const parsed = (eventPayload(ev) ?? {}) as Record<string, unknown>;
  const sources = ((parsed.sources ?? []) as unknown[]).map(String);
  const prices = ((parsed.prices ?? []) as unknown[]).map(String);
  const threshold = String(parsed.current_threshold ?? parsed.currentThreshold ?? "-");
  const result = String(parsed.result ?? "-");
  const wb = decodeWeightBytes(parsed.weights);
  const weightsAsPrinted = JSON.stringify(parsed.weights);

  console.log(`  event=${eventRecordType(ev) || "(unknown type)"}`);
  console.log(`  threshold=${threshold} result=${result}`);
  for (let i = 0; i < sources.length; i++) {
    const u8 =
      wb && wb.length === sources.length
        ? wb[i]
        : wb && wb.length === 1
          ? wb[0]
          : wb && i < wb.length
            ? wb[i]
            : undefined;
    const weightField =
      u8 !== undefined
        ? `weights=${weightsAsPrinted} u8[${i}]=${u8}`
        : `weights=${weightsAsPrinted}`;
    console.log(`    source=${sources[i] ?? "-"} ${weightField} price=${prices[i] ?? "-"}`);
  }
}

function shortTypeName(full: string): string {
  const parts = full.split("::");
  return parts.length >= 2 ? parts.slice(-2).join("::") : full;
}

function printAggregatedPretty(v: AggregatedView) {
  console.log(`  Event     ${v.eventType}`);
  if (v.aggregatorId) console.log(`  Agg ID    ${v.aggregatorId}`);
  console.log(`  Threshold ${v.threshold}`);
  console.log(`  Result    ${v.result}`);
  if (v.weightsRawNote) console.log(`  Note      ${v.weightsRawNote}`);
  console.log(`  Sources (${v.rows.length}):`);
  v.rows.forEach((r, i) => {
    const w = r.weight != null ? String(r.weight) : "?";
    console.log(`    [${i + 1}] ${shortTypeName(r.source)}`);
    console.log(`        weight  ${w}`);
    console.log(`        price   ${r.price}`);
  });
}

function formatErrorMessage(msg: string): string {
  try {
    return decodeURIComponent(msg.replace(/\+/g, " "));
  } catch {
    return msg;
  }
}

function extractSimulateFailureMessage(result: unknown): string {
  const r = result as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: string | { message?: string } | unknown } };
  };
  if (r.$kind !== "FailedTransaction") return "";
  const err = r.FailedTransaction?.status?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? err);
  }
  return JSON.stringify(r.FailedTransaction ?? result);
}

function eventsFromSimulateResult(result: unknown): SuiEventRecord[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  if (r.$kind === "FailedTransaction") return [];
  const inner = r.Transaction;
  if (inner && typeof inner === "object") {
    const ev = (inner as Record<string, unknown>).events;
    if (Array.isArray(ev)) return ev as SuiEventRecord[];
  }
  if (Array.isArray(r.events)) return r.events as SuiEventRecord[];
  return [];
}

const GAS_ORACLE_SCRIPT = 280_000_000;

async function runOne(feed: TokenFeed, format: OutputFormat) {
  const tx = new Transaction();
  tx.setSender(DUMMY_SENDER);
  tx.setGasBudget(GAS_ORACLE_SCRIPT);

  const sep = "─".repeat(72);

  try {
    const pythCfg = client.config.pythConfig;
    if (pythCfg && feed.pythFeedId) {
      try {
        await updatePythPrices(tx, client.grpcClient, pythCfg, [feed.pythFeedId]);
      } catch {
        // Same as addPriceFeeds: Hermes flaky — still feed on-chain Pyth + Supra below.
      }
    }

    buildOracleFeed(client, tx, feed.tokenType, feed.aggregatorId, feed.priceInfoId);

    const res = await client.grpcClient.simulateTransaction({
      transaction: tx,
      include: { commandResults: true, effects: true, events: true },
    });
    if (
      res &&
      typeof res === "object" &&
      (res as { $kind?: string }).$kind === "FailedTransaction"
    ) {
      throw new Error(extractSimulateFailureMessage(res) || "simulateTransaction failed");
    }
    const events = eventsFromSimulateResult(res);
    let views = getAggregatedViews(events);

    if (format === "pretty") {
      console.log(`\n${sep}`);
      console.log(`[${feed.label}] OK`);
      console.log(`  Token       ${feed.tokenType}`);
      console.log(`  Aggregator  ${feed.aggregatorId}`);
      if (!views.length && events.length) {
        const v = parseAggregatedView(events[0]!);
        if (v) views = [v];
      }
      if (!views.length) {
        console.log(`  (no PriceAggregated-shaped events; ${events.length} event(s) total)`);
        if (events.length) {
          const sample = events[0] as Record<string, unknown>;
          console.log(`  first-event keys: ${Object.keys(sample).join(", ")}`);
          const payload = eventPayload(events[0]!);
          if (payload != null)
            console.log(`  first-event json:\n${JSON.stringify(payload, null, 2)}`);
        }
      } else {
        for (const v of views) {
          console.log("");
          printAggregatedPretty(v);
        }
      }
    } else {
      console.log(`\n[${feed.label}] OK`);
      console.log(`  token=${feed.tokenType}`);
      console.log(`  aggregator=${feed.aggregatorId}`);
      if (!views.length && events.length) {
        const v = parseAggregatedView(events[0]!);
        if (v) views = [v];
      }
      if (!views.length) {
        console.log(`  events=${events.length}, PriceAggregated events: none`);
        if (events.length) {
          const sample = events[0] as Record<string, unknown>;
          console.log(`  first-event keys=${Object.keys(sample).join(", ")}`);
          const payload = eventPayload(events[0]!);
          if (payload != null) {
            console.log(`  first-event json=${JSON.stringify(payload)}`);
          }
        }
      } else {
        for (const ev of events) {
          if (parseAggregatedView(ev)) printAggregatedRaw(ev);
        }
      }
    }
  } catch (e) {
    const rawMsg = e instanceof Error ? e.message : String(e);
    const msg = format === "pretty" ? formatErrorMessage(rawMsg) : rawMsg;
    if (format === "pretty") {
      console.log(`\n${sep}`);
      console.log(`[${feed.label}] FAILED`);
      console.log(`  Token       ${feed.tokenType}`);
      console.log(`  Aggregator  ${feed.aggregatorId}`);
      console.log(`  Error       ${msg}`);
    } else {
      console.log(`\n[${feed.label}] FAILED`);
      console.log(`  token=${feed.tokenType}`);
      console.log(`  aggregator=${feed.aggregatorId}`);
      console.log(`  error=${msg}`);
    }
  }
}

async function main() {
  const format = parseArgs(process.argv);
  const feeds = allTokenFeeds();
  const modeLabel = format === "pretty" ? "pretty" : "raw";
  console.log(`printing oracle aggregates for ${feeds.length} feeds (${modeLabel})...`);
  for (const feed of feeds) {
    await runOne(feed, format);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
