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

  if (!isLikelyTimezone(timezone)) {
    throw new PythScheduleParseError(`invalid timezone: ${timezone}`);
  }

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

function isLikelyTimezone(s: string): boolean {
  // Surface-level shape check; `Intl.DateTimeFormat` rejects genuinely
  // invalid IANA names at use-time inside `getMarketStatus`.
  return /^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+){0,2}$/.test(s);
}

function parseWeeklySlots(input: string): RawWindow[][] {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const slots: RawWindow[][] = [];
  let i = 0;
  // Pyth uses `,` both between weekdays AND (in the old encoding) between
  // sessions on the same weekday, so we walk tokens and greedily merge
  // adjacent HHMM-HHMM ranges until pulling more would leave too few tokens
  // for the remaining weekday slots.
  while (i < tokens.length) {
    const sessions: RawWindow[] = [];
    const token = tokens[i];
    if (token === undefined) break;
    if (token === "Open" || token === "O" || token === "open") {
      sessions.push({ open: 0, close: 1440 });
      i += 1;
    } else if (token === "Closed" || token === "C" || token === "closed") {
      i += 1;
    } else if (token.includes("&")) {
      // New format: '&' separates multiple sessions within one day.
      for (const part of token.split("&")) {
        sessions.push(parseRange(part.trim()));
      }
      i += 1;
    } else {
      sessions.push(parseRange(token));
      i += 1;
      const slotsRemaining = 7 - (slots.length + 1);
      while (i < tokens.length && tokens.length - i > slotsRemaining) {
        const tok = tokens[i];
        if (tok === undefined) break;
        const next = tryParseRange(tok);
        if (next === null) break;
        sessions.push(next);
        i += 1;
      }
    }
    slots.push(sessions);
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

function tryParseRange(input: string): RawWindow | null {
  const parts = input.split("-");
  const p0 = parts[0];
  const p1 = parts[1];
  if (parts.length !== 2 || p0 === undefined || p1 === undefined) return null;
  if (!/^\d{4}$/.test(p0) || !/^\d{4}$/.test(p1)) return null;
  try {
    return parseRange(input);
  } catch {
    return null;
  }
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
}

// `Intl.DateTimeFormat` construction is heavy; cache one formatter per
// timezone so per-request hot paths (a markets list endpoint) don't
// re-allocate it.
const fmtCache = new Map<string, Intl.DateTimeFormat>();
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

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { dayOfWeek: dayMap[weekdayStr] ?? 0, hour, minute, month, day };
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
  const events = buildWeeklyEvents(tradingHours.sessions);
  if (events.length === 0) {
    // No events → always open (shouldn't happen in practice)
    return { status: "open", nextStatusChangeIn: null };
  }

  const local = toLocalParts(now, tradingHours.timezone);
  const holidaySet = buildHolidaySet(tradingHours.holidays);

  if (isHoliday(holidaySet, local)) {
    return {
      status: "closed",
      nextStatusChangeIn: findNextNonHolidayOpen(events, holidaySet, now, tradingHours.timezone),
    };
  }

  const nowMow = minuteOfWeek(local.dayOfWeek, local.hour, local.minute);

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

  // Find the next event that represents a STATUS CHANGE
  // (i.e., if we're open, find next 'close'; if closed, find next 'open')
  const targetType = currentStatus === "open" ? "close" : "open";

  // Scan forward from the next event position
  let nextChangeEvent: WeeklyEvent | undefined;

  for (let i = 0; i < events.length; i++) {
    const idx = (nextIdx + i) % events.length;
    const candidate = events[idx];
    if (candidate === undefined) continue;

    // For exact boundary cases, skip the event we're sitting on
    if (candidate.minuteOfWeek === nowMow && candidate.type !== targetType) {
      continue;
    }

    if (candidate.type === targetType) {
      nextChangeEvent = candidate;
      break;
    }
  }

  if (nextChangeEvent === undefined) {
    // Should not happen with valid schedules
    return { status: currentStatus, nextStatusChangeIn: null };
  }

  // Calculate ms until next change event
  let deltaMow = nextChangeEvent.minuteOfWeek - nowMow;
  if (deltaMow <= 0) {
    // Wraps around to next week
    deltaMow += MINUTES_PER_WEEK;
  }
  let nextStatusChangeIn = deltaMow * MS_PER_MINUTE;

  // Holidays only mask `open` events; today-is-a-holiday already returned
  // above. If the upcoming open lands on a holiday, walk forward.
  if (nextChangeEvent.type === "open" && holidaySet.size > 0) {
    const targetLocal = toLocalParts(
      new Date(now.getTime() + nextStatusChangeIn),
      tradingHours.timezone,
    );
    if (isHoliday(holidaySet, targetLocal)) {
      const skipped = findNextNonHolidayOpen(events, holidaySet, now, tradingHours.timezone);
      if (skipped !== null) nextStatusChangeIn = skipped;
    }
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
): number | null {
  const local = toLocalParts(now, timezone);
  const startMow = minuteOfWeek(local.dayOfWeek, local.hour, local.minute);
  const opens = events.filter((e) => e.type === "open");
  if (opens.length === 0) return null;

  // Sort opens by their distance forward from `startMow` so a single
  // outer-week / inner-open walk yields candidates in chronological order
  // without an extra array allocation + sort.
  const opensByDelta = opens
    .map((ev) => {
      let delta = ev.minuteOfWeek - startMow;
      if (delta <= 0) delta += MINUTES_PER_WEEK;
      return delta;
    })
    .sort((a, b) => a - b);

  for (let weekOffset = 0; weekOffset < 3; weekOffset++) {
    for (const baseDelta of opensByDelta) {
      const delta = baseDelta + weekOffset * MINUTES_PER_WEEK;
      const targetLocal = toLocalParts(new Date(now.getTime() + delta * MS_PER_MINUTE), timezone);
      if (!isHoliday(holidaySet, targetLocal)) return delta * MS_PER_MINUTE;
    }
  }
  return null;
}
