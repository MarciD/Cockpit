import { NextResponse } from "next/server";
import type { CalendarView } from "@cockpit/integrations";
import { getCalendarEvents } from "@/lib/integration-cache";

export const runtime = "nodejs";

const VIEWS: CalendarView[] = ["day", "week", "month"];

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const viewParam = sp.get("view");
  const view: CalendarView = VIEWS.includes(viewParam as CalendarView)
    ? (viewParam as CalendarView)
    : "day";
  const tz = sp.get("tz") || "UTC";
  const force = sp.get("refresh") === "1";
  return NextResponse.json(await getCalendarEvents(view, tz, force));
}
