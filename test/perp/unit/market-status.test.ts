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
  PythScheduleParseError,
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

describe("getMarketStatus — overlapping and duplicated sessions", () => {
  // Events used to be derived by cancelling a `close`+`open` pair at the same
  // minute-of-week. That assumes the sorted list alternates. Two sessions
  // ENDING at the same minute put two closes in a row, the pairwise scan then
  // ate the following open, and the market read CLOSED for a session that is
  // open — silently, because the surviving list is still well-formed.
  // Coverage-merging cannot express that.
  const OVERLAPPING: TradingHours = {
    timezone: "America/New_York",
    sessions: [
      { open: "09:00", close: "12:00", days: [1] },
      { open: "10:00", close: "12:00", days: [1] }, // ends at the same minute
      { open: "12:00", close: "16:00", days: [1] }, // starts there
    ],
  };

  it("stays OPEN through a session that begins where two others end", () => {
    // 13:00 Monday sits inside 12:00-16:00.
    expect(getMarketStatus(OVERLAPPING, false, etDate(2026, 3, 2, 13, 0)).status).toBe("open");
  });

  it("treats the whole overlapping span as one continuous session", () => {
    // 09:00 through 16:00 is covered by the union, so the only close is 16:00.
    for (const hour of [9, 10, 11, 12, 14, 15]) {
      expect(getMarketStatus(OVERLAPPING, false, etDate(2026, 3, 2, hour, 30)).status).toBe("open");
    }
    expect(getMarketStatus(OVERLAPPING, false, etDate(2026, 3, 2, 16, 30)).status).toBe("closed");
    expect(getMarketStatus(OVERLAPPING, false, etDate(2026, 3, 2, 8, 30)).status).toBe("closed");
  });

  it("collapses an exactly duplicated session to the same result as one copy", () => {
    const once: TradingHours = {
      timezone: "America/New_York",
      sessions: [{ open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] }],
    };
    const twice: TradingHours = {
      timezone: "America/New_York",
      sessions: [
        { open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] },
        { open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] },
      ],
    };
    for (const hour of [8, 10, 15, 17]) {
      const at = etDate(2026, 3, 2, hour, 0);
      expect(getMarketStatus(twice, false, at)).toEqual(getMarketStatus(once, false, at));
    }
  });
});

describe("getMarketStatus — a holiday's midnight IS a status boundary", () => {
  /** Continuous 18:00→17:00 UTC daily, closed all of Jan 5. */
  const CONTINUOUS: TradingHours = {
    timezone: "UTC",
    sessions: [{ open: "18:00", close: "17:00", days: [0, 1, 2, 3, 4, 5, 6] }],
    holidays: [{ month: 1, day: 5 }],
  };
  const changeAt = (hours: TradingHours, iso: string) => {
    const at = new Date(iso);
    const { status, nextStatusChangeIn } = getMarketStatus(hours, false, at);
    return {
      status,
      when:
        nextStatusChangeIn == null
          ? null
          : new Date(at.getTime() + nextStatusChangeIn).toISOString(),
    };
  };

  it("an OPEN venue closes when the holiday starts, not at the scheduled close", () => {
    // The session would run to 17:00 on the 5th, but the holiday masks the
    // venue from 00:00. Only the open-lands-on-a-holiday case used to be
    // handled, so this reported the close 17h late.
    expect(changeAt(CONTINUOUS, "2027-01-04T20:00Z")).toEqual({
      status: "open",
      when: "2027-01-05T00:00:00.000Z",
    });
  });

  it("a holiday-CLOSED venue reopens when the holiday lifts, even mid-session", () => {
    // At 00:00 on the 6th the 18:00→17:00 session is already running, so the
    // venue resumes then — not at the next scheduled `open` event (18:00),
    // which is what looking only for non-holiday opens returned.
    expect(changeAt(CONTINUOUS, "2027-01-05T10:00Z")).toEqual({
      status: "closed",
      when: "2027-01-06T00:00:00.000Z",
    });
  });

  it("a session starting during a FUTURE holiday reopens when that holiday lifts", () => {
    // Schedule-closed now, and the upcoming open lands on a holiday. The masked
    // session is still RUNNING when the holiday lifts, so the venue resumes at
    // that midnight — not at the following week's open, which is what skipping
    // straight to the next non-holiday `open` returned.
    const mondayOnly: TradingHours = {
      timezone: "UTC",
      sessions: [{ open: "18:00", close: "17:00", days: [1] }],
      holidays: [{ month: 1, day: 4 }],
    };
    expect(changeAt(mondayOnly, "2027-01-03T12:00Z")).toEqual({
      status: "closed",
      when: "2027-01-05T00:00:00.000Z",
    });
  });

  it("...but still walks to the next open when the session does NOT span the lift", () => {
    // Same shape with a same-day session: nothing is running at midnight, so
    // the reopen really is the next non-holiday open.
    const dayShift: TradingHours = {
      timezone: "UTC",
      sessions: [{ open: "09:00", close: "17:00", days: [1] }],
      holidays: [{ month: 1, day: 4 }],
    };
    expect(changeAt(dayShift, "2027-01-03T12:00Z")).toEqual({
      status: "closed",
      when: "2027-01-11T09:00:00.000Z",
    });
  });

  it("a 24/7 venue reports a holiday beyond the 21-day run window", () => {
    // `nextStatusChangeIn: null` is documented as \"24/7 or paused\", so falling
    // off the lookahead made a consumer cache \"open forever\" through Christmas.
    const always: TradingHours = {
      timezone: "UTC",
      sessions: [{ open: "00:00", close: "00:00", days: [0, 1, 2, 3, 4, 5, 6] }],
      holidays: [{ month: 12, day: 25 }],
    };
    expect(changeAt(always, "2026-12-01T12:00Z")).toEqual({
      status: "open",
      when: "2026-12-25T00:00:00.000Z",
    });
  });

  it("a genuinely 24/7 venue with NO holidays still reports null", () => {
    const always: TradingHours = {
      timezone: "UTC",
      sessions: [{ open: "00:00", close: "00:00", days: [0, 1, 2, 3, 4, 5, 6] }],
    };
    expect(changeAt(always, "2026-12-01T12:00Z")).toEqual({ status: "open", when: null });
  });
});

describe("getMarketStatus — modified hours on a 24/7 schedule", () => {
  // The 24/7 arm only understands FULL closures, so evaluating it first
  // reported a continuous venue shut for the whole of an early-close day.
  // Modified hours have to be resolved before every other arm.
  const { tradingHours: ALWAYS_XMAS } = parsePythSchedule(
    "America/New_York;O,O,O,O,O,O,O;1224/0930-1300",
  );

  it("is OPEN inside the replacement window, not closed all day", () => {
    expect(getMarketStatus(ALWAYS_XMAS, false, etDate(2026, 12, 24, 11, 0)).status).toBe("open");
  });

  it("is CLOSED before the window opens", () => {
    const at = etDate(2026, 12, 24, 8, 0);
    const { status, nextStatusChangeIn } = getMarketStatus(ALWAYS_XMAS, false, at);
    expect(status).toBe("closed");
    expect(new Date(at.getTime() + nextStatusChangeIn!).toISOString()).toBe(
      "2026-12-24T14:30:00.000Z", // 09:30 ET
    );
  });

  it("is CLOSED after the window, and resumes when the date ends", () => {
    const at = etDate(2026, 12, 24, 15, 0);
    const { status, nextStatusChangeIn } = getMarketStatus(ALWAYS_XMAS, false, at);
    expect(status).toBe("closed");
    expect(new Date(at.getTime() + nextStatusChangeIn!).toISOString()).toBe(
      "2026-12-25T05:00:00.000Z", // Dec 25 00:00 ET — continuous trading resumes
    );
  });

  it("a 24/7 venue with only a FULL-closure holiday is unaffected", () => {
    const { tradingHours } = parsePythSchedule("America/New_York;O,O,O,O,O,O,O;1225/C");
    expect(getMarketStatus(tradingHours, false, etDate(2026, 12, 25, 11, 0)).status).toBe("closed");
    expect(getMarketStatus(tradingHours, false, etDate(2026, 12, 24, 11, 0)).status).toBe("open");
  });
});

describe("getMarketStatus — a modified-hours date seen from the day BEFORE", () => {
  it("reports the replacement window's open, not the next normal trading day", () => {
    // Treating the date as a plain holiday skipped the whole session and
    // pointed at the next NORMAL trading day.
    const { tradingHours } = parsePythSchedule(
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;1224/1000-1300",
    );
    const at = etDate(2026, 12, 23, 18, 0);
    const { status, nextStatusChangeIn } = getMarketStatus(tradingHours, false, at);

    expect(status).toBe("closed");
    expect(new Date(at.getTime() + nextStatusChangeIn!).toISOString()).toBe(
      "2026-12-24T15:00:00.000Z", // 10:00 ET on the 24th
    );
  });

  it("still skips a FULL-closure date to the next real open", () => {
    // The other half of the same branch: no windows means nothing opens that
    // day, so walking past it remains correct.
    const { tradingHours } = parsePythSchedule(
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;1224/C",
    );
    const at = etDate(2026, 12, 23, 18, 0);
    const { nextStatusChangeIn } = getMarketStatus(tradingHours, false, at);
    // Dec 24 2026 is a Thursday and shut, so the next open is Friday the 25th.
    expect(new Date(at.getTime() + nextStatusChangeIn!).toISOString()).toBe(
      "2026-12-25T14:30:00.000Z",
    );
  });
});

describe("getMarketStatus — a modified session on a normally-CLOSED day", () => {
  // The forward walk only fired when the WEEKLY open landed on the holiday
  // date. A session on a day the schedule never opens has no `open` event
  // anywhere near it, so it was skipped entirely — while querying during the
  // session reported open. That asymmetry is what this pins.
  //
  // Mon–Fri 09:00–17:00, plus a one-off Sunday 10:00–12:00 on Dec 27 2026.
  const { tradingHours: SUNDAY_SESSION } = parsePythSchedule(
    "America/New_York;0900-1700,0900-1700,0900-1700,0900-1700,0900-1700,C,C;1227/1000-1200",
  );
  const whenChanging = (at: Date) => {
    const { status, nextStatusChangeIn } = getMarketStatus(SUNDAY_SESSION, false, at);
    return {
      status,
      when:
        nextStatusChangeIn == null
          ? null
          : new Date(at.getTime() + nextStatusChangeIn).toISOString(),
    };
  };

  it("the day before points at the session, not the next normal weekday", () => {
    expect(whenChanging(etDate(2026, 12, 26, 12, 0))).toEqual({
      status: "closed",
      when: "2026-12-27T15:00:00.000Z", // Sun 10:00 ET — not Mon 09:00
    });
  });

  it("finds it from further out too", () => {
    expect(whenChanging(etDate(2026, 12, 25, 18, 0))).toEqual({
      status: "closed",
      when: "2026-12-27T15:00:00.000Z",
    });
  });

  it("is open DURING the session, closing at its end", () => {
    expect(whenChanging(etDate(2026, 12, 27, 11, 0))).toEqual({
      status: "open",
      when: "2026-12-27T17:00:00.000Z", // 12:00 ET
    });
  });

  it("after the session, the next change is the normal Monday open", () => {
    expect(whenChanging(etDate(2026, 12, 27, 13, 0))).toEqual({
      status: "closed",
      when: "2026-12-28T14:00:00.000Z", // Mon 09:00 ET
    });
  });

  it("a schedule with no modified hours is unaffected by the extra scan", () => {
    const { tradingHours } = parsePythSchedule(
      "America/New_York;0900-1700,0900-1700,0900-1700,0900-1700,0900-1700,C,C;",
    );
    const at = etDate(2026, 12, 26, 12, 0);
    const { nextStatusChangeIn } = getMarketStatus(tradingHours, false, at);
    expect(new Date(at.getTime() + nextStatusChangeIn!).toISOString()).toBe(
      "2026-12-28T14:00:00.000Z", // straight to Monday
    );
  });
});

describe("getMarketStatus — sub-minute precision", () => {
  it("counts the seconds already elapsed in the current minute", () => {
    // All the internal arithmetic is minute-of-week, i.e. as if `now` sat on
    // the start of the minute — so a boundary was reported up to 59.999s LATE
    // and a consumer scheduling a re-check off it woke up after the change.
    const at = new Date(etDate(2026, 3, 2, 15, 30).getTime() + 42_500);
    const { nextStatusChangeIn } = getMarketStatus(NYSE_HOURS, false, at);
    // 16:00 close is 30 minutes away, less the 42.5s already spent.
    expect(nextStatusChangeIn).toBe(30 * 60_000 - 42_500);
  });

  it("never returns a negative delta", () => {
    // Sitting inside the boundary minute itself: the change is now, not in the
    // past.
    const at = new Date(etDate(2026, 3, 2, 16, 0).getTime() + 30_000);
    const { nextStatusChangeIn } = getMarketStatus(NYSE_HOURS, false, at);
    expect(nextStatusChangeIn).toBeGreaterThanOrEqual(0);
  });
});

describe("getMarketStatus — modified-hours holidays (early closes)", () => {
  // These were parsed away entirely, so the venue fell back to its NORMAL
  // weekly hours on an early-close day and reported itself open after it had
  // shut. Not an edge case: the live catalog carries thousands of them.
  const { tradingHours: NYSE_XMAS } = parsePythSchedule(
    "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;1224/0930-1300",
  );

  it("is CLOSED after the early close, where the weekly schedule says open", () => {
    // 15:00 ET on Dec 24 — inside the normal 09:30-16:00 window, but the
    // replacement window ended at 13:00.
    expect(getMarketStatus(NYSE_XMAS, false, etDate(2026, 12, 24, 15, 0)).status).toBe("closed");
  });

  it("is OPEN inside the replacement window, and closes at ITS end", () => {
    const at = etDate(2026, 12, 24, 11, 0);
    const { status, nextStatusChangeIn } = getMarketStatus(NYSE_XMAS, false, at);
    expect(status).toBe("open");
    // 13:00, not the weekly 16:00.
    expect(nextStatusChangeIn).toBe(2 * MS_PER_HOUR);
  });

  it("is CLOSED before the replacement window opens, and reports ITS start", () => {
    const at = etDate(2026, 12, 24, 9, 0);
    const { status, nextStatusChangeIn } = getMarketStatus(NYSE_XMAS, false, at);
    expect(status).toBe("closed");
    expect(nextStatusChangeIn).toBe(0.5 * MS_PER_HOUR);
  });

  it("a FULL-closure holiday on the same schedule still reads closed all day", () => {
    // `MMDD/C` has no windows, so it must not be mistaken for modified hours.
    const { tradingHours } = parsePythSchedule(
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;1225/C",
    );
    expect(getMarketStatus(tradingHours, false, etDate(2026, 12, 25, 11, 0)).status).toBe("closed");
  });

  it("handles a SPLIT replacement window", () => {
    const { tradingHours } = parsePythSchedule(
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;1224/0930-1200&1400-1600",
    );
    expect(getMarketStatus(tradingHours, false, etDate(2026, 12, 24, 10, 0)).status).toBe("open");
    // The gap between the two windows.
    expect(getMarketStatus(tradingHours, false, etDate(2026, 12, 24, 13, 0)).status).toBe("closed");
    expect(getMarketStatus(tradingHours, false, etDate(2026, 12, 24, 15, 0)).status).toBe("open");
  });
});

describe("getMarketStatus — rehydrated schedules", () => {
  it("a session naming NO days is a venue that never opens, not a 24/7 one", () => {
    // `buildWeeklyEvents` returns an empty event list for BOTH "no coverage"
    // and "full coverage". Inferring which from `sessions.length` read this as
    // 24/7 and reported a permanently-closed venue as tradable.
    const noDays: TradingHours = {
      timezone: "America/New_York",
      sessions: [{ open: "09:30", close: "16:00", days: [] }],
    };
    expect(getMarketStatus(noDays, false, etDate(2026, 3, 2, 12, 0))).toEqual({
      status: "closed",
      nextStatusChangeIn: null,
    });
  });

  it("still reports a genuine 24/7 schedule as open", () => {
    // The other side of the same discriminator — full coverage must not get
    // swept up by the fix above.
    const always: TradingHours = {
      timezone: "America/New_York",
      sessions: [{ open: "00:00", close: "00:00", days: [0, 1, 2, 3, 4, 5, 6] }],
    };
    expect(getMarketStatus(always, false, etDate(2026, 3, 2, 12, 0)).status).toBe("open");
  });

  it("rejects a malformed session time instead of throwing a raw RangeError", () => {
    // NaN minutes propagate to `new Date(NaN)` and `Intl` throws an untyped
    // RangeError from deep inside the walker — past the try/catch callers put
    // around the parser. Same hole the timezone check closes.
    const badTime: TradingHours = {
      timezone: "America/New_York",
      sessions: [{ open: "9:30am", close: "16:00", days: [1] }],
    };
    expect(() => getMarketStatus(badTime, false, new Date())).toThrow(PythScheduleParseError);
  });

  it("rejects an unusable timezone instead of throwing a raw RangeError", () => {
    // `TradingHours` crosses process boundaries (cached JSON, BE markets
    // types), so it reaches the walker WITHOUT having gone through
    // `parsePythSchedule` — where the timezone check lives. An uncaught
    // `RangeError` out of `Intl` would take down a whole markets response over
    // one bad row, and escape the try/catch callers put around the parser.
    const bad: TradingHours = {
      timezone: "Not/AReal_Zone",
      sessions: [{ open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] }],
    };
    expect(() => getMarketStatus(bad, false, new Date())).toThrow(PythScheduleParseError);
  });
});

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
