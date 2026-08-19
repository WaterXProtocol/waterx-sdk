/**
 * `parsePythSchedule` — ported from BOTH consumers' suites (BE
 * `pyth-schedule.parser.spec.ts` + FE `pythSchedule.test.ts`), reconciled to
 * the SDK's superset parser so any drift between the three repos' parse
 * semantics fails HERE first. The superset accepts every era's tokens:
 * `Open`/`O`/`open`, `Closed`/`C`/`closed`, `&`-joined and comma-joined
 * multi-session days, and `MMDD` / `MMDD/C` holidays.
 */
import { describe, expect, it } from "vitest";

import { parsePythSchedule, PythScheduleParseError } from "../../../src/oracle/schedule.ts";

describe("parsePythSchedule", () => {
  // ---------------------------------------------------------------------------
  // Format coverage
  // ---------------------------------------------------------------------------

  it("parses an NYSE-style equity schedule with holidays", () => {
    const input =
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,Closed,Closed;0101,1225";
    const { tradingHours, alwaysOpen } = parsePythSchedule(input);
    expect(alwaysOpen).toBe(false);
    expect(tradingHours.timezone).toBe("America/New_York");
    expect(tradingHours.sessions).toEqual([
      { open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] },
    ]);
    expect(tradingHours.holidays).toEqual([
      { month: 1, day: 1 },
      { month: 12, day: 25 },
    ]);
  });

  it("parses a 24/7 crypto schedule and flags it always-open", () => {
    const input = "UTC;Open,Open,Open,Open,Open,Open,Open;";
    const { tradingHours, alwaysOpen } = parsePythSchedule(input);
    expect(alwaysOpen).toBe(true);
    expect(tradingHours.timezone).toBe("UTC");
    // All seven days collapse into a single (00:00, 24:00→00:00) session.
    expect(tradingHours.sessions).toHaveLength(1);
    expect(tradingHours.sessions[0]).toEqual({
      open: "00:00",
      close: "00:00",
      days: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(tradingHours.holidays).toBeUndefined();
  });

  it("parses a forex schedule (Mon–Thu open, Fri 0000-1700, Sun 1700-2400)", () => {
    const input = "America/New_York;Open,Open,Open,Open,0000-1700,Closed,1700-2400;";
    const { tradingHours, alwaysOpen } = parsePythSchedule(input);
    expect(alwaysOpen).toBe(false);
    // Mon=1..Thu=4 collapse into the 00:00→00:00 (24h) session
    const fullDay = tradingHours.sessions.find((s) => s.open === "00:00" && s.close === "00:00");
    expect(fullDay).toBeDefined();
    expect(fullDay?.days.sort()).toEqual([1, 2, 3, 4]);
    // Fri 0000-1700 → days [5]
    const friSession = tradingHours.sessions.find((s) => s.open === "00:00" && s.close === "17:00");
    expect(friSession).toBeDefined();
    expect(friSession?.days).toEqual([5]);
    // Sun 1700-2400 → days [0]
    const sunSession = tradingHours.sessions.find((s) => s.open === "17:00" && s.close === "00:00");
    expect(sunSession).toBeDefined();
    expect(sunSession?.days).toEqual([0]);
  });

  it("handles trailing `;` in holidays segment", () => {
    const input = "UTC;Open,Open,Open,Open,Open,Open,Open;";
    const result = parsePythSchedule(input);
    expect(result.tradingHours.holidays).toBeUndefined();
  });

  it("handles missing `;` for holidays segment", () => {
    const input = "UTC;Open,Open,Open,Open,Open,Open,Open";
    const result = parsePythSchedule(input);
    expect(result.tradingHours.holidays).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------

  it("rejects too few weekdays", () => {
    expect(() => parsePythSchedule("UTC;Open,Open,Open;")).toThrow(PythScheduleParseError);
  });

  it("rejects malformed time of day", () => {
    expect(() => parsePythSchedule("UTC;9999-1600,Open,Open,Open,Open,Open,Open;")).toThrow(
      PythScheduleParseError,
    );
  });

  it("rejects malformed holiday MMDD", () => {
    expect(() => parsePythSchedule("UTC;Open,Open,Open,Open,Open,Open,Open;1335")).toThrow(
      PythScheduleParseError,
    );
  });

  it("rejects obviously-invalid timezone strings", () => {
    expect(() => parsePythSchedule("<not-a-tz>;Open,Open,Open,Open,Open,Open,Open;")).toThrow(
      PythScheduleParseError,
    );
  });

  // ---------------------------------------------------------------------------
  // Multi-session day (one day with two HHMM-HHMM tokens, comma-joined)
  // ---------------------------------------------------------------------------

  it("parses a multi-session day (e.g. lunch break) — old comma format", () => {
    // Hypothetical: Mon 09:30-12:00 + 13:30-16:00, all other weekdays closed.
    const input = "America/New_York;0930-1200,1330-1600,Closed,Closed,Closed,Closed,Closed,Closed;";
    const { tradingHours } = parsePythSchedule(input);
    // Mon has two windows → two sessions, each only Mon (day=1).
    const morning = tradingHours.sessions.find((s) => s.open === "09:30" && s.close === "12:00");
    const afternoon = tradingHours.sessions.find((s) => s.open === "13:30" && s.close === "16:00");
    expect(morning?.days).toEqual([1]);
    expect(afternoon?.days).toEqual([1]);
  });

  // ---------------------------------------------------------------------------
  // New Pyth format: O/C shorthand, & multi-session, MMDD/C holidays
  // ---------------------------------------------------------------------------

  it("parses new-format O (24/7 open all days) as alwaysOpen", () => {
    const input = "America/New_York;O,O,O,O,O,O,O;";
    const { alwaysOpen } = parsePythSchedule(input);
    expect(alwaysOpen).toBe(true);
  });

  it("parses new-format C (closed days) in an equity schedule", () => {
    const input =
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0101/C,0704/C";
    const { tradingHours, alwaysOpen } = parsePythSchedule(input);
    expect(alwaysOpen).toBe(false);
    expect(tradingHours.sessions).toEqual([
      { open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] },
    ]);
    expect(tradingHours.holidays).toEqual([
      { month: 1, day: 1 },
      { month: 7, day: 4 },
    ]);
  });

  it("parses & multi-session within a day", () => {
    const input =
      "America/New_York;0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700,C,1800-2400;";
    const { tradingHours } = parsePythSchedule(input);
    const earlySession = tradingHours.sessions.find(
      (s) => s.open === "00:00" && s.close === "17:00",
    );
    expect(earlySession?.days.sort()).toEqual([1, 2, 3, 4, 5]);
    const lateSession = tradingHours.sessions.find(
      (s) => s.open === "18:00" && s.close === "00:00",
    );
    expect(lateSession?.days.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("ignores modified-hours holiday entries (MMDD/HHMM-HHMM)", () => {
    const input =
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0101/C,1224/0000-1300";
    const { tradingHours } = parsePythSchedule(input);
    // 0101/C → holiday; 1224/0000-1300 → modified hours, not in holidays list
    expect(tradingHours.holidays).toEqual([{ month: 1, day: 1 }]);
  });

  it('ignores non-MMDD sentinel values in holidays (e.g. Pyth "0")', () => {
    const input =
      "America/New_York;0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700,C,1800-2400;0";
    const { tradingHours } = parsePythSchedule(input);
    expect(tradingHours.holidays).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // FE-era lowercase tokens (the reconciled superset accepts both spellings)
  // ---------------------------------------------------------------------------

  it("accepts lowercase open/closed tokens (FE-era spelling)", () => {
    const { tradingHours, alwaysOpen } = parsePythSchedule(
      "UTC;open,open,open,open,open,closed,closed;",
    );
    expect(alwaysOpen).toBe(false);
    const fullDay = tradingHours.sessions.find((s) => s.open === "00:00" && s.close === "00:00");
    expect(fullDay?.days.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
