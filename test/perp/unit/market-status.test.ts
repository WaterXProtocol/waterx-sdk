/**
 * `getMarketStatus` — the pure holiday-aware weekly schedule walker, ported
 * VERBATIM with its BE suite (`core/market-status.spec.ts`) so the SDK copy
 * can never drift from the semantics both consumers already shipped against.
 */
import { describe, expect, it } from "vitest";

import { MS_PER_HOUR } from "../../../src/constants.ts";
import {
  getMarketStatus,
  parsePythSchedule,
  type MarketStatusResult,
  type TradingHours,
} from "../../../src/oracle/schedule.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Date that represents the given local time in America/New_York */
function etDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(guess);
  const localH = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const localM = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const offsetMinutes = localH * 60 + localM - (hour * 60 + minute);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

// ---------------------------------------------------------------------------
// Schedule Fixtures
// ---------------------------------------------------------------------------

/** NYSE: Mon–Fri 09:30 – 16:00 ET */
const NYSE_HOURS: TradingHours = {
  timezone: "America/New_York",
  sessions: [{ open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] }],
};

/** CME: Sun–Thu 18:00 – (next day) 17:00 ET (23h session, 1h gap 17:00-18:00) */
const CME_HOURS: TradingHours = {
  timezone: "America/New_York",
  sessions: [{ open: "18:00", close: "17:00", days: [0, 1, 2, 3, 4] }],
};

/** Forex: Sun–Thu 17:00 – (next day) 17:00 ET (continuous Sun 17:00 → Fri 17:00) */
const FOREX_HOURS: TradingHours = {
  timezone: "America/New_York",
  sessions: [{ open: "17:00", close: "17:00", days: [0, 1, 2, 3, 4] }],
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("getMarketStatus — degenerate event lists", () => {
  it("a venue with NO sessions is closed, not open", () => {
    // An empty derived event list means BOTH \"never opens\" and \"never closes\";
    // collapsing it to `open` reported a delisted/permanently-halted feed as
    // tradable.
    const closed = parsePythSchedule("America/New_York;C,C,C,C,C,C,C;");
    expect(closed.tradingHours.sessions).toEqual([]);
    expect(getMarketStatus(closed.tradingHours, false, new Date())).toEqual<MarketStatusResult>({
      status: "closed",
      nextStatusChangeIn: null,
    });
  });

  it("a 24/7 venue still observes its holidays", () => {
    // Every open/close cancels in the continuous-session merge, so the event
    // list is empty — but the holiday must still mask the day, which the old
    // early return skipped by leaving before the holiday check.
    const always = parsePythSchedule("UTC;O,O,O,O,O,O,O;1225/C");
    expect(always.tradingHours.holidays).toEqual([{ month: 12, day: 25 }]);

    const onXmas = getMarketStatus(always.tradingHours, false, new Date("2026-12-25T12:00:00Z"));
    expect(onXmas.status).toBe("closed");
    // Reopens at the next local midnight (12h later).
    expect(onXmas.nextStatusChangeIn).toBe(12 * MS_PER_HOUR);

    const offXmas = getMarketStatus(always.tradingHours, false, new Date("2026-12-24T12:00:00Z"));
    expect(offXmas.status).toBe("open");
    expect(offXmas.nextStatusChangeIn).toBe(12 * MS_PER_HOUR); // until the holiday starts
  });

  it("a 24/7 venue with no holidays never changes status", () => {
    const always = parsePythSchedule("UTC;O,O,O,O,O,O,O;");
    expect(getMarketStatus(always.tradingHours, false, new Date())).toEqual<MarketStatusResult>({
      status: "open",
      nextStatusChangeIn: null,
    });
  });
});

describe("getMarketStatus — DST", () => {
  it("a countdown spanning a spring-forward lands on the real open instant", () => {
    // Minute-of-week arithmetic is LOCAL; multiplying the delta by 60_000
    // assumes a fixed UTC offset and came out an hour late across the
    // 2026-03-08 transition.
    const nyse = parsePythSchedule(
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;",
    ).tradingHours;
    const friClose = new Date("2026-03-06T21:00:00Z"); // Fri 16:00 EST
    const { status, nextStatusChangeIn } = getMarketStatus(nyse, false, friClose);

    expect(status).toBe("closed");
    // Monday 09:30 EDT === 13:30Z, NOT 14:30Z.
    expect(new Date(friClose.getTime() + nextStatusChangeIn!).toISOString()).toBe(
      "2026-03-09T13:30:00.000Z",
    );
  });
});

describe("getMarketStatus", () => {
  // =====================================================================
  // Trivial / short-circuit paths
  // =====================================================================

  describe("trivial paths", () => {
    it("returns open with null nextStatusChangeIn for crypto (tradingHours=null)", () => {
      const result = getMarketStatus(null, false);
      expect(result).toEqual<MarketStatusResult>({
        status: "open",
        nextStatusChangeIn: null,
      });
    });

    it("returns paused when the paused flag is set", () => {
      const result = getMarketStatus(NYSE_HOURS, true);
      expect(result).toEqual<MarketStatusResult>({
        status: "paused",
        nextStatusChangeIn: null,
      });
    });

    it("paused beats a null schedule — an on-chain-halted 24/7 market is not open", () => {
      // The paused check short-circuits BEFORE the `tradingHours === null`
      // 24/7 branch. Every crypto market has null hours, so if those two are
      // ever reordered every paused BTCUSD/ETHUSD/SUIUSD reports `open`.
      // The NYSE case above cannot catch that — it passes a real schedule.
      const result = getMarketStatus(null, true);
      expect(result).toEqual<MarketStatusResult>({
        status: "paused",
        nextStatusChangeIn: null,
      });
    });
  });

  // =====================================================================
  // NYSE — simple same-day sessions
  // =====================================================================

  describe("NYSE schedule", () => {
    // Wed 2026-01-07 10:00 ET → open, 6h to 16:00
    it("returns open during session (Wed 10:00)", () => {
      const now = etDate(2026, 1, 7, 10, 0);
      const result = getMarketStatus(NYSE_HOURS, false, now);
      expect(result.status).toBe("open");
      expect(result.nextStatusChangeIn).toBe(6 * MS_PER_HOUR);
    });

    // Wed 2026-01-07 17:00 ET → closed, 16.5h to Thu 09:30
    it("returns closed after session (Wed 17:00)", () => {
      const now = etDate(2026, 1, 7, 17, 0);
      const result = getMarketStatus(NYSE_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(16.5 * MS_PER_HOUR);
    });

    // Wed 2026-01-07 08:00 ET → closed, 1.5h to 09:30
    it("returns closed before session (Wed 08:00)", () => {
      const now = etDate(2026, 1, 7, 8, 0);
      const result = getMarketStatus(NYSE_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(1.5 * MS_PER_HOUR);
    });

    // Sat 2026-01-10 12:00 ET → closed, 45.5h to Mon 09:30
    it("returns closed on weekend (Sat 12:00)", () => {
      const now = etDate(2026, 1, 10, 12, 0);
      const result = getMarketStatus(NYSE_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(45.5 * MS_PER_HOUR);
    });

    // Fri 2026-01-09 16:30 ET → closed, 65h to Mon 09:30
    it("returns closed after Friday close (Fri 16:30)", () => {
      const now = etDate(2026, 1, 9, 16, 30);
      const result = getMarketStatus(NYSE_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(65 * MS_PER_HOUR);
    });

    // Wed 2026-01-07 09:30 ET → open (boundary inclusive), 6.5h to 16:00
    it("returns open at exact open boundary (Wed 09:30)", () => {
      const now = etDate(2026, 1, 7, 9, 30);
      const result = getMarketStatus(NYSE_HOURS, false, now);
      expect(result.status).toBe("open");
      expect(result.nextStatusChangeIn).toBe(6.5 * MS_PER_HOUR);
    });

    // Wed 2026-01-07 16:00 ET → closed (boundary exclusive), 17.5h to Thu 09:30
    it("returns closed at exact close boundary (Wed 16:00)", () => {
      const now = etDate(2026, 1, 7, 16, 0);
      const result = getMarketStatus(NYSE_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(17.5 * MS_PER_HOUR);
    });
  });

  // =====================================================================
  // CME — cross-day sessions (18:00 → 17:00 next day)
  // =====================================================================

  describe("CME schedule", () => {
    // Sun 2026-01-04 20:00 ET → open (opened at Sun 18:00), 21h to Mon 17:00
    it("returns open on Sunday evening (Sun 20:00)", () => {
      const now = etDate(2026, 1, 4, 20, 0);
      const result = getMarketStatus(CME_HOURS, false, now);
      expect(result.status).toBe("open");
      expect(result.nextStatusChangeIn).toBe(21 * MS_PER_HOUR);
    });

    // Wed 2026-01-07 12:00 ET → open (opened at Tue 18:00), 5h to Wed 17:00
    it("returns open during session (Wed 12:00)", () => {
      const now = etDate(2026, 1, 7, 12, 0);
      const result = getMarketStatus(CME_HOURS, false, now);
      expect(result.status).toBe("open");
      expect(result.nextStatusChangeIn).toBe(5 * MS_PER_HOUR);
    });

    // Fri 2026-01-09 17:30 ET → closed (weekly gap), 48.5h to Sun 18:00
    it("returns closed in weekly gap (Fri 17:30)", () => {
      const now = etDate(2026, 1, 9, 17, 30);
      const result = getMarketStatus(CME_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(48.5 * MS_PER_HOUR);
    });

    // Sat 2026-01-10 12:00 ET → closed, 30h to Sun 18:00
    it("returns closed on Saturday (Sat 12:00)", () => {
      const now = etDate(2026, 1, 10, 12, 0);
      const result = getMarketStatus(CME_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(30 * MS_PER_HOUR);
    });

    // Sun 2026-01-04 18:00 ET → open (boundary inclusive), 23h to Mon 17:00
    it("returns open at exact open boundary (Sun 18:00)", () => {
      const now = etDate(2026, 1, 4, 18, 0);
      const result = getMarketStatus(CME_HOURS, false, now);
      expect(result.status).toBe("open");
      expect(result.nextStatusChangeIn).toBe(23 * MS_PER_HOUR);
    });

    // Fri 2026-01-09 17:00 ET → closed (boundary exclusive), 49h to Sun 18:00
    it("returns closed at exact close boundary (Fri 17:00)", () => {
      const now = etDate(2026, 1, 9, 17, 0);
      const result = getMarketStatus(CME_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(49 * MS_PER_HOUR);
    });
  });

  // =====================================================================
  // Forex — continuous (open === close merges into Sun 17:00 → Fri 17:00)
  // =====================================================================

  describe("Forex schedule", () => {
    // Mon 2026-01-05 10:00 ET → open, 103h to Fri 17:00 (continuous)
    it("returns open on Monday (Mon 10:00)", () => {
      const now = etDate(2026, 1, 5, 10, 0);
      const result = getMarketStatus(FOREX_HOURS, false, now);
      expect(result.status).toBe("open");
      expect(result.nextStatusChangeIn).toBe(103 * MS_PER_HOUR);
    });

    // Sat 2026-01-10 10:00 ET → closed, 31h to Sun 17:00
    it("returns closed on Saturday (Sat 10:00)", () => {
      const now = etDate(2026, 1, 10, 10, 0);
      const result = getMarketStatus(FOREX_HOURS, false, now);
      expect(result.status).toBe("closed");
      expect(result.nextStatusChangeIn).toBe(31 * MS_PER_HOUR);
    });
  });

  // =====================================================================
  // Holidays — driven by `TradingHours.holidays`
  // =====================================================================

  describe("NYSE schedule with holidays", () => {
    /** NYSE schedule with US 2026 market holidays (subset). */
    const NYSE_WITH_HOLIDAYS: TradingHours = {
      ...NYSE_HOURS,
      holidays: [
        { month: 1, day: 1 }, // New Year's Day
        { month: 12, day: 25 }, // Christmas
      ],
    };

    // Christmas 2026 falls on a Friday. Weekly schedule says open
    // 09:30–16:00 — holidays must override.
    it("treats Christmas Friday as closed", () => {
      const now = etDate(2026, 12, 25, 10, 0);
      const result = getMarketStatus(NYSE_WITH_HOLIDAYS, false, now);
      expect(result.status).toBe("closed");
      // Next open is Mon 2026-12-28 09:30 ET → 71.5h ahead
      expect(result.nextStatusChangeIn).toBe(71.5 * MS_PER_HOUR);
    });

    // New Year's Day 2026 lands on Thursday. Following Friday is normal.
    it("treats Jan 1 as closed and rolls to Friday open", () => {
      const now = etDate(2026, 1, 1, 11, 0);
      const result = getMarketStatus(NYSE_WITH_HOLIDAYS, false, now);
      expect(result.status).toBe("closed");
      // Fri 2026-01-02 09:30 ET → 22.5h ahead
      expect(result.nextStatusChangeIn).toBe(22.5 * MS_PER_HOUR);
    });

    // Sat is closed regardless. Holiday on Mon should push next-open to Tue.
    it("skips a holiday-Monday when computing next open from Saturday", () => {
      const withHolidayMonday: TradingHours = {
        ...NYSE_HOURS,
        // Monday 2026-01-05 marked as a holiday.
        holidays: [{ month: 1, day: 5 }],
      };
      const now = etDate(2026, 1, 3, 10, 0); // Saturday
      const result = getMarketStatus(withHolidayMonday, false, now);
      expect(result.status).toBe("closed");
      // Tue 2026-01-06 09:30 ET → 71.5h ahead
      expect(result.nextStatusChangeIn).toBe(71.5 * MS_PER_HOUR);
    });

    // Mid-week after-hours, next open lands on a holiday Tuesday — exercises
    // the post-event holiday-skip branch from a non-weekend starting point.
    it("skips a holiday-Tuesday when computing next open from Monday after-hours", () => {
      const withHolidayTuesday: TradingHours = {
        ...NYSE_HOURS,
        // Tuesday 2026-01-06 marked as a holiday.
        holidays: [{ month: 1, day: 6 }],
      };
      const now = etDate(2026, 1, 5, 17, 0); // Mon 17:00 ET, after close
      const result = getMarketStatus(withHolidayTuesday, false, now);
      expect(result.status).toBe("closed");
      // Wed 2026-01-07 09:30 ET → 40.5h ahead
      expect(result.nextStatusChangeIn).toBe(40.5 * MS_PER_HOUR);
    });
  });
});
