import type {
  CalendarMeta,
  CalendarSource,
  CalendarSourceKind,
} from "@cockpit/integrations";
export type { CalendarMeta, CalendarSource, CalendarSourceKind };

import ical from "node-ical";
import { DateTime } from "luxon";
import { assertPublicHttpUrl } from "@cockpit/integrations";

/** Legacy single-feed config — kept for migration of the old "google" provider. */
export interface GoogleCalendarConfig {
  icalUrl: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string; // ISO (absolute instant)
  end: string; // ISO
  allDay: boolean;
  videoUrl?: string;
  location?: string;
}

export type CalendarView = "day" | "week" | "month";

/** Absolute [from,to] bounds of the view's window, computed in the user's tz. */
export function windowFor(
  view: CalendarView,
  tz: string,
): { fromISO: string; toISO: string } {
  const unit = view === "day" ? "day" : view === "week" ? "week" : "month";
  const now = DateTime.now().setZone(tz);
  const from = now.startOf(unit);
  const to = now.endOf(unit);
  // Fall back to plain now±range if the zone is invalid.
  const fromISO = (from.isValid ? from : DateTime.now().startOf(unit))
    .toUTC()
    .toISO();
  const toISO = (to.isValid ? to : DateTime.now().endOf(unit)).toUTC().toISO();
  return { fromISO: fromISO ?? "", toISO: toISO ?? "" };
}

const VIDEO_RE =
  /https?:\/\/(?:[\w-]+\.)*(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com)\/[^\s"'<>)\]]+/i;

/** Pull a join link from the usual VEVENT fields (url/location/description/X-GOOGLE-CONFERENCE). */
function extractVideoUrl(ev: Record<string, unknown>): string | undefined {
  for (const key of ["X-GOOGLE-CONFERENCE", "url", "location", "description"]) {
    const c = ev[key];
    if (typeof c === "string") {
      const m = c.match(VIDEO_RE);
      if (m) return m[0];
    }
  }
  return undefined;
}

/**
 * Re-anchor a floating rrule occurrence to a true instant. `rrule.between`
 * returns occurrences whose UTC fields hold the event's *wall-clock* time; we
 * rebuild that wall time in the event's own zone to get the correct instant.
 * (This is the fix for recurring events showing the wrong time.)
 */
function anchorOccurrence(
  occ: Date,
  tz: string | undefined,
  allDay: boolean,
): Date {
  if (allDay || !tz) return occ;
  const dt = DateTime.fromObject(
    {
      year: occ.getUTCFullYear(),
      month: occ.getUTCMonth() + 1,
      day: occ.getUTCDate(),
      hour: occ.getUTCHours(),
      minute: occ.getUTCMinutes(),
      second: occ.getUTCSeconds(),
    },
    { zone: tz },
  );
  return dt.isValid ? dt.toJSDate() : occ;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse one calendar feed and return its events within [fromISO, toISO],
 * tagged with `calendarId`. Recurring events (RRULE) are expanded with EXDATE
 * exclusions + RECURRENCE-ID overrides, and re-anchored to the correct tz.
 */
export function parseCalendarEvents(
  icsText: string,
  calendarId: string,
  fromISO: string,
  toISO: string,
): CalendarEvent[] {
  if (!icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error(
      "That URL returned a web page, not an iCal feed — use the calendar's " +
        "“Secret address in iCal format” (ends in .ics).",
    );
  }
  const data = ical.sync.parseICS(icsText);
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const out: CalendarEvent[] = [];

  const add = (
    id: string,
    title: string,
    start: Date,
    end: Date,
    allDay: boolean,
    videoUrl?: string,
    location?: string,
  ) => {
    if (end.getTime() < from.getTime() || start.getTime() > to.getTime())
      return;
    out.push({
      id,
      calendarId,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      videoUrl,
      location,
    });
  };

  for (const key of Object.keys(data)) {
    const ev = data[key];
    if (!ev || ev.type !== "VEVENT") continue;

    const title = String(ev.summary ?? "(no title)");
    const allDay = ev.datetype === "date";
    const start = ev.start;
    const end = ev.end ?? ev.start;
    if (!start) continue;
    const durationMs = Math.max(0, end.getTime() - start.getTime());
    const tz = (start as { tz?: string }).tz;
    const videoUrl = extractVideoUrl(ev as unknown as Record<string, unknown>);
    const location =
      typeof ev.location === "string" && ev.location ? ev.location : undefined;

    if (ev.rrule) {
      // Over-select (pad for tz offset + duration), then filter precisely by
      // the anchored absolute time in `add`.
      const lo = new Date(from.getTime() - durationMs - 2 * DAY_MS);
      const hi = new Date(to.getTime() + 2 * DAY_MS);
      for (const occ of ev.rrule.between(lo, hi, true)) {
        const dayKey = occ.toISOString().slice(0, 10);
        if (ev.exdate?.[dayKey]) continue;
        const override = ev.recurrences?.[dayKey];
        if (override) {
          const oStart = override.start ?? occ;
          add(
            `${calendarId}-${key}-${dayKey}`,
            String(override.summary ?? title),
            oStart,
            override.end ?? new Date(oStart.getTime() + durationMs),
            override.datetype === "date",
            extractVideoUrl(override as unknown as Record<string, unknown>) ??
              videoUrl,
            location,
          );
        } else {
          const realStart = anchorOccurrence(occ, tz, allDay);
          add(
            `${calendarId}-${key}-${dayKey}`,
            title,
            realStart,
            new Date(realStart.getTime() + durationMs),
            allDay,
            videoUrl,
            location,
          );
        }
      }
    } else {
      add(
        `${calendarId}-${key}`,
        title,
        start,
        end,
        allDay,
        videoUrl,
        location,
      );
    }
  }

  return out;
}

/** Fetch a calendar feed's raw iCal text. */
export async function fetchIcsText(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  // Stored per calendar, and re-fetched by the scheduler every five minutes.
  const safe = assertPublicHttpUrl(url, "The calendar URL");
  const res = await fetch(safe, { signal });
  if (!res.ok) throw new Error(`Calendar request failed (HTTP ${res.status})`);
  return res.text();
}
