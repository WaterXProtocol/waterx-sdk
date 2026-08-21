/**
 * Dry-run oracle aggregate for every configured ticker (markets + pool collaterals).
 *
 * Lazer / quote-center refresh + `refreshOraclePrices` + gRPC simulate — no private key.
 * Output matches the legacy CLI (`--format pretty|raw`, `--help`, `--mainnet`).
 */
import { Transaction } from "@mysten/sui/transactions";

import { DRY_RUN_SENDER } from "../src/constants.ts";
import {
  refreshOraclePrices,
  resolveOracleRule,
  type OracleSource,
  type RuleUpdateData,
  type UpdateDataProvider,
} from "../src/oracle/index.ts";
import { PerpClient } from "../src/perp/client.ts";
import type { Network } from "../src/perp/constants.ts";
import { loadRepoEnvFiles, waterxConfigUrlForNetwork } from "./load-repo-env.ts";

type OutputFormat = "pretty" | "raw";

type TickerFeed = {
  label: string;
  ticker: string;
  aggregatorId: string | undefined;
};

type SuiEventRecord = {
  type?: string;
  eventType?: string;
  moveEventType?: string;
  parsedJson?: unknown;
  json?: unknown;
  event?: { type?: string; eventType?: string; moveEventType?: string };
};

type AggregatedRow = {
  source: string;
  weight: number | null;
  price: string;
};

type AggregatedView = {
  eventType: string;
  aggregatorId: string | undefined;
  symbol: string | undefined;
  threshold: string;
  result: string;
  rows: AggregatedRow[];
  weightsRawNote: string | undefined;
};

const GAS_ORACLE_SCRIPT = 1_200_000_000;

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

function resolveNetwork(argv: string[]): Network {
  if (argv.includes("--testnet")) return "TESTNET";
  if (argv.includes("--mainnet")) return "MAINNET";
  const raw = process.env.WATERX_E2E_NETWORK?.trim().toLowerCase();
  if (raw === "mainnet") return "MAINNET";
  if (raw === "testnet") return "TESTNET";
  return "MAINNET";
}

/** Lazer Bearer token from harness env — SDK never reads process.env itself. */
function resolvePythApiKey(): string | undefined {
  const raw = process.env.PYTH_API_KEY?.trim();
  return raw || undefined;
}

function parseArgs(argv: string[]): {
  format: OutputFormat;
  network: Network;
  tickers: string[];
} {
  const tail = argv.slice(2);
  const tokens = tail[0] && !tail[0].startsWith("-") ? tail.slice(1) : tail;

  let format: OutputFormat = "pretty";
  const network = resolveNetwork(argv);
  const tickers: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]!;
    if (a === "--help" || a === "-h") {
      console.log(`Usage: pnpm oracle:aggregates [-- --format pretty|raw] [--ticker T[,T...]] [--testnet|--mainnet]
       [--oracle-source pyth_lazer_rule|waterx_rule]
       pnpm oracle:aggregates:testnet
       pnpm oracle:aggregates:mainnet

  --format pretty   Human-readable output (default): decoded weights, aligned blocks.
  --format raw      Original debug style (compact JSON, one field per line).
  --ticker T        Only aggregate the given ticker(s). Repeatable and/or comma-separated,
                    e.g. --ticker WTIUSD or --ticker WTIUSD,BTCUSD. Case-insensitive.
                    An unconfigured ticker aborts with the list of valid tickers.
                    Default (omitted): every configured aggregator.
  --testnet         Use TESTNET (pnpm oracle:aggregates:testnet).
  --mainnet         Use MAINNET (default when no network flag).
  --oracle-source   Price-update source(s) — comma-separated list = the fed set

  Network precedence: --testnet / --mainnet → WATERX_E2E_NETWORK → mainnet.
  Lazer token: PYTH_API_KEY (required when the fed set includes pyth_lazer_rule).

  Dry-runs each ticker via gRPC simulateTransaction (no private key, no on-chain execution).
  Before each aggregate, refreshes prices via refreshOraclePrices for the selected
  fed set (pyth_lazer_rule = Lazer signed update; waterx_rule = quote-center
  signed leaves/envelope). There is NO cross-source fallback — a missing feed or
  refresh failure fails the ticker.

  Requires WATERX_CONFIG_URL (or .env). With --mainnet, a URL ending in testnet.json is
  rewritten to mainnet.json (and vice versa for --testnet).

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
      continue;
    }
    if (a === "--ticker" || a === "-t") {
      const v = tokens[i + 1];
      i++;
      if (!v || v.startsWith("-")) {
        console.error(`Missing value for ${a} (expected a ticker, e.g. --ticker WTIUSD)`);
        process.exit(1);
      }
      for (const t of v.split(",")) {
        const trimmed = t.trim().toUpperCase();
        if (trimmed) tickers.push(trimmed);
      }
    }
  }
  return { format, network, tickers };
}

function allTickerFeeds(client: PerpClient): TickerFeed[] {
  const aggregators = client.config.packages.waterx_oracle?.aggregators ?? {};
  const markets = new Set(Object.keys(client.config.packages.waterx_perp?.markets ?? {}));
  const pool = new Set(Object.keys(client.config.packages.wlp?.pool_tokens ?? {}));

  return Object.keys(aggregators)
    .sort()
    .map((ticker) => {
      let label: string;
      if (markets.has(ticker)) label = `MARKET:${ticker}`;
      else if (pool.has(ticker)) label = `COLLATERAL:${ticker}`;
      else label = `TICKER:${ticker}`;
      return { label, ticker, aggregatorId: aggregators[ticker] };
    });
}

function eventPayload(e: SuiEventRecord): unknown {
  return e.parsedJson ?? e.json;
}

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
  const symbol =
    o.symbol != null ? String(o.symbol) : o.ticker != null ? String(o.ticker) : undefined;

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
    symbol,
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
    if (t.includes("aggregator::PriceAggregated") || isAggregatedPayload(eventPayload(e))) {
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
  if (v.symbol) console.log(`  Symbol    ${v.symbol}`);
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

/**
 * Warm ONE payload per listed source covering every ticker this run will
 * aggregate, and serve it to all of them through the SDK's own
 * `UpdateDataProvider` seam — `narrowUpdateData` subsets it per ticker.
 *
 * Without this the script paid one network round trip PER TICKER (~30 on
 * mainnet), sequentially, for data one batched pull already covers. Safe here
 * precisely because these are dry-run simulates: the F-014 replay guard that
 * forbids reusing one signed payload across EXECUTED transactions never
 * applies. A source whose warm pull fails is simply absent from the cache and
 * falls back to per-ticker live fetches (a miss is `null`).
 */
async function prefetchUpdateData(
  client: PerpClient,
  tickers: string[],
): Promise<UpdateDataProvider> {
  const warmed = new Map<OracleSource, RuleUpdateData>();
  await Promise.all(
    client.oracleSources.map(async (source) => {
      const rule = resolveOracleRule(source);
      const supported = new Set(rule.supportedTickers(client));
      const served = tickers.filter((t) => supported.has(t));
      if (served.length === 0) return;
      try {
        warmed.set(source, await rule.fetchUpdateData(client, served));
      } catch (e) {
        console.warn(
          `[prefetch] ${source}: ${e instanceof Error ? e.message : String(e)} — falling back to per-ticker fetches`,
        );
      }
    }),
  );
  return { get: async (source) => warmed.get(source) ?? null };
}

async function runOne(
  client: PerpClient,
  feed: TickerFeed,
  format: OutputFormat,
  updateDataProvider: UpdateDataProvider,
): Promise<boolean> {
  const tx = new Transaction();
  tx.setSender(DRY_RUN_SENDER);
  tx.setGasBudget(GAS_ORACLE_SCRIPT);

  const sep = "─".repeat(72);

  try {
    // No cross-source fallback and no stale-continue: a refresh failure for
    // the fed set fails the ticker (the retired Hermes stale path is gone).
    await refreshOraclePrices(tx, client, [feed.ticker], { updateDataProvider });

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
    const statusLabel = "OK";

    if (format === "pretty") {
      console.log(`\n${sep}`);
      console.log(`[${feed.label}] ${statusLabel}`);
      console.log(`  Ticker      ${feed.ticker}`);
      if (feed.aggregatorId) console.log(`  Aggregator  ${feed.aggregatorId}`);
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
      console.log(`\n[${feed.label}] ${statusLabel}`);
      console.log(`  ticker=${feed.ticker}`);
      console.log(`  aggregator=${feed.aggregatorId ?? "-"}`);
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
      console.log(`  Ticker      ${feed.ticker}`);
      if (feed.aggregatorId) console.log(`  Aggregator  ${feed.aggregatorId}`);
      console.log(`  Error       ${msg}`);
    } else {
      console.log(`\n[${feed.label}] FAILED`);
      console.log(`  ticker=${feed.ticker}`);
      console.log(`  aggregator=${feed.aggregatorId ?? "-"}`);
      console.log(`  error=${msg}`);
    }

    return false;
  }

  return true;
}

async function main() {
  loadRepoEnvFiles();
  const { format, network, tickers } = parseArgs(process.argv);
  const waterxConfigUrl = waterxConfigUrlForNetwork(network);
  const pythApiKey = resolvePythApiKey();
  const client = await PerpClient.create(network, {
    cache: true,
    waterxConfigUrl,
    // The fed set is derived from the loaded config, so a bare invocation
    // reports exactly what that deployment feeds.
    ...(pythApiKey !== undefined ? { pythApiKey } : {}),
  });

  if (client.oracleSources.includes("pyth_lazer_rule") && !pythApiKey) {
    throw new Error(
      "the config wires pyth_lazer_rule but PYTH_API_KEY is unset — set it in the env (or .env.local)",
    );
  }

  let feeds = allTickerFeeds(client);
  if (tickers.length) {
    const available = new Set(feeds.map((f) => f.ticker));
    const unknown = tickers.filter((t) => !available.has(t));
    if (unknown.length) {
      console.error(`Unknown ticker(s): ${unknown.join(", ")}`);
      console.error(`Available tickers: ${[...available].sort().join(", ")}`);
      process.exit(1);
    }
    const want = new Set(tickers);
    feeds = feeds.filter((f) => want.has(f.ticker));
  }
  const modeLabel = format === "pretty" ? "pretty" : "raw";
  console.log(
    `printing oracle aggregates for ${feeds.length} feeds (${modeLabel}, ${client.network}, oracleSource=${client.oracleSources.join(",")})...`,
  );

  const updateDataProvider = await prefetchUpdateData(
    client,
    feeds.map((feed) => feed.ticker),
  );
  let failed = 0;
  for (const feed of feeds) {
    if (!(await runOne(client, feed, format, updateDataProvider))) failed += 1;
  }
  if (failed > 0) {
    console.error(`\n${failed} feed(s) FAILED`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
