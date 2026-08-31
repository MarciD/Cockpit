import { NextResponse } from "next/server";
import {
  assertPublicHttpUrl,
  type CalendarSourceKind,
} from "@cockpit/integrations";
import { addCalendar, listCalendars } from "@/lib/credentials";
import { urlErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const SOURCES: CalendarSourceKind[] = ["google", "outlook", "ical"];

/** Metadata only — never expose the secret iCal URLs. */
export async function GET() {
  const list = await listCalendars();
  return NextResponse.json({
    calendars: list.map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
      source: c.source,
    })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    label?: unknown;
    color?: unknown;
    source?: unknown;
    url?: unknown;
  } | null;
  if (
    !body ||
    typeof body.label !== "string" ||
    !body.label.trim() ||
    typeof body.url !== "string" ||
    !body.url.trim() ||
    typeof body.source !== "string" ||
    !SOURCES.includes(body.source as CalendarSourceKind)
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  // The scheduler re-fetches this URL every 5 minutes, browser or not.
  try {
    assertPublicHttpUrl(body.url.trim(), "The calendar URL");
  } catch (err) {
    return urlErrorResponse(err);
  }

  const meta = await addCalendar({
    label: body.label.trim(),
    color: typeof body.color === "string" ? body.color : undefined,
    source: body.source as CalendarSourceKind,
    url: body.url.trim(),
  });
  return NextResponse.json(meta);
}
