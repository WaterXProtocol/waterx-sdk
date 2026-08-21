/**
 * `schedule.ts` — Pyth `attributes.schedule` grammar parser + the pure
 * market-status walker (WL-2345): the ONE implementation both consumers fold
 * onto (the FE fallback `/api/markets` route and the BE
 * `PythScheduleService` / markets service carried drifting twins).
 *
 * Parser grammar (https://docs.pyth.network/price-feeds/market-hours):
 *
 *   {IANA_timezone};{Mon},{Tue},{Wed},{Thu},{Fri},{Sat},{Sun};{holidays_csv}
 *
 * Each weekday slot is `Open`/`O`/`open`, `Closed`/`C`/`closed`, one
 * `HHMM-HHMM` range, `&`-joined ranges (the new multi-session encoding), or
 * comma-joined ranges (the old encoding — disambiguated from the weekday
 * separator by lookahead). Holidays are `MMDD` (old) or `MMDD/C` (new; a
 * `MMDD/HHMM-HHMM` modified-hours entry is NOT a closure and is skipped, as
 * are non-MMDD sentinels like Pyth's `"0"`). This is the reconciled SUPERSET
 * of the two prior ports — accepting either era's tokens is what lets one
 * parser serve the `v1/symbols` catalog and any cached Hermes-era strings.
 *
 * Pyth weekday order is Mon=0..Sun=6; `TradingHours.days` uses ISO-ish
 * Sun=0..Sat=6 (converted in `groupIntoSessions`).
 *
 * The schedule catalog itself comes from `fetchPythSymbolCatalog`
 * (`symbol-catalog.ts`); pairing a record's `schedule` with this parser and
 * `getMarketStatus` is the whole market-hours pipeline.
 */

import { MS_PER_MINUTE } from "../constants.ts";

// ============================================================================
// Types (the cross-repo contract — BE `markets.types` shapes, verbatim)
// ============================================================================

export interface TradingSession {
  /** HH:MM (24h) open time in the market's timezone */
  open: string;
  /** HH:MM (24h) close time — may be next day (e.g. "17:00" Sunday open to "17:00" Friday) */
  close: string;
  /** ISO day-of-week: 0=Sunday … 6=Saturday */
  days: number[];
}

/**
 * Year-agnostic `(month, day)` pair, matching Pyth's `MMDD` holiday encoding.
 * The same `{month, day}` matches in *every* year, so moving holidays
 * (Good Friday, MLK Day, Thanksgiving, etc.) need to be republished by Pyth
 * each year and picked up by the consumer's next catalog refresh.
 */
export interface HolidayDate {
  /** 1..12, in the schedule's timezone */
  month: number;
  /** 1..31, in the schedule's timezone */
  day: number;
  /**
   * MODIFIED hours for this date, in place of the weekly schedule — an early
   * close (`1224/0930-1300`) or a split session (`1224/0000-1430&1800-2400`).
   * Absent means a FULL closure, the `MMDD/C` form.
   *
   * These were previously discarded, which meant the venue fell back to its
   * NORMAL weekly hours on an early-close day and reported itself open after it
   * had shut. They are not an edge case: the live Pyth catalog carries
   * thousands (`0930-1300` alone appears ~2.5k times).
   */
  sessions?: { open: string; close: string }[];
}

export interface TradingHours {
  /** IANA timezone identifier, e.g. "America/New_York" */
  timezone: string;
  sessions: TradingSession[];
  /**
   * Days when the venue is fully closed regardless of the weekly schedule.
   * Optional — many feeds (crypto, FX) have none. Encoded as `(month, day)`
   * in `timezone`'s local calendar, matching Pyth's `attributes.schedule`
   * holiday list.
   */
  holidays?: HolidayDate[];
}

export interface ParsedPythSchedule {
  tradingHours: TradingHours;
  /** True iff every weekday is fully open and there are no holidays — callers treat as `tradingHours = null` (24/7, no schedule needed). */
  alwaysOpen: boolean;
}

export class PythScheduleParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythScheduleParseError";
  }
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse a Pyth schedule string. Throws {@link PythScheduleParseError} on
 * malformed input — callers guard with try/catch so one bad feed does not break
 * a whole market list.
 *
 * DEGRADE CLOSED, not open. The obvious fallback — treat an unparseable
 * schedule as "no schedule (24/7)" — is the wrong direction: the shapes that
 * actually fail here are venues WITH sessions (a lunch-break equity schedule in
 * the legacy comma encoding, an ambiguous weekday fold), and calling those 24/7
 * reports a closed venue as tradable. That is the failure class this module
 * exists to prevent. Prefer marking the market unavailable, or reusing the last
 * schedule that parsed; use 24/7 only where a wrong "open" is harmless.
 */
export function parsePythSchedule(input: string): ParsedPythSchedule {
  const segments = input.split(";");
  if (segments.length < 2 || segments.length > 3) {
    throw new PythScheduleParseError(
      `expected 2 or 3 ';'-separated segments, got ${String(segments.length)}: ${input}`,
    );
  }
  const timezone = (segments[0] ?? "").trim();
  const weeklyStr = (segments[1] ?? "").trim();
  const holidaysStr = (segments[2] ?? "").trim();

  assertUsableTimezone(timezone);

  const weeklySlots = parseWeeklySlots(weeklyStr);
  const holidays = parseHolidays(holidaysStr);
  const sessions = groupIntoSessions(weeklySlots);

  const allOpen = weeklySlots.every((day) => {
    if (day.length !== 1) return false;
    const first = day.at(0);
    return first?.open === 0 && first.close === 1440;
  });

  return {
    tradingHours: {
      timezone,
      sessions,
      ...(holidays.length !== 0 ? { holidays } : {}),
    },
    alwaysOpen: allOpen && holidays.length === 0,
  };
}

interface RawWindow {
  /** Minutes since local midnight (0..1440). */
  open: number;
  /** Minutes since local midnight (0..1440). 1440 = end-of-day. */
  close: number;
}

/**
 * Reject a timezone the runtime cannot actually resolve, AT PARSE TIME.
 *
 * A shape check alone let `"Not/AReal_Zone"` through the parser and then blew
 * up much later inside `getMarketStatus` as an untyped `RangeError` — past the
 * try/catch this module's docs tell callers to put around `parsePythSchedule`,
 * so one malformed record in the ~3.6k-entry catalog took down a whole markets
 * response instead of degrading that one feed. Constructing the
 * formatter here is also what keeps `fmtCache` bounded to REAL zones: a bogus
 * name throws before it can be cached.
 */
function assertUsableTimezone(tz: string): void {
  // Cheap shape gate first — it rejects the obvious junk without paying for an
  // `Intl` construction, and keeps the error identical for both failure modes.
  if (!/^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+){0,2}$/.test(tz)) {
    throw new PythScheduleParseError(`invalid timezone: ${tz}`);
  }
  try {
    getFmt(tz);
  } catch {
    throw new PythScheduleParseError(`invalid timezone: ${tz}`);
  }
}

/** `Open`/`O`/`open` → a full day; `Closed`/`C`/`closed` → an empty day; else `null`. */
function keywordDay(token: string): RawWindow[] | null {
  if (token === "Open" || token === "O" || token === "open") return [{ open: 0, close: 1440 }];
  if (token === "Closed" || token === "C" || token === "closed") return [];
  return null;
}

/**
 * Split the weekly segment into exactly 7 day slots.
 *
 * Pyth uses `,` both BETWEEN weekdays and (in the legacy encoding) between two
 * sessions of the SAME weekday, so a token list longer than 7 has to be folded
 * — and which day owns the extra token is not recoverable from the flat list
 * alone. (`&` exists precisely to remove that ambiguity and is handled as one
 * self-contained day token.)
 *
 * There is no direction that is right in general. Leftmost-greedy (what both
 * consumer copies shipped) mis-assigns `R,R,R,R,R,C,R,R`; rightmost-greedy
 * mis-assigns the legacy FX form `0000-1700,1701-2400,O,O,O,O,0000-1700,
 * 1701-2400`, where the surplus belongs to MONDAY but the last adjacent run
 * is Sunday's. Either way the result is a plausible-looking weekly calendar
 * that is simply wrong, with `slots.length === 7` so nothing throws — and a
 * wrong calendar reports a closed venue as tradable.
 *
 * So this does not guess. A fold is applied only when the token list admits
 * exactly ONE reading: exactly one maximal run of adjacent plain ranges can
 * absorb the surplus by collapsing entirely into one day
 * (`merges === run.length - 1`).
 * Anything else raises {@link PythScheduleParseError} naming the ambiguity,
 * which a caller can degrade on. The lunch-break shape
 * `0930-1200,1330-1600,C,C,C,C,C,C` is the unambiguous case and still parses.
 * Note a genuinely ambiguous legacy string (a Tokyo-style lunch break repeated
 * across five weekdays: one 10-token run against 5 merges) throws — see this
 * function's caller docs for why the fallback must not be "24/7".
 *
 * Live Pyth is unaffected either way: every one of the 3619 schedules in the
 * production catalog encodes multi-session days with `&` and carries exactly
 * 7 weekly tokens, so this path is reached only by legacy or third-party
 * payloads (verified against `/v1/symbols`, 2026-08-21).
 */
/**
 * A token that can take part in a fold: a plain range, i.e. neither a keyword
 * (pins its own day) nor an explicit `&` day (already one complete slot).
 */
function isFoldable(token: string): boolean {
  return keywordDay(token) === null && !token.includes("&");
}

/** Maximal runs of adjacent foldable tokens — the only places surplus can go. */
function foldableRuns(tokens: string[]): { start: number; length: number }[] {
  const runs: { start: number; length: number }[] = [];
  for (let i = 0; i < tokens.length; ) {
    if (!isFoldable(tokens[i]!)) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < tokens.length && isFoldable(tokens[i]!)) i += 1;
    if (i - start >= 2) runs.push({ start, length: i - start });
  }
  return runs;
}

function parseWeeklySlots(input: string): RawWindow[][] {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // How many surplus range tokens must be folded into a neighbouring day. A
  // shortfall is unparseable up front; a surplus the fold cannot actually
  // absorb (keyword tokens pin their own day and never merge) simply leaves
  // too many slots, which the count check after the walk rejects.
  const merges = tokens.length - 7;
  if (merges < 0) {
    throw new PythScheduleParseError(
      `expected 7 weekday slots, got ${String(tokens.length)}: ${input}`,
    );
  }

  // Scanning for runs is only meaningful when there IS a surplus to place, and
  // every schedule in the live catalog has exactly 7 tokens — so on real input
  // this whole block is skipped.
  let foldAt: { start: number; length: number } | null = null;
  if (merges > 0) {
    // A run can only take the surplus unambiguously by collapsing ENTIRELY
    // into one day. Absorbing fewer tokens than it holds would leave a choice
    // of which tokens pair up (`R,R,R` with one merge is two readings), so a
    // longer run is not a candidate at all rather than a preferred one.
    const usable = foldableRuns(tokens).filter((run) => run.length - 1 === merges);
    if (usable.length !== 1) {
      throw new PythScheduleParseError(
        `ambiguous weekday fold: ${String(tokens.length)} tokens for 7 days, ` +
          `${String(usable.length)} ways to assign the surplus — cannot tell which day ` +
          `owns it: ${input}`,
      );
    }
    foldAt = usable[0]!;
  }

  const slots: RawWindow[][] = [];
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i]!;
    if (foldAt !== null && i === foldAt.start) {
      // The one unambiguous run: the whole run collapses into a single day.
      slots.push(tokens.slice(i, i + foldAt.length).map((t) => parseRange(t)));
      i += foldAt.length;
      continue;
    }
    const keyword = keywordDay(token);
    if (keyword !== null) {
      slots.push(keyword);
    } else if (token.includes("&")) {
      // Explicit multi-session day — already one complete slot, never folded.
      slots.push(token.split("&").map((part) => parseRange(part.trim())));
    } else {
      slots.push([parseRange(token)]);
    }
    i += 1;
  }

  // No count check here: the walk emits one slot per token except at the one
  // fold, which collapses exactly `merges + 1` of them, so `slots.length` is
  // `tokens.length - merges` — 7 by the arithmetic above. The unparseable
  // cases (too few tokens, an ambiguous surplus) already threw.
  return slots;
}

function parseRange(input: string): RawWindow {
  const parts = input.split("-");
  const p0 = parts[0];
  const p1 = parts[1];
  if (parts.length !== 2 || p0 === undefined || p1 === undefined) {
    throw new PythScheduleParseError(`invalid HHMM-HHMM range: ${input}`);
  }
  return {
    open: parseHHMMCompact(p0),
    close: parseHHMMCompact(p1),
  };
}

function parseHHMMCompact(input: string): number {
  if (!/^\d{4}$/.test(input)) {
    throw new PythScheduleParseError(`invalid HHMM: ${input}`);
  }
  const hours = Number(input.slice(0, 2));
  const minutes = Number(input.slice(2));
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    throw new PythScheduleParseError(`invalid HHMM: ${input}`);
  }
  return hours * 60 + minutes;
}

function parseHolidays(input: string): HolidayDate[] {
  if (input === "") return [];
  const results: HolidayDate[] = [];
  for (const raw of input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)) {
    // New format: MMDD/action — e.g. 0101/C (closed) or 1224/0000-1700 (modified hours).
    // Old format: bare MMDD.
    const slashIdx = raw.indexOf("/");
    const mmdd = slashIdx !== -1 ? raw.slice(0, slashIdx) : raw;
    const action = slashIdx !== -1 ? raw.slice(slashIdx + 1) : undefined;

    // Non-MMDD sentinels (e.g. Pyth's '0' placeholder for "no holidays") — skip.
    if (!/^\d{4}$/.test(mmdd)) continue;

    const month = Number(mmdd.slice(0, 2));
    const day = Number(mmdd.slice(2));
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new PythScheduleParseError(`invalid holiday MMDD: ${mmdd}`);
    }

    // Closure spelling matches `keywordDay`'s tolerance (`C` / `Closed`, any
    // case): live Pyth only ever emits `C`, but accepting one spelling here
    // and three there is the kind of asymmetry that silently drops a holiday.
    // Anything else is MODIFIED HOURS — `0930-1300`, or `&`-joined windows —
    // which replace the weekly schedule for that date rather than being a
    // closure. Discarding them made an early-close day read as a normal one.
    let sessions: { open: string; close: string }[] | undefined;
    if (action !== undefined && !/^(c|closed)$/i.test(action)) {
      sessions = action.split("&").map((part) => {
        const window = parseRange(part.trim());
        return { open: minutesToHHMM(window.open), close: minutesToHHMM(window.close) };
      });
    }
    results.push(sessions ? { month, day, sessions } : { month, day });
  }
  return results;
}

function groupIntoSessions(slots: RawWindow[][]): TradingSession[] {
  const groups = new Map<string, { open: number; close: number; days: number[] }>();

  for (let pythDay = 0; pythDay < 7; pythDay++) {
    // Pyth Mon=0 → Sun-first Mon=1; Pyth Sun=6 → Sun=0.
    const isoDay = (pythDay + 1) % 7;
    // slots has exactly 7 elements (validated by parseWeeklySlots)
    const daySlots = slots[pythDay];
    if (daySlots === undefined) continue;
    for (const window of daySlots) {
      const key = `${String(window.open)}-${String(window.close)}`;
      const existing = groups.get(key);
      if (existing !== undefined) {
        existing.days.push(isoDay);
      } else {
        groups.set(key, {
          open: window.open,
          close: window.close,
          days: [isoDay],
        });
      }
    }
  }

  return [...groups.values()]
    .map(({ open, close, days }) => ({
      open: minutesToHHMM(open),
      close: minutesToHHMM(close === 1440 ? 0 : close),
      days: [...days].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.open.localeCompare(b.open));
}

/**
 * Minutes-from-midnight → `"HH:MM"`. A 1440 close renders `"24:00"`, which is
 * what a day-scoped holiday window wants: end-of-day has to stay
 * distinguishable from start-of-day. Weekly sessions map it to `"00:00"` at
 * the call site, because there a close <= open already means "next day".
 */
function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================================================
// Market-status walker (pure; holiday-aware weekly schedule)
// ============================================================================

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
/** How far the holiday walks look ahead — covers any plausible cluster of consecutive closures. */
/**
 * How far to scan for the next holiday BOUNDARY.
 *
 * Distinct from {@link LOOKAHEAD_WEEKS}, which bounds how far the OPEN-event
 * walk looks. The next holiday itself can be most of a year out —
 * a 24/7 venue queried on Dec 1 with only a `1225` holiday used to fall off
 * the 21-day window and report `nextStatusChangeIn: null`, which the result
 * type documents as "24/7 or paused". A consumer caching on that holds "open
 * forever" straight through the closure. Holidays are `MMDD`, so a year is a
 * complete answer, and the scan is integer date arithmetic that converts only
 * the winning day.
 */
const HOLIDAY_LOOKAHEAD_DAYS = 366;
const LOOKAHEAD_WEEKS = 3;

export interface MarketStatusResult {
  status: "open" | "closed" | "paused";
  /** Milliseconds until next status change; null for 24/7 or paused. */
  nextStatusChangeIn: number | null;
}

/**
 * Pure function — calculates market open/closed status from trading hours + now.
 *
 * @param tradingHours  null means 24/7 (crypto)
 * @param paused        forces `paused`, short-circuiting the schedule. Checked
 *                      BEFORE the 24/7 branch, so an on-chain-paused crypto
 *                      market (tradingHours === null) still reports paused.
 * @param now           injectable for testing; defaults to new Date()
 */
export function getMarketStatus(
  tradingHours: TradingHours | null,
  paused: boolean,
  now?: Date,
): MarketStatusResult {
  if (paused) {
    return { status: "paused", nextStatusChangeIn: null };
  }
  if (tradingHours === null) {
    return { status: "open", nextStatusChangeIn: null };
  }

  const current = now ?? new Date();
  const result = computeScheduledStatus(tradingHours, current);

  // Every delta above is computed from minute-of-week arithmetic, i.e. as if
  // `now` sat exactly on the start of the current minute — so a boundary was
  // reported up to 59.999s LATE, and a consumer scheduling a re-check off this
  // value woke to find the status had already changed. Subtract the sub-minute
  // offset. (`getTime() % 60_000` is zone-independent: every modern IANA offset
  // is a whole number of minutes.)
  if (result.nextStatusChangeIn === null) return result;
  const intoMinute = current.getTime() % MS_PER_MINUTE;
  return {
    ...result,
    nextStatusChangeIn: Math.max(0, result.nextStatusChangeIn - intoMinute),
  };
}

/** Represents a boundary event in the weekly timeline (in minutes from Sun 00:00). */
interface WeeklyEvent {
  /** Minutes from Sunday 00:00 in the market timezone */
  minuteOfWeek: number;
  type: "open" | "close";
}

interface LocalParts {
  dayOfWeek: number;
  hour: number;
  minute: number;
  month: number;
  day: number;
  /** Needed to step a real calendar when scanning ahead for a holiday. */
  year: number;
}

// `Intl.DateTimeFormat` construction is heavy; cache one formatter per
// timezone so per-request hot paths (a markets list endpoint) don't
// re-allocate it.
const fmtCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Per-`TradingHours` derived state — the sorted/merged weekly event list and
 * the holiday lookup set. Both are pure functions of the schedule object, and
 * `getMarketStatus` is called per market per request against the SAME objects
 * (a service refreshes its schedule map on an interval, not per call), so
 * re-parsing every `"HH:MM"` and re-sorting on each call is pure rework —
 * exactly the cost `fmtCache` above already avoids for the formatter.
 *
 * A `WeakMap` keeps this leak-free: an entry dies with the schedule object it
 * describes, so a refreshed map's old entries are collectable.
 *
 * CONTRACT: a `TradingHours` is treated as IMMUTABLE. The cache is keyed on
 * object identity, so mutating one in place (`hours.holidays = next`) keeps
 * returning the state derived before the mutation, for the object's lifetime
 * and with no way to invalidate. Refresh by replacing the object — which is
 * what a service rebuilding its schedule map from a catalog fetch does anyway.
 */
const derivedCache = new WeakMap<TradingHours, DerivedSchedule>();

interface DerivedSchedule extends WeeklyCoverage {
  /** Every holiday date, closures and modified-hours alike. */
  holidays: Set<number>;
  /** Replacement windows for the modified-hours dates only. */
  holidayHours: Map<number, { start: number; end: number }[]>;
}

function derive(tradingHours: TradingHours): DerivedSchedule {
  let derived = derivedCache.get(tradingHours);
  if (!derived) {
    // The walker is exported for a shape that crosses process boundaries
    // (cached JSON, the consumers' own markets types), so it routinely arrives
    // WITHOUT having passed through `parsePythSchedule` — where this check
    // otherwise lives. Unchecked, a bad zone surfaces as a raw `RangeError`
    // from `Intl` deep inside `toLocalParts`, escaping the try/catch callers
    // put around the parser and failing a whole markets response over one row.
    // Behind the cache miss, so it costs one regex per schedule object.
    assertUsableTimezone(tradingHours.timezone);
    derived = {
      ...buildWeeklyEvents(tradingHours.sessions),
      holidays: buildHolidaySet(tradingHours.holidays),
      holidayHours: buildHolidayHours(tradingHours.holidays),
    };
    derivedCache.set(tradingHours, derived);
  }
  return derived;
}
function getFmt(timezone: string): Intl.DateTimeFormat {
  let fmt = fmtCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour12: false,
    });
    fmtCache.set(timezone, fmt);
  }
  return fmt;
}

function toLocalParts(date: Date, timezone: string): LocalParts {
  const parts = getFmt(timezone).formatToParts(date);
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "1970");

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { dayOfWeek: dayMap[weekdayStr] ?? 0, hour, minute, month, day, year };
}

/**
 * Parse `"HH:MM"` to `{ hour, minute }`.
 *
 * Validated, not coerced. `Number("9:30am".split(":")[1])` is `NaN`, and a NaN
 * minute-of-week flows all the way to `new Date(NaN)`, where `Intl` throws a
 * raw `RangeError: Invalid time value` — an untyped throw from deep inside the
 * walker, which sails past the try/catch this module tells callers to put
 * around the parser. Same escape hatch {@link assertUsableTimezone} closes for
 * timezones, and it matters for the same reason: `TradingHours` reaches
 * {@link getMarketStatus} from cached JSON and consumers' own types, so it has
 * often never been through {@link parsePythSchedule}.
 */
function parseHHMM(s: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s);
  const hour = match ? Number(match[1]) : NaN;
  const minute = match ? Number(match[2]) : NaN;
  if (!match || hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) {
    throw new PythScheduleParseError(`invalid session time (expected HH:MM): ${s}`);
  }
  return { hour, minute };
}

/** Minutes from Sunday 00:00 for a given day + time. */
function minuteOfWeek(day: number, hour: number, minute: number): number {
  return day * 24 * 60 + hour * 60 + minute;
}

/**
 * The instant at which the local clock next reads `targetMow` (minutes from
 * Sunday 00:00 in `timezone`), plus that instant's local reading.
 *
 * A minute-of-week delta is LOCAL time; multiplying it by 60_000 assumes the
 * UTC offset never moves, which is wrong across a DST boundary — a
 * Friday-close → Monday-open countdown over a spring-forward came out a full
 * hour late. So the naive delta is only a seed: we re-read the local clock at
 * the guessed instant and fold the residual back in.
 *
 * `occurrence` selects a LATER repeat of the same weekly slot (0 = the next
 * one, 1 = a week after that, …). It is applied to the seed, NOT added to the
 * result, so every occurrence gets its own correction — adding
 * `week × 604_800_000` afterwards would reintroduce the very fixed-offset
 * assumption this function exists to remove.
 *
 * `from` lets a caller pass the local reading of `now` it already computed;
 * `toLocalParts` is the heavy `Intl` path this module caches formatters for.
 * The converged reading is returned for the same reason — callers that test
 * the target date (the holiday walks) would otherwise recompute it.
 */
/**
 * Minutes forward from `fromMow` to the next occurrence of `targetMow`.
 *
 * Never 0: an event whose minute-of-week is exactly `now` has already
 * happened, so the NEXT one is a full week out. Both the resolver below and
 * the candidate ordering in `findNextNonHolidayOpen` go through this — they
 * used to compute it separately (`delta <= 0 ? +WEEK` vs a bare `% WEEK`) and
 * disagreed on precisely that boundary, so the candidates were walked in an
 * order the resolver did not share.
 */
function minutesUntilNextMow(fromMow: number, targetMow: number): number {
  const delta = targetMow - fromMow;
  return delta <= 0 ? delta + MINUTES_PER_WEEK : delta;
}

function nextLocalMinuteOfWeek(
  now: Date,
  timezone: string,
  targetMow: number,
  occurrence = 0,
  from?: LocalParts,
): { ms: number; at: LocalParts } {
  const local = from ?? toLocalParts(now, timezone);
  const delta = minutesUntilNextMow(
    minuteOfWeek(local.dayOfWeek, local.hour, local.minute),
    targetMow,
  );

  let ms = (delta + occurrence * MINUTES_PER_WEEK) * MS_PER_MINUTE;
  // One correction, then one verifying read — a single fold settles any
  // standard ≤2h shift, and no IANA zone shifts twice inside that window.
  let at = toLocalParts(new Date(now.getTime() + ms), timezone);
  for (let attempt = 0; attempt < 2; attempt++) {
    let residual = targetMow - minuteOfWeek(at.dayOfWeek, at.hour, at.minute);
    // Fold into (−½ week, +½ week] so a week-boundary wrap isn't read as a
    // week-long correction.
    if (residual > MINUTES_PER_WEEK / 2) residual -= MINUTES_PER_WEEK;
    if (residual < -MINUTES_PER_WEEK / 2) residual += MINUTES_PER_WEEK;
    if (residual === 0) break;
    ms += residual * MS_PER_MINUTE;
    at = toLocalParts(new Date(now.getTime() + ms), timezone);
  }
  return { ms, at };
}

/** Minutes elapsed since local midnight. */
function minutesIntoLocalDay(parts: LocalParts): number {
  return parts.hour * 60 + parts.minute;
}

/**
 * Milliseconds until the local midnight `daysAhead` days from now (1 = the
 * next one). Same seed-then-correct shape as
 * {@link nextLocalMinuteOfWeek} — a day is not a fixed number of
 * milliseconds across a DST change either.
 */
function msUntilLocalMidnight(
  now: Date,
  timezone: string,
  daysAhead: number,
  from: LocalParts,
): number {
  let ms = (24 * 60 - minutesIntoLocalDay(from) + (daysAhead - 1) * 24 * 60) * MS_PER_MINUTE;
  for (let attempt = 0; attempt < 2; attempt++) {
    const intoDay = minutesIntoLocalDay(toLocalParts(new Date(now.getTime() + ms), timezone));
    if (intoDay === 0) break;
    // Landed after midnight → pull back; landed before it (23:00 the previous
    // day, a fall-back artefact) → push forward.
    ms += (intoDay > 12 * 60 ? 24 * 60 - intoDay : -intoDay) * MS_PER_MINUTE;
  }
  return ms;
}

/**
 * Milliseconds until the next local midnight that STARTS a day matching
 * `wantHoliday` — the status-change clock for a 24/7 venue that observes
 * holidays (its weekly event list is empty, so the event walker has nothing to
 * measure). `null` when no such day falls inside the lookahead.
 *
 * The SEARCH is pure integer calendar arithmetic on `(month, day)` keys, and
 * only the winning day is converted to an instant. Walking instants instead
 * would spend an `Intl.formatToParts` per candidate day — and the dominant
 * call is "when does the next holiday start", which on an ordinary day scans
 * the whole window and finds nothing, so that cost is paid in full every time.
 */
function msUntilLocalDayStart(
  now: Date,
  timezone: string,
  holidaySet: Set<number>,
  wantHoliday: boolean,
  from: LocalParts,
): number | null {
  // A UTC date is used purely as a calendar counter over the LOCAL date, so
  // month lengths and leap years come out right without touching `Intl`.
  const probe = new Date(Date.UTC(from.year, from.month - 1, from.day));
  for (let daysAhead = 1; daysAhead <= HOLIDAY_LOOKAHEAD_DAYS; daysAhead++) {
    probe.setUTCDate(probe.getUTCDate() + 1);
    const candidate = { month: probe.getUTCMonth() + 1, day: probe.getUTCDate() };
    if (isHoliday(holidaySet, candidate) === wantHoliday) {
      return msUntilLocalMidnight(now, timezone, daysAhead, from);
    }
  }
  return null;
}

/**
 * Milliseconds until the next MODIFIED-hours session opens, or `null` if none
 * falls inside the lookahead.
 *
 * Needed because a modified date is not tied to the weekly schedule: a venue
 * that is normally shut on Sunday can still have a `1227/1000-1200` session,
 * and the weekly event walk has no `open` event anywhere near it. Answering
 * "when does trading next resume" purely from weekly events therefore skipped
 * the session entirely and pointed at the following Monday — while querying
 * during the session itself correctly reported open. That asymmetry is the bug.
 *
 * Same integer-calendar scan as {@link msUntilLocalDayStart}: only the winning
 * day is converted to an instant.
 */
function msUntilNextModifiedOpen(
  now: Date,
  timezone: string,
  holidayHours: Map<number, { start: number; end: number }[]>,
  from: LocalParts,
): number | null {
  if (holidayHours.size === 0) return null;

  const probe = new Date(Date.UTC(from.year, from.month - 1, from.day));
  for (let daysAhead = 1; daysAhead <= HOLIDAY_LOOKAHEAD_DAYS; daysAhead++) {
    probe.setUTCDate(probe.getUTCDate() + 1);
    const windows = holidayHours.get(holidayKey(probe.getUTCMonth() + 1, probe.getUTCDate()));
    if (windows === undefined || windows.length === 0) continue;
    const midnight = msUntilLocalMidnight(now, timezone, daysAhead, from);
    return midnight + windows[0]!.start * MS_PER_MINUTE;
  }
  return null;
}

/** The sooner of two candidate deltas, either of which may be absent. */
function soonest(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/**
 * Build the week's open/close events — derived from MERGED OPEN INTERVALS, not
 * by cancelling event pairs.
 *
 * The distinction matters. Cancelling a `close`+`open` at the same
 * minute-of-week pairwise looks equivalent and is not: it assumes the sorted
 * list alternates. Two sessions ending at the same minute (overlapping, or
 * duplicated across a `&` day) put two `close`s in a row, the pairwise scan
 * then eats the following `open`, and the market reads CLOSED for a session
 * that is open — silently, since the resulting list is still well-formed.
 *
 * Coverage cannot express that. Each session-day becomes a half-open interval
 * on the week circle, overlapping and touching intervals merge, and the
 * boundaries of what survives ARE the events. Overlaps, duplicates and
 * forex-continuous rollovers all collapse for the same reason instead of via
 * three special cases, and the output alternates open/close by construction —
 * which is exactly what `computeScheduledStatus` assumes.
 */
function buildWeeklyEvents(sessions: TradingHours["sessions"]): WeeklyCoverage {
  // Half-open [start, end) intervals in minutes-of-week, wrapping split at the
  // week boundary so the merge below is plain linear-interval arithmetic.
  const intervals: { start: number; end: number }[] = [];

  for (const session of sessions) {
    const openTime = parseHHMM(session.open);
    const closeTime = parseHHMM(session.close);
    const openMinutes = openTime.hour * 60 + openTime.minute;
    const closeMinutes = closeTime.hour * 60 + closeTime.minute;

    // Duration in minutes: a same-day session is the plain difference; a
    // cross-day one (close <= open) runs into the next day; equal times are
    // the forex 24h session.
    const duration =
      closeMinutes > openMinutes
        ? closeMinutes - openMinutes
        : MINUTES_PER_DAY - openMinutes + closeMinutes;

    for (const day of session.days) {
      const start = minuteOfWeek(day, openTime.hour, openTime.minute);
      const end = start + duration;
      if (end <= MINUTES_PER_WEEK) {
        intervals.push({ start, end });
      } else {
        intervals.push({ start, end: MINUTES_PER_WEEK });
        intervals.push({ start: 0, end: end - MINUTES_PER_WEEK });
      }
    }
  }

  // No coverage at all. Distinct from full coverage below, and the two used to
  // be indistinguishable — both returned an empty event list, so the caller
  // guessed from `sessions.length` and got it wrong for a session whose `days`
  // is empty: a venue that never opens read as 24/7 tradable.
  if (intervals.length === 0) return { events: [], alwaysOpen: false };

  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number }[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    // `<=` (not `<`) merges TOUCHING intervals too: a close and an open at the
    // same minute is one continuous stretch, not a zero-length gap.
    if (last !== undefined && iv.start <= last.end) {
      if (iv.end > last.end) last.end = iv.end;
    } else {
      merged.push({ ...iv });
    }
  }

  // The split above can leave a run ending at the week boundary and another
  // starting at 0; on the circle those are one stretch.
  const first = merged[0]!;
  const last = merged[merged.length - 1]!;
  if (merged.length > 1 && first.start === 0 && last.end === MINUTES_PER_WEEK) {
    first.start = last.start - MINUTES_PER_WEEK;
    merged.pop();
  }

  // Fully covered week ⇒ never closes. An empty event list is how
  // `computeScheduledStatus` recognises 24/7 (and still applies holidays).
  if (merged.length === 1 && merged[0]!.end - merged[0]!.start >= MINUTES_PER_WEEK) {
    return { events: [], alwaysOpen: true };
  }

  const events: WeeklyEvent[] = [];
  for (const iv of merged) {
    events.push({
      minuteOfWeek: ((iv.start % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK,
      type: "open",
    });
    events.push({ minuteOfWeek: iv.end % MINUTES_PER_WEEK, type: "close" });
  }
  events.sort((a, b) => a.minuteOfWeek - b.minuteOfWeek || (a.type === "close" ? -1 : 1));
  return { events, alwaysOpen: false };
}

/**
 * What a week's sessions cover. `events` empty means the status never changes
 * on schedule — `alwaysOpen` says in which direction (holidays can still mask
 * an always-open venue, which is why this is not simply a boolean status).
 */
interface WeeklyCoverage {
  events: WeeklyEvent[];
  alwaysOpen: boolean;
}

/**
 * The SCHEDULED status at a minute-of-week — holidays not considered.
 *
 * Boundary rule: an open minute IS open (inclusive), a close minute IS closed
 * (exclusive). Extracted because the holiday logic needs to ask the same
 * question about a FUTURE instant (is the venue mid-session when a holiday
 * lifts?), and answering it two different ways is how the two disagreed.
 */
/** `minuteOfWeek` for an already-converted local reading. */
function minuteOfWeekOf(parts: LocalParts): number {
  return minuteOfWeek(parts.dayOfWeek, parts.hour, parts.minute);
}

/**
 * Ms from `now` to the end of the holiday run covering `from` — but only when
 * the venue is SCHEDULED-OPEN at that instant, i.e. it resumes mid-session.
 *
 * `null` when the holiday run ends outside the lookahead, or when the venue is
 * scheduled-closed then (so the reopen is a later `open` event, not this
 * boundary).
 *
 * Both holiday arms need this. A venue is closed on a holiday even mid-session,
 * so it comes back the moment the holiday lifts — which for any session
 * spanning local midnight is NOT the next `open` event. Asking only about
 * `open` events reported the reopening up to a full session late, whether the
 * holiday is happening now or is still ahead.
 */
function midSessionReopen(
  events: WeeklyEvent[],
  holidaySet: Set<number>,
  now: Date,
  timezone: string,
  /** The instant inside the holiday run to measure from (`now`, or a future open). */
  from: { at: LocalParts; msFromNow: number },
): number | null {
  const base = new Date(now.getTime() + from.msFromNow);
  const untilLift = msUntilLocalDayStart(base, timezone, holidaySet, false, from.at);
  if (untilLift === null) return null;

  const liftsIn = from.msFromNow + untilLift;
  const liftsAt = toLocalParts(new Date(now.getTime() + liftsIn), timezone);
  return scheduledStatusAt(events, minuteOfWeekOf(liftsAt)) === "open" ? liftsIn : null;
}

function scheduledStatusAt(events: WeeklyEvent[], mow: number): "open" | "closed" {
  const exact = events.find((e) => e.minuteOfWeek === mow);
  if (exact) return exact.type === "open" ? "open" : "closed";
  const afterIdx = events.findIndex((e) => e.minuteOfWeek > mow);
  const prev = events[((afterIdx === -1 ? 0 : afterIdx) - 1 + events.length) % events.length];
  return prev?.type === "open" ? "open" : "closed";
}

/**
 * Status on a date whose MODIFIED hours replace the schedule, or `null` once
 * the last window has passed (shut for the rest of the day — the caller's
 * holiday walk then owns the answer).
 *
 * Windows are minutes-from-midnight and day-scoped, so this is plain arithmetic
 * against the local time of day; a `24:00` end stays distinct from `00:00`.
 */
function modifiedHoursStatus(
  windows: { start: number; end: number }[],
  local: LocalParts,
): MarketStatusResult | null {
  const intoDay = minutesIntoLocalDay(local);

  const openNow = windows.find((w) => intoDay >= w.start && intoDay < w.end);
  if (openNow !== undefined) {
    return { status: "open", nextStatusChangeIn: (openNow.end - intoDay) * MS_PER_MINUTE };
  }
  const laterToday = windows.find((w) => w.start > intoDay);
  if (laterToday !== undefined) {
    return { status: "closed", nextStatusChangeIn: (laterToday.start - intoDay) * MS_PER_MINUTE };
  }
  return null;
}

function computeScheduledStatus(tradingHours: TradingHours, now: Date): MarketStatusResult {
  const { events, alwaysOpen, holidays: holidaySet, holidayHours } = derive(tradingHours);

  // An EMPTY event list has two opposite meanings, and collapsing them to
  // "open" reported a permanently-closed venue as tradable:
  //   - NO coverage (no sessions, or sessions that name no days) ⇒ the venue
  //     never opens;
  //   - coverage spanning the whole week (a 24/7 schedule) ⇒ it never closes —
  //     but its HOLIDAYS still mask it, which an early return would skip.
  // `buildWeeklyEvents` reports which via `alwaysOpen`; inferring it from
  // `sessions.length` mis-read a session whose `days` is empty as 24/7.
  // This arm reads no clock at all, so `local` is derived below it.
  if (events.length === 0 && !alwaysOpen) {
    return { status: "closed", nextStatusChangeIn: null };
  }

  const local = toLocalParts(now, tradingHours.timezone);

  // MODIFIED HOURS replace the weekly schedule for this date — an early close
  // or a split session. This runs before EVERY other arm, the 24/7 one
  // included: a continuous venue with an early close is closed outside those
  // windows, and evaluating the 24/7 arm first reported it shut for the whole
  // day instead (it only knows full closures). Falling through means the last
  // window has passed, i.e. shut for the rest of the day, which the holiday
  // walks below answer correctly.
  const modifiedToday = holidayHours.get(holidayKey(local.month, local.day));
  if (modifiedToday !== undefined) {
    const within = modifiedHoursStatus(modifiedToday, local);
    if (within !== null) return within;
  }

  if (events.length === 0) {
    // Continuous 24/7: only a holiday can change the status.
    const onHoliday = isHoliday(holidaySet, local);
    return {
      status: onHoliday ? "closed" : "open",
      nextStatusChangeIn:
        holidaySet.size === 0
          ? null
          : msUntilLocalDayStart(now, tradingHours.timezone, holidaySet, !onHoliday, local),
    };
  }

  const nowMow = minuteOfWeek(local.dayOfWeek, local.hour, local.minute);

  if (isHoliday(holidaySet, local)) {
    // The venue reopens the moment it is BOTH off-holiday and scheduled-open.
    // When the holiday lifts mid-session — a daily 18:00→17:00 venue on the
    // morning after — that instant is the holiday's end at local midnight, not
    // the next scheduled `open` event. Looking only for the next non-holiday
    // open reported the reopening up to a full session late.
    const midSession = midSessionReopen(events, holidaySet, now, tradingHours.timezone, {
      at: local,
      msFromNow: 0,
    });

    const viaSchedule =
      midSession ?? findNextNonHolidayOpen(events, holidaySet, now, tradingHours.timezone, local);
    return {
      status: "closed",
      nextStatusChangeIn: soonest(
        viaSchedule,
        msUntilNextModifiedOpen(now, tradingHours.timezone, holidayHours, local),
      ),
    };
  }

  // Determine current status and find next event.
  // Walk through events to find where `nowMow` falls.
  //
  // The events array is sorted. We need to find the next event AFTER nowMow.
  // If we're at or past an open event but before the next close → open.
  // If we're at or past a close event but before the next open → closed.
  //
  // Boundary rule: open time IS open (inclusive), close time IS closed (exclusive).
  // So at exactly open → status=open (next event is close).
  //    at exactly close → status=closed (next event is open).

  // Find the first event strictly after nowMow
  let nextIdx = events.findIndex((e) => e.minuteOfWeek > nowMow);

  if (nextIdx === -1) {
    // We're past all events this week → wrap around to first event next week
    nextIdx = 0;
  }

  const currentStatus = scheduledStatusAt(events, nowMow);

  // Find the next event that represents a STATUS CHANGE — if we're open, the
  // next 'close'; if closed, the next 'open' — scanning forward from `nextIdx`
  // and wrapping into next week.
  const targetType = currentStatus === "open" ? "close" : "open";
  const nextChangeEvent = [...events.slice(nextIdx), ...events.slice(0, nextIdx)].find(
    (candidate) => candidate.type === targetType,
  );

  if (nextChangeEvent === undefined) {
    // Should not happen with valid schedules
    return { status: currentStatus, nextStatusChangeIn: null };
  }

  // Local minute-of-week → a real instant (DST-correct; see the helper). The
  // converged local reading comes back with it, so the holiday test below
  // needs no second `Intl` pass.
  const next = nextLocalMinuteOfWeek(
    now,
    tradingHours.timezone,
    nextChangeEvent.minuteOfWeek,
    0,
    local,
  );
  let nextStatusChangeIn = next.ms;

  if (holidaySet.size > 0) {
    if (currentStatus === "open") {
      // A holiday's local midnight is itself a status change: an open venue
      // closes when the holiday STARTS, even mid-session, which is earlier than
      // the scheduled close whenever a holiday falls inside the session. Only
      // the `open`-lands-on-a-holiday case used to be handled, so an open venue
      // the night before a holiday reported its close hours late.
      const holidayStarts = msUntilLocalDayStart(
        now,
        tradingHours.timezone,
        holidaySet,
        true,
        local,
      );
      if (holidayStarts !== null && holidayStarts < nextStatusChangeIn) {
        nextStatusChangeIn = holidayStarts;
      }
    } else if (nextChangeEvent.type === "open" && isHoliday(holidaySet, next.at)) {
      // The upcoming open lands on a date with MODIFIED hours: the venue does
      // open that day, just at its replacement time. Treating the date as a
      // plain holiday skipped the whole session and reported the next NORMAL
      // trading day instead.
      const modifiedThen = holidayHours.get(holidayKey(next.at.month, next.at.day));
      if (modifiedThen !== undefined && modifiedThen.length > 0) {
        // Midnight of that local date, plus the first window's start.
        const midnight = next.ms - minutesIntoLocalDay(next.at) * MS_PER_MINUTE;
        const opensIn = midnight + modifiedThen[0]!.start * MS_PER_MINUTE;
        if (opensIn > 0) {
          nextStatusChangeIn = opensIn;
          return { status: currentStatus, nextStatusChangeIn };
        }
      }
      // Closed by schedule, and the upcoming open lands on a holiday.
      //
      // The masked session may still be RUNNING when that holiday lifts — a
      // Monday 18:00→17:00 session on a Monday holiday resumes at Tuesday
      // midnight, not at the following Monday's open. Skipping straight to the
      // next non-holiday `open` reported that reopening a week late.
      const midSession = midSessionReopen(events, holidaySet, now, tradingHours.timezone, {
        at: next.at,
        msFromNow: next.ms,
      });
      const skipped =
        midSession ?? findNextNonHolidayOpen(events, holidaySet, now, tradingHours.timezone, local);
      if (skipped !== null) nextStatusChangeIn = skipped;
    }
  }

  if (currentStatus === "closed") {
    // A modified-hours session can sit on a day the weekly schedule never
    // opens, so it has no `open` event for the walk above to find. Take
    // whichever comes first.
    nextStatusChangeIn =
      soonest(
        nextStatusChangeIn,
        msUntilNextModifiedOpen(now, tradingHours.timezone, holidayHours, local),
      ) ?? nextStatusChangeIn;
  }

  return { status: currentStatus, nextStatusChangeIn };
}

function holidayKey(month: number, day: number): number {
  return month * 100 + day;
}

/**
 * Replacement windows for a modified-hours holiday, as minutes-from-midnight.
 * An empty array means a FULL closure (`MMDD/C`).
 */
function holidayWindows(entry: HolidayDate): { start: number; end: number }[] {
  return (entry.sessions ?? []).map((w) => {
    const open = parseHHMM(w.open);
    const close = parseHHMM(w.close);
    return { start: open.hour * 60 + open.minute, end: close.hour * 60 + close.minute };
  });
}

/** Only the dates that REPLACE the schedule, keyed like {@link buildHolidaySet}. */
function buildHolidayHours(
  holidays: HolidayDate[] | undefined,
): Map<number, { start: number; end: number }[]> {
  const map = new Map<number, { start: number; end: number }[]>();
  for (const h of holidays ?? []) {
    const windows = holidayWindows(h);
    if (windows.length > 0) map.set(holidayKey(h.month, h.day), windows);
  }
  return map;
}

function buildHolidaySet(holidays: HolidayDate[] | undefined): Set<number> {
  const set = new Set<number>();
  if (holidays) {
    for (const h of holidays) set.add(holidayKey(h.month, h.day));
  }
  return set;
}

function isHoliday(holidaySet: Set<number>, parts: { month: number; day: number }): boolean {
  return holidaySet.has(holidayKey(parts.month, parts.day));
}

/**
 * Walk `open` events chronologically up to 3 weeks ahead and return the
 * ms-delta to the first one that doesn't land on a holiday. The lookahead
 * window covers any plausible cluster of consecutive holidays. Returns
 * `null` if no qualifying open is found.
 */
function findNextNonHolidayOpen(
  events: WeeklyEvent[],
  holidaySet: Set<number>,
  now: Date,
  timezone: string,
  /** `now`'s local reading, already derived by the caller. */
  local: LocalParts,
): number | null {
  const opens = events.filter((e) => e.type === "open");
  if (opens.length === 0) return null;

  // Chronological order is knowable WITHOUT resolving anything: within a week
  // the opens are ordered by how far ahead their minute-of-week sits, and the
  // weeks are already in order. So sort by that offset once and resolve
  // lazily — the common case answers on the first candidate instead of
  // resolving every open for three weeks (each resolution costs 1-3
  // `Intl.formatToParts`, and this runs per market on a markets-list request).
  //
  // Resolution goes through `occurrence` rather than adding a fixed week of
  // milliseconds: a calendar week spanning a DST change is not 604_800_000 ms,
  // and the instant feeds straight back into the holiday test, where an hour's
  // drift can land on the wrong local date.
  const nowMow = minuteOfWeek(local.dayOfWeek, local.hour, local.minute);
  const ordered = [...opens].sort((a, b) => {
    const da = minutesUntilNextMow(nowMow, a.minuteOfWeek);
    const db = minutesUntilNextMow(nowMow, b.minuteOfWeek);
    return da - db;
  });

  for (let week = 0; week < LOOKAHEAD_WEEKS; week++) {
    for (const ev of ordered) {
      const candidate = nextLocalMinuteOfWeek(now, timezone, ev.minuteOfWeek, week, local);
      if (!isHoliday(holidaySet, candidate.at)) return candidate.ms;
    }
  }
  return null;
}
