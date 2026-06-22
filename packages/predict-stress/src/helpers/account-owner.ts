import type { PredictClient } from "@waterx/sdk/prediction/client";
import { getAccountIds } from "@waterx/sdk/prediction/fetch";
import { resolveAccountPackageId } from "@waterx/sdk/prediction/utils";

import { readFixtureOverrides } from "./e2e-env.ts";
import { hasWriteCredentials, loadSigner } from "./env.ts";

const ownerCache = new Map<string, string | undefined>();

function jsonRpcUrl(client: PredictClient): string {
  const base = client.config.grpcUrl ?? "https://fullnode.testnet.sui.io:443";
  return base.replace(/\/$/, "");
}

interface SuiEventEnvelope {
  parsedJson?: Record<string, unknown>;
  parsed_json?: Record<string, unknown>;
}

async function queryAccountOwnerFromEvents(
  client: PredictClient,
  accountId: string,
): Promise<string | undefined> {
  const cached = ownerCache.get(accountId);
  if (cached !== undefined) return cached || undefined;

  const pkg = resolveAccountPackageId(client);
  const eventType = `${pkg}::events::AccountCreated`;
  const url = jsonRpcUrl(client);

  let cursor: string | null | undefined = null;
  for (let page = 0; page < 20; page++) {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: [{ MoveEventType: eventType }, cursor, 50, false],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      ownerCache.set(accountId, "");
      return undefined;
    }

    const json = (await res.json()) as {
      result?: { data?: SuiEventEnvelope[]; nextCursor?: string | null; hasNextPage?: boolean };
      error?: { message?: string };
    };
    if (json.error) {
      ownerCache.set(accountId, "");
      return undefined;
    }

    for (const event of json.result?.data ?? []) {
      const parsed = (event.parsedJson ?? event.parsed_json) as
        | { owner?: string; account_object_address?: string }
        | undefined;
      const addr = parsed?.account_object_address;
      const owner = parsed?.owner;
      if (addr === accountId && typeof owner === "string" && owner.startsWith("0x")) {
        ownerCache.set(accountId, owner);
        return owner;
      }
    }

    if (!json.result?.hasNextPage) break;
    cursor = json.result.nextCursor ?? null;
  }

  ownerCache.set(accountId, "");
  return undefined;
}

/** Best-effort wallet owner for a registry account id (no private key required). */
export async function tryResolveAccountOwner(
  client: PredictClient,
  accountId: string,
): Promise<string | undefined> {
  const pinnedOwner = readFixtureOverrides().accountOwner;
  if (pinnedOwner) return pinnedOwner;

  if (hasWriteCredentials()) {
    const owner = loadSigner().toSuiAddress();
    const ids = await getAccountIds(client, { owner });
    if (ids.includes(accountId)) return owner;
  }

  const fromEvents = await queryAccountOwnerFromEvents(client, accountId);
  if (fromEvents) return fromEvents;

  return undefined;
}

export async function resolveAccountOwner(
  client: PredictClient,
  accountId: string,
): Promise<string> {
  const owner = await tryResolveAccountOwner(client, accountId);
  if (owner) return owner;

  throw new Error(
    `Could not resolve simulate sender for accountId ${accountId}. ` +
      "Set E2E_ACCOUNT_OWNER in .env or ensure AccountCreated events are indexed on testnet.",
  );
}
