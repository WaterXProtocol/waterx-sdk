/**
 * Seed testnet state for E2E / Integration tests.
 *
 * Each stage is idempotent (re-uses existing on-chain state when present). A snapshot of the
 * seeded ids is written to `tests/fixtures/testnet-seeded.json` for the test suite to consume.
 *
 * Usage:
 *   cp .env.example .env   # set SUI_PRIVATE_KEY (owner) and optionally E2E_KEEPER_PRIVATE_KEY
 *   pnpm seed:testnet                              # preset=baseline (account/deposit/place-open/fill/request-close)
 *   pnpm seed:testnet -- --preset=with-claim       # baseline + resolved claim market
 *   pnpm seed:testnet -- --preset=admin            # admin round-trips (requires AdminCap holder)
 *   pnpm seed:testnet -- --stage=account,deposit   # explicit stage list
 *   pnpm seed:testnet -- --dry-run                 # plan only, no transactions
 */
import { loadDotenv } from "./load-dotenv.ts";
import { buildContext } from "./seed/context.ts";
import { resolveStages, STAGE_REGISTRY, type StageName } from "./seed/stages.ts";

loadDotenv();

interface CliFlags {
  stages: StageName[];
  dryRun: boolean;
}

function parseCli(argv: string[]): CliFlags {
  const dryRun = argv.includes("--dry-run");
  const presetFlag = argv.find((a) => a.startsWith("--preset="));
  const stageFlag = argv.find((a) => a.startsWith("--stage="));

  if (presetFlag && stageFlag) {
    throw new Error("Pass either --preset=... or --stage=..., not both.");
  }
  if (presetFlag) {
    return { stages: resolveStages(presetFlag.slice("--preset=".length)), dryRun };
  }
  if (stageFlag) {
    return { stages: resolveStages(stageFlag.slice("--stage=".length)), dryRun };
  }
  // Default preset
  return { stages: resolveStages("baseline"), dryRun };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flags = parseCli(argv);

  const ctx = await buildContext(argv, flags.dryRun);
  ctx.log("owner", ctx.ownerAddress);
  if (ctx.keeperAddress) ctx.log("keeper", ctx.keeperAddress);
  else ctx.log("keeper", "(none — keeper stages will skip)");
  ctx.log("stages", flags.stages.join(", "));
  if (flags.dryRun) ctx.log("mode", "dry-run (no transactions will be sent)");

  for (const stage of flags.stages) {
    const fn = STAGE_REGISTRY[stage];
    if (!fn) throw new Error(`Unknown stage: ${stage}`);
    try {
      await fn(ctx);
    } catch (err) {
      ctx.log(`stage ${stage} FAILED`, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  ctx.log("done", `fixture → tests/fixtures/testnet-seeded.json`);
  console.log("\n# Seeded fixture:");
  console.log(JSON.stringify(ctx.fixture, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
