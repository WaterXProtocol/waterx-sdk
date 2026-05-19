/**
 * Legacy integration harness for {@link scratchTradingScenarios}.
 * Re-enable when integration-trader Vitest project runs ported v3 flows.
 */
import type { ScratchTradingScenario } from "./scratch-trading-scenarios.ts";

export async function runScratchTradingScenarioIntegration(
  ctx: { skip: (reason?: string) => void },
  _deps: unknown,
  scenario: ScratchTradingScenario,
  _accountId: string,
): Promise<void> {
  ctx.skip(`Integration scratch lifecycle not ported for v3 (${scenario.id})`);
}
