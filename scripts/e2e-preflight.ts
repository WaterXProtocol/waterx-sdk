/**
 * Preflight checks for `pnpm test:e2e` skip-prone prerequisites.
 *
 * Usage:
 *   pnpm e2e:preflight
 *   pnpm e2e:preflight -- --owner 0x...
 *   pnpm e2e:preflight -- --allow-oracle-transient
 *   pnpm e2e:preflight -- --allow-missing-positions
 *     (treat missing recent open positions as non-blocking — local/optional only; CI is strict)
 *   pnpm e2e:preflight -- --allow-missing-tto-split
 *     (fewer than 2 funded TTO USDC coins — non-blocking; CI has no key to run e2e:prepare; tests skip as needed)
 *   pnpm e2e:preflight -- --allow-cooldown-not-elapsed
 *     (per-market cooldown after last position change — non-blocking; shared testnet account can be “hot”)
 *   pnpm e2e:preflight -- --allow-missing-wlp
 *     (wallet WLP / per-collateral coins — non-blocking only with this flag; CI uses strict preflight)
 *   pnpm e2e:preflight -- --no-update-local-fixed-positions
 *     (skip writing `.e2e-fixed-positions.local.json`; default on local success is to refresh it)
 *
 * Oracle path: one `buildOpenPositionTx` + simulate per enabled lifecycle base (same set as cooldown /
 * position checks), not a single hard-coded market.
 */
import { pathToFileURL } from "node:url";

import {
  getAccountBalance,
  getAccountCoins,
  getMarketCooldownMs,
  WaterXClient,
} from "../src/index.ts";
import { buildOpenPositionTx } from "../src/tx-builders.ts";
import {
  persistE2eFixedPositionsLocal,
  shouldAutoPersistLocalFixedPositions,
} from "../test/helpers/e2e-fixed-positions-persist.ts";
import { collectE2eWlpReadinessIssues } from "../test/helpers/e2e-wlp-readiness.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "../test/helpers/integration-reference-wallet.ts";
import { activeLifecycleTestBases, lifecycleRow } from "../test/helpers/lifecycle-test-markets.ts";
import { resolveE2eOpenPosition } from "../test/helpers/resolve-e2e-open-position.ts";
import { resolveE2eAccountForOwner } from "../test/helpers/resolve-e2e-reference-account.ts";

export type CheckStatus = "OK" | "FAIL";
export type CheckKind =
  | "user_account_missing"
  | "tto_coin_split"
  | "recent_position_missing"
  | "cooldown_not_elapsed"
  | "oracle_transient"
  | "oracle_other"
  | "wlp_readiness"
  | "info";

export type CheckRow = {
  name: string;
  status: CheckStatus;
  kind: CheckKind;
  detail: string;
  action?: string;
  base?: string;
  cooldownMs?: string;
};

export type PreflightResult = {
  owner: string;
  accountId?: string;
  rows: CheckRow[];
  okCount: number;
  failCount: number;
  blockingFailCount: number;
  nonBlockingFailCount: number;
};

function parseOwnerArg(argv: string[]): string {
  const idx = argv.findIndex((a) => a === "--owner");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1]!;
  return INTEGRATION_REFERENCE_WALLET_ADDRESS;
}

function simErr(result: any): string {
  const raw = result?.FailedTransaction?.status?.error;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) return String(raw.message ?? raw);
  return JSON.stringify(raw ?? result?.FailedTransaction ?? result);
}

function isOracleTransient(msg: string): boolean {
  return (
    msg.includes("err_total_weight_not_enough") ||
    msg.includes("::supra_rule::feed") ||
    msg.includes("::pyth_rule::feed")
  );
}

function cooldownElapsed(updateTimestampMs: bigint, cooldownMs: bigint, slackMs = 750): boolean {
  const eligibleAt = Number(updateTimestampMs) + Number(cooldownMs) + slackMs;
  return Date.now() >= eligibleAt;
}

function printRows(rows: CheckRow[]) {
  for (const r of rows) {
    const head = r.status === "OK" ? "[OK]  " : "[FAIL]";
    console.log(`${head} ${r.name} — ${r.detail}`);
    if (r.action) console.log(`       fix: ${r.action}`);
  }
}

/** stderr: grouped FAIL rows + typical local commands (CI strict mode / copy-paste). */
function printRemediationGuide(rows: CheckRow[]) {
  const fails = rows.filter((r) => r.status === "FAIL");
  if (!fails.length) return;
  const lines: string[] = [
    "",
    "========== Preflight failed — satisfy checks from a trusted machine (integration wallet) ==========",
    "",
  ];
  for (const r of fails) {
    lines.push(`• ${r.name}`);
    lines.push(`  ${r.detail}`);
    if (r.action) lines.push(`  → ${r.action}`);
    lines.push("");
  }
  lines.push(
    "--- Typical repo-root commands (requires WATERX_INTEGRATION_PRIVATE_KEY or keystore) ---",
  );
  lines.push(
    "  pnpm e2e:prepare                      # TTO USDC split, wallet WLP/collateral top-up, cooldown wait",
  );
  lines.push(
    "  pnpm e2e:bootstrap-positions          # Open lifecycle positions missing on reference account",
  );
  lines.push(
    "  pnpm test:integration:persistent-state # Perp slots + WLP maintenance (optional but thorough)",
  );
  lines.push(
    "  pnpm create-testnet-account           # If reference owner has no WaterX UserAccount",
  );
  lines.push("  pnpm diagnose:positions               # Inspect / refresh pinned position ids");
  lines.push("Then re-run: pnpm e2e:preflight   (or push again so CI re-runs test:ci:e2e)");
  lines.push("================================================================================");
  lines.push("");
  console.error(lines.join("\n"));
}

function isNonBlockingFail(
  r: CheckRow,
  opts: {
    allowOracleTransient: boolean;
    allowMissingPositions: boolean;
    allowMissingWlp: boolean;
    allowMissingTtoSplit: boolean;
    allowCooldownNotElapsed: boolean;
  },
): boolean {
  if (r.status !== "FAIL") return false;
  if (opts.allowOracleTransient && r.kind === "oracle_transient") return true;
  if (opts.allowMissingPositions && r.kind === "recent_position_missing") return true;
  if (opts.allowMissingWlp && r.kind === "wlp_readiness") return true;
  if (opts.allowMissingTtoSplit && r.kind === "tto_coin_split") return true;
  if (opts.allowCooldownNotElapsed && r.kind === "cooldown_not_elapsed") return true;
  return false;
}

export async function runPreflight(
  owner: string,
  options?: {
    allowOracleTransient?: boolean;
    allowMissingPositions?: boolean;
    allowMissingWlp?: boolean;
    allowMissingTtoSplit?: boolean;
    allowCooldownNotElapsed?: boolean;
  },
): Promise<PreflightResult> {
  const allowOracleTransient = options?.allowOracleTransient ?? false;
  const allowMissingPositions = options?.allowMissingPositions ?? false;
  const allowMissingWlp = options?.allowMissingWlp ?? false;
  const allowMissingTtoSplit = options?.allowMissingTtoSplit ?? false;
  const allowCooldownNotElapsed = options?.allowCooldownNotElapsed ?? false;
  const client = WaterXClient.testnet();
  const rows: CheckRow[] = [];

  let accountId: string;
  try {
    accountId = await resolveE2eAccountForOwner(client, owner);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const pinHint =
      msg.includes("INTEGRATION_REFERENCE_USER_ACCOUNT_ID") ||
      msg.includes("WATERX_INTEGRATION_ACCOUNT_ID");
    rows.push({
      name: "WaterX UserAccount exists",
      status: "FAIL",
      kind: "user_account_missing",
      detail: msg,
      action: pinHint
        ? "Update `INTEGRATION_REFERENCE_USER_ACCOUNT_ID` / `.env` pin, or fix on-chain account ownership."
        : "Run `pnpm create-testnet-account` (or use --owner with the integration reference wallet).",
    });
    return {
      owner,
      rows,
      okCount: 0,
      failCount: 1,
      blockingFailCount: 1,
      nonBlockingFailCount: 0,
    };
  }

  rows.push({
    name: "WaterX UserAccount exists",
    status: "OK",
    kind: "info",
    detail: `accountId=${accountId}`,
  });

  const usdcType = client.config.collaterals.USDC.type;
  const usdcCoins = await getAccountCoins(client, accountId, usdcType);
  const usdcBalance = await getAccountBalance(client, accountId, usdcType);
  const minFundedPerCoin = activeLifecycleTestBases().reduce((acc, base) => {
    const inc = lifecycleRow(base).e2ePtb.increaseCollateral;
    return inc > acc ? inc : acc;
  }, 5_000_000n);
  const fundedCoinCount = usdcCoins.filter((c) => BigInt(c.balance) >= minFundedPerCoin).length;
  if (fundedCoinCount >= 2) {
    rows.push({
      name: "TTO USDC coin split readiness",
      status: "OK",
      kind: "info",
      detail: `fundedCoins>=${minFundedPerCoin}: ${fundedCoinCount} (balance=${usdcBalance})`,
    });
  } else {
    rows.push({
      name: "TTO USDC coin split readiness",
      status: "FAIL",
      kind: "tto_coin_split",
      detail: `need >=2 funded TTO coins (>=${minFundedPerCoin}), now=${fundedCoinCount} (balance=${usdcBalance})`,
      action: "Deposit/split USDC into at least 2 TTO coin objects (or run `pnpm e2e:prepare`).",
    });
  }

  {
    const wlpIssues = await collectE2eWlpReadinessIssues(client, owner);
    if (wlpIssues.length === 0) {
      rows.push({
        name: "WLP e2e wallet readiness",
        status: "OK",
        kind: "info",
        detail: "wallet WLP + configured collaterals meet mint/redeem simulate thresholds",
      });
    } else {
      for (const issue of wlpIssues) {
        const label =
          issue.kind === "wlp_wallet"
            ? "WLP wallet (redeem simulate)"
            : `Wallet ${issue.collateral ?? "?"} (mint simulate)`;
        rows.push({
          name: label,
          status: "FAIL",
          kind: "wlp_readiness",
          detail: issue.detail,
          action:
            "Run `pnpm e2e:prepare` (needs integration key) or fund the reference wallet with WLP / collateral coins.",
        });
      }
    }
  }

  for (const base of activeLifecycleTestBases()) {
    const openHit = await resolveE2eOpenPosition(client, accountId, base);
    if (!openHit) {
      rows.push({
        name: `${base} recent open position`,
        status: "FAIL",
        kind: "recent_position_missing",
        base,
        detail: "No recent open position owned by this account",
        action: `Run \`pnpm e2e:bootstrap-positions\` (or integration persistent-state) to create ${base} slot.`,
      });
      continue;
    }

    const m = client.getMarketEntry(base);
    const cooldownMs = await getMarketCooldownMs(client, m.marketId);
    if (cooldownMs === 0n || cooldownElapsed(openHit.info.updateTimestamp, cooldownMs)) {
      rows.push({
        name: `${base} cooldown readiness`,
        status: "OK",
        kind: "info",
        base,
        cooldownMs: cooldownMs.toString(),
        detail: `positionId=${openHit.positionId}, cooldown=${cooldownMs}ms elapsed`,
      });
    } else {
      const etaMs = Number(openHit.info.updateTimestamp) + Number(cooldownMs) - Date.now();
      rows.push({
        name: `${base} cooldown readiness`,
        status: "FAIL",
        kind: "cooldown_not_elapsed",
        base,
        cooldownMs: cooldownMs.toString(),
        detail: `positionId=${openHit.positionId}, cooldown=${cooldownMs}ms not elapsed`,
        action: `Wait about ${Math.max(1, Math.ceil(etaMs / 1000))}s and retry preflight/e2e.`,
      });
    }
  }

  for (const base of activeLifecycleTestBases()) {
    const row = lifecycleRow(base);
    try {
      const tx = await buildOpenPositionTx(client, {
        accountId,
        base,
        isLong: row.isLong,
        collateralAmount: row.e2ePtb.openCollateral,
        size: row.e2ePtb.openSize,
      });
      tx.setSender(owner);
      const result: any = await client.simulate(tx);
      if (result?.$kind === "Transaction") {
        rows.push({
          name: `${base} oracle readiness (simulate open)`,
          status: "OK",
          kind: "info",
          detail: "simulate open succeeded",
        });
      } else {
        const msg = simErr(result);
        if (isOracleTransient(msg)) {
          rows.push({
            name: `${base} oracle readiness (simulate open)`,
            status: "FAIL",
            kind: "oracle_transient",
            detail: "oracle feed/aggregate transient failure detected",
            action:
              "Retry `pnpm e2e:preflight` (Hermes/Pyth pull + Supra push feeds); strict CI fails until simulate open succeeds.",
          });
        } else {
          rows.push({
            name: `${base} oracle readiness (simulate open)`,
            status: "FAIL",
            kind: "oracle_other",
            detail: `simulate failed: ${msg}`,
            action:
              "Inspect `pnpm oracle:aggregates` / on-chain oracle config; fix env or wait for testnet recovery.",
          });
        }
      }
    } catch (e) {
      rows.push({
        name: `${base} oracle readiness (simulate open)`,
        status: "FAIL",
        kind: "oracle_other",
        detail: `preflight simulate exception: ${String(e)}`,
        action:
          "Re-run after network/SDK stability; check client config vs published testnet package IDs.",
      });
    }
  }

  const failRows = rows.filter((r) => r.status === "FAIL");
  const nonBlockingFailCount = failRows.filter((r) =>
    isNonBlockingFail(r, {
      allowOracleTransient,
      allowMissingPositions,
      allowMissingWlp,
      allowMissingTtoSplit,
      allowCooldownNotElapsed,
    }),
  ).length;
  const blockingFailCount = failRows.length - nonBlockingFailCount;
  return {
    owner,
    accountId,
    rows,
    okCount: rows.length - failRows.length,
    failCount: failRows.length,
    blockingFailCount,
    nonBlockingFailCount,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const owner = parseOwnerArg(argv);
  const allowOracleTransient = argv.includes("--allow-oracle-transient");
  const allowMissingPositions = argv.includes("--allow-missing-positions");
  const allowMissingWlp = argv.includes("--allow-missing-wlp");
  const allowMissingTtoSplit = argv.includes("--allow-missing-tto-split");
  const allowCooldownNotElapsed = argv.includes("--allow-cooldown-not-elapsed");
  const noUpdateLocalFixed = argv.includes("--no-update-local-fixed-positions");

  console.log(`e2e preflight owner=${owner}`);
  const result = await runPreflight(owner, {
    allowOracleTransient,
    allowMissingPositions,
    allowMissingWlp,
    allowMissingTtoSplit,
    allowCooldownNotElapsed,
  });
  printRows(result.rows);
  console.log(`\nsummary: ${result.okCount} OK, ${result.failCount} FAIL`);
  console.log(
    `blocking=${result.blockingFailCount}, non-blocking=${result.nonBlockingFailCount}` +
      (allowOracleTransient ||
      allowMissingPositions ||
      allowMissingWlp ||
      allowMissingTtoSplit ||
      allowCooldownNotElapsed
        ? " (exit code uses blocking count only; non-blocking kinds match your --allow-* flags)"
        : " (strict: every FAIL row is blocking)"),
  );

  const shouldFail = result.blockingFailCount > 0;

  // Refresh local file even when checks fail so pinned ids match chain (wide scan). Fixes
  // "BTC missing" when the slot exists but is outside the preflight's short recent-id window.
  if (result.accountId && !noUpdateLocalFixed && shouldAutoPersistLocalFixedPositions()) {
    try {
      const wc = WaterXClient.testnet();
      if (shouldFail) {
        console.log(
          "\n[e2e-fixed-local] Refreshing .e2e-fixed-positions.local.json despite failures (full scan)…",
        );
      }
      await persistE2eFixedPositionsLocal({
        client: wc,
        accountId: result.accountId,
      });
    } catch (e) {
      console.warn("[e2e-fixed-local] persist failed:", e instanceof Error ? e.message : String(e));
    }
  }

  if (shouldFail) {
    if (
      !allowOracleTransient &&
      !allowMissingPositions &&
      !allowMissingWlp &&
      !allowMissingTtoSplit &&
      !allowCooldownNotElapsed
    ) {
      printRemediationGuide(result.rows);
    }
    process.exit(1);
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
