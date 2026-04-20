import { Transaction } from "@mysten/sui/transactions";
import { buildOracleFeed, WaterXClient } from "@waterx/perp-sdk";

type TokenFeed = {
  label: string;
  tokenType: string;
  aggregatorId: string;
  priceInfoId: string;
};

function allTokenFeeds(client: WaterXClient): TokenFeed[] {
  const marketFeeds = Object.entries(client.config.markets).map(([base, m]) => ({
    label: `MARKET:${base}`,
    tokenType: m.baseType,
    aggregatorId: m.aggregatorId,
    priceInfoId: m.priceInfoId,
  }));
  const collateralFeeds = Object.entries(client.config.collaterals).map(([asset, c]) => ({
    label: `COLLATERAL:${asset}`,
    tokenType: c.type,
    aggregatorId: c.aggregatorId,
    priceInfoId: c.priceInfoId,
  }));
  return [...marketFeeds, ...collateralFeeds];
}

function short(v: string, n = 10): string {
  return `${v.slice(0, n)}...${v.slice(-6)}`;
}

function printAggregatedEvent(ev: any) {
  const typeText =
    ev?.type ?? ev?.eventType ?? ev?.moveEventType ?? ev?.event?.type ?? "(unknown-event-type)";
  const parsed =
    ev?.parsedJson ??
    ev?.parsed_json ??
    ev?.event?.parsedJson ??
    ev?.event?.parsed_json ??
    ev?.json ??
    null;
  if (!parsed) {
    console.log(`- ${typeText}: no parsed payload`);
    return;
  }

  const sources = (parsed.sources ?? []) as string[];
  const prices = (parsed.prices ?? []) as Array<string | number | bigint>;
  const weights = (parsed.weights ?? []) as Array<string | number | bigint>;
  const result = parsed.result;
  const threshold = parsed.current_threshold ?? parsed.currentThreshold;

  console.log(`- ${typeText}`);
  console.log(`  threshold=${String(threshold)} result=${String(result)}`);
  for (let i = 0; i < sources.length; i++) {
    console.log(
      `    source=${sources[i]} weight=${String(weights[i] ?? "-")} price=${String(prices[i] ?? "-")}`,
    );
  }
}

async function runOne(client: WaterXClient, f: TokenFeed) {
  const tx = new Transaction();
  tx.setSender("0x1111111111111111111111111111111111111111111111111111111111111111");
  tx.setGasBudget(250_000_000);
  buildOracleFeed(client, tx, f.tokenType, f.aggregatorId, f.priceInfoId);

  const result: any = await client.grpcClient.simulateTransaction({
    transaction: tx,
    include: { commandResults: true, effects: true, events: true },
  });
  if (result?.$kind === "FailedTransaction") {
    const err = result?.FailedTransaction?.status?.error;
    const msg = typeof err === "string" ? err : (err?.message ?? JSON.stringify(err));
    console.log(`\n[${f.label}] FAILED`);
    console.log(`  token=${f.tokenType}`);
    console.log(`  aggregator=${f.aggregatorId}`);
    console.log(`  error=${msg}`);
    return;
  }

  const events: any[] = result?.Transaction?.events ?? [];
  const aggEvents = events.filter((e) => {
    const t = String(e?.type ?? e?.eventType ?? e?.moveEventType ?? "");
    return t.includes("bucket_v2_oracle::aggregator::PriceAggregated");
  });
  console.log(`\n[${f.label}] OK`);
  console.log(`  token=${f.tokenType}`);
  console.log(`  aggregator=${f.aggregatorId}`);
  console.log(`  PriceAggregated events=${aggEvents.length}`);
  for (const ev of aggEvents) {
    printAggregatedEvent(ev);
  }
}

async function main() {
  const client = WaterXClient.testnet();
  const feeds = allTokenFeeds(client);
  console.log(`checking ${feeds.length} feeds...\n`);
  for (const f of feeds) {
    console.log(`- ${f.label} token=${short(f.tokenType)} agg=${short(f.aggregatorId)}`);
  }
  console.log("");

  for (const f of feeds) {
    await runOne(client, f);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
