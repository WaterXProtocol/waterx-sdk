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
 * malformed input — callers guard with try/catch and fall back to "no
 * schedule" (24/7) so a single bad feed doesn't break a whole market list.
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
 * response instead of degrading that one feed to 24/7. Constructing the
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
 * The fold is therefore anchored and applied from the RIGHT: keyword tokens
 * pin their own day, and surplus range tokens merge into the LATEST day that
 * can take them. Leftmost-greedy — what both consumer copies shipped — is
 * wrong whenever the multi-session day is not the first one: for
 * `R,R,R,R,R,C,R,R` it silently gave Monday two sessions, dropped Friday,
 * reported Saturday open, and emitted a duplicate weekday. Right-anchored
 * folding assigns the pair to Sunday, and still yields Monday for the
 * lunch-break shape `0930-1200,1330-1600,C,C,C,C,C,C`, where the pair is the
 * only adjacent range run.
 */
function parseWeeklySlots(input: string): RawWindow[][] {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // How many surplus range tokens must be folded into a neighbouring day. A
  // shortfall is unparseable up front; a surplus the fold cannot actually
  // absorb (keyword tokens pin their own day and never merge) simply leaves
  // too many slots, which the count check after the walk rejects.
  let merges = tokens.length - 7;
  if (merges < 0) {
    throw new PythScheduleParseError(
      `expected 7 weekday slots, got ${String(tokens.length)}: ${input}`,
    );
  }

  const slots: RawWindow[][] = [];
  for (let i = tokens.length - 1; i >= 0; ) {
    const token = tokens[i]!;
    const keyword = keywordDay(token);
    if (keyword !== null) {
      slots.unshift(keyword);
      i -= 1;
      continue;
    }
    if (token.includes("&")) {
      // Explicit multi-session day — already one complete slot, never folded.
      slots.unshift(token.split("&").map((part) => parseRange(part.trim())));
      i -= 1;
      continue;
    }
    const sessions = [parseRange(token)];
    i -= 1;
    // Absorb preceding plain ranges while folds remain — latest day first. A
    // malformed neighbour throws here rather than deferring: breaking out
    // would only hand the same token to the next outer iteration, which calls
    // the same parser and raises the same error.
    while (merges > 0 && i >= 0) {
      const prev = tokens[i]!;
      if (keywordDay(prev) !== null || prev.includes("&")) break;
      sessions.unshift(parseRange(prev));
      i -= 1;
      merges -= 1;
    }
    slots.unshift(sessions);
  }

  if (slots.length !== 7) {
    throw new PythScheduleParseError(
      `expected 7 weekday slots, got ${String(slots.length)}: ${input}`,
    );
  }
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

    // Modified hours (e.g. 1224/0000-1700): not a full closure — skip.
    if (action !== undefined && action !== "C") continue;
    // Non-MMDD sentinels (e.g. Pyth's '0' placeholder for "no holidays") — skip.
    if (!/^\d{4}$/.test(mmdd)) continue;

    const month = Number(mmdd.slice(0, 2));
    const day = Number(mmdd.slice(2));
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new PythScheduleParseError(`invalid holiday MMDD: ${mmdd}`);
    }
    results.push({ month, day });
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

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================================================
// Market-status walker (pure; holiday-aware weekly schedule)
// ============================================================================

const MINUTES_PER_WEEK = 7 * 24 * 60;
/** How far the holiday walks look ahead — covers any plausible cluster of consecutive closures. */
const LOOKAHEAD_DAYS = 21;
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
  return computeScheduledStatus(tradingHours, current);
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
 */
const derivedCache = new WeakMap<TradingHours, { events: WeeklyEvent[]; holidays: Set<number> }>();

function derive(tradingHours: TradingHours): { events: WeeklyEvent[]; holidays: Set<number> } {
  let derived = derivedCache.get(tradingHours);
  if (!derived) {
    derived = {
      events: buildWeeklyEvents(tradingHours.sessions),
      holidays: buildHolidaySet(tradingHours.holidays),
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

/** Parse "HH:MM" to { hour, minute } */
function parseHHMM(s: string): { hour: number; minute: number } {
  const parts = s.split(":").map(Number);
  return { hour: parts[0] ?? 0, minute: parts[1] ?? 0 };
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
function nextLocalMinuteOfWeek(
  now: Date,
  timezone: string,
  targetMow: number,
  occurrence = 0,
  from?: LocalParts,
): { ms: number; at: LocalParts } {
  const local = from ?? toLocalParts(now, timezone);
  let delta = targetMow - minuteOfWeek(local.dayOfWeek, local.hour, local.minute);
  if (delta <= 0) delta += MINUTES_PER_WEEK;

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
  for (let daysAhead = 1; daysAhead <= LOOKAHEAD_DAYS; daysAhead++) {
    probe.setUTCDate(probe.getUTCDate() + 1);
    const candidate = { month: probe.getUTCMonth() + 1, day: probe.getUTCDate() };
    if (isHoliday(holidaySet, candidate) === wantHoliday) {
      return msUntilLocalMidnight(now, timezone, daysAhead, from);
    }
  }
  return null;
}

/**
 * Build sorted weekly open/close events from sessions.
 * Handles cross-day sessions (close < open means next day).
 * Handles forex continuous (open === close means 24h session that merges with adjacent).
 */
function buildWeeklyEvents(sessions: TradingHours["sessions"]): WeeklyEvent[] {
  const events: WeeklyEvent[] = [];

  for (const session of sessions) {
    const openTime = parseHHMM(session.open);
    const closeTime = parseHHMM(session.close);
    const openMinutes = openTime.hour * 60 + openTime.minute;
    const closeMinutes = closeTime.hour * 60 + closeTime.minute;

    const isContinuous = openMinutes === closeMinutes; // forex: open === close

    for (const day of session.days) {
      const openMow = minuteOfWeek(day, openTime.hour, openTime.minute);
      events.push({ minuteOfWeek: openMow, type: "open" });

      if (isContinuous || closeMinutes <= openMinutes) {
        // 24h session, or cross-day: close is at that time the NEXT day.
        const closeDay = (day + 1) % 7;
        const closeMow = minuteOfWeek(closeDay, closeTime.hour, closeTime.minute);
        events.push({ minuteOfWeek: closeMow, type: "close" });
      } else {
        // Same-day session
        const closeMow = minuteOfWeek(day, closeTime.hour, closeTime.minute);
        events.push({ minuteOfWeek: closeMow, type: "close" });
      }
    }
  }

  // Sort by minute-of-week; ties: close before open (so a close+open at same
  // time means the old session ends and new one begins — but for forex continuous
  // we want them to cancel out / merge).
  events.sort((a, b) => {
    if (a.minuteOfWeek !== b.minuteOfWeek) return a.minuteOfWeek - b.minuteOfWeek;
    // close before open at the same time
    return a.type === "close" ? -1 : 1;
  });

  // Merge: remove close+open pairs at the same minute-of-week (forex continuous)
  return mergeAdjacentEvents(events);
}

/**
 * Remove close/open pairs that occur at the same minuteOfWeek.
 * This handles forex-style continuous sessions where adjacent sessions
 * close and open at the same time, effectively merging them.
 */
function mergeAdjacentEvents(events: WeeklyEvent[]): WeeklyEvent[] {
  const result: WeeklyEvent[] = [];
  let i = 0;
  while (i < events.length) {
    const curr = events[i];
    const next = events[i + 1];
    if (
      curr !== undefined &&
      next !== undefined &&
      curr.minuteOfWeek === next.minuteOfWeek &&
      curr.type === "close" &&
      next.type === "open"
    ) {
      // Close+open at same time → cancel out (merge)
      i += 2;
    } else {
      if (curr !== undefined) result.push(curr);
      i++;
    }
  }
  return result;
}

function computeScheduledStatus(tradingHours: TradingHours, now: Date): MarketStatusResult {
  const { events, holidays: holidaySet } = derive(tradingHours);

  // An EMPTY event list has two opposite meanings, and collapsing them to
  // "open" reported a permanently-closed venue as tradable:
  //   - no sessions at all  ⇒ the venue never opens;
  //   - sessions that fully cancel in `mergeAdjacentEvents` (a 24/7 schedule)
  //     ⇒ the venue never closes — but its HOLIDAYS still mask it, which the
  //     old early return skipped by leaving before the holiday check.
  // The no-sessions arm reads no clock at all, so `local` is derived below it.
  if (events.length === 0 && tradingHours.sessions.length === 0) {
    return { status: "closed", nextStatusChangeIn: null };
  }

  const local = toLocalParts(now, tradingHours.timezone);

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
    return {
      status: "closed",
      nextStatusChangeIn: findNextNonHolidayOpen(
        events,
        holidaySet,
        now,
        tradingHours.timezone,
        local,
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

  // The "previous" event tells us current status
  const prevIdx = (nextIdx - 1 + events.length) % events.length;
  const prevEvent = events[prevIdx];

  // Check if nowMow is exactly on an event boundary
  const exactEvent = events.find((e) => e.minuteOfWeek === nowMow);
  let currentStatus: "open" | "closed";

  if (exactEvent) {
    // At exact boundary:
    // - If it's an open event → we're open, next event is the close after this
    // - If it's a close event → we're closed, next event is the open after this
    currentStatus = exactEvent.type === "open" ? "open" : "closed";
  } else {
    // Between events: previous event tells us state
    // After an open → we're open; after a close → we're closed
    currentStatus = prevEvent?.type === "open" ? "open" : "closed";
  }

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

  // Holidays only mask `open` events; today-is-a-holiday already returned
  // above. If the upcoming open lands on a holiday, walk forward.
  if (nextChangeEvent.type === "open" && holidaySet.size > 0 && isHoliday(holidaySet, next.at)) {
    const skipped = findNextNonHolidayOpen(events, holidaySet, now, tradingHours.timezone, local);
    if (skipped !== null) nextStatusChangeIn = skipped;
  }

  return { status: currentStatus, nextStatusChangeIn };
}

function holidayKey(month: number, day: number): number {
  return month * 100 + day;
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

  // Each open resolved to a real instant ONCE, then walked in chronological
  // order. Later weeks re-resolve through `occurrence` rather than adding a
  // fixed week of milliseconds — a calendar week spanning a DST change is not
  // 604_800_000 ms, and the resulting instant is fed straight back into the
  // holiday test, where an hour's drift can land on the wrong local date.
  for (let week = 0; week < LOOKAHEAD_WEEKS; week++) {
    const candidates = opens
      .map((ev) => nextLocalMinuteOfWeek(now, timezone, ev.minuteOfWeek, week, local))
      .sort((a, b) => a.ms - b.ms);
    for (const candidate of candidates) {
      if (!isHoliday(holidaySet, candidate.at)) return candidate.ms;
    }
  }
  return null;
}
