#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import { resolveOwnerRegistryAccountId } from "../helpers/account-funding.ts";
import { apiGet, apiPost } from "../helpers/api-client.ts";
import { inferMarketSegmentFromSlug } from "../helpers/api-contract.ts";
import type { FeedBrowseListData, MarketDetailData } from "../helpers/api-contract.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { buildPlaceBetRequest, pickTradeableSide } from "../helpers/api-tx-build.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import { hasWriteCredentials, loadSigner } from "../helpers/env.ts";

const SEED_PATH = resolve(process.cwd(), "test/prediction/fixtures/testnet-seeded.json");

loadRepoEnvFiles();

async function main(): Promise<void> {
  const env = resolveApiEnvironment();
  if (!env) {
    console.error("No API env");
    process.exit(1);
  }
  if (!hasWriteCredentials()) {
    console.error("SUI_PRIVATE_KEY not set");
    process.exit(1);
  }

  const signer = loadSigner();
  const owner = signer.toSuiAddress();
  const client = await createE2eClient();
  const seed = existsSync(SEED_PATH)
    ? (JSON.parse(readFileSync(SEED_PATH, "utf8")) as { accountId?: string })
    : undefined;
  let accountId = seed?.accountId;
  if (accountId) {
    accountId = await resolveOwnerRegistryAccountId(client, owner, accountId);
  }
  if (!accountId) {
    console.error("No registry accountId for owner", owner);
    process.exit(1);
  }

  const creds = { accountId, sender: owner };
  console.log("API:", env.name, env.baseUrl);
  console.log("creds:", creds);

  for (const segment of ["crypto", "sport"] as const) {
    console.log("\n---", segment, "---");
    const feed = await apiGet<FeedBrowseListData>(env, `/predict/feed?type=${segment}&limit=30`);
    if (feed.status !== 200 || !feed.envelope.success) {
      console.log("feed fail", feed.status, feed.envelope);
      continue;
    }

    for (const item of feed.envelope.data.items) {
      const slug = item.market?.slug;
      if (!slug) continue;
      const seg = inferMarketSegmentFromSlug(slug) ?? segment;
      const detailPath = `/predict/markets/${seg}/${encodeURIComponent(slug)}`;
      const detailRes = await apiGet<MarketDetailData>(env, detailPath);
      if (detailRes.status !== 200 || !detailRes.envelope.success) continue;

      const side = pickTradeableSide(detailRes.envelope.data);
      if (!side) {
        console.log("skip", slug, "- no tradeable side");
        continue;
      }

      console.log("try", slug, {
        key: side.key,
        odds: side.oddsCents,
        marketId: side.trade?.marketId,
        selection: side.trade?.selection,
      });

      const body = buildPlaceBetRequest(creds, side);
      const place = await apiPost(env, "/predict/bets/place", body);
      console.log("POST /predict/bets/place", place.status);
      console.log(JSON.stringify(place.envelope, null, 2));
      if (place.status >= 200 && place.status < 300 && place.envelope.success) return;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
