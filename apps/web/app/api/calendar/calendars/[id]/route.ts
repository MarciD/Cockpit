import { NextResponse } from "next/server";
import {
  assertPublicHttpUrl,
  type CalendarSourceKind,
} from "@cockpit/integrations";
import { deleteCalendar, updateCalendar } from "@/lib/credentials";
import { urlErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const SOURCES: CalendarSourceKind[] = ["google", "outlook", "ical"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    label?: unknown;
    color?: unknown;
    source?: unknown;
    url?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const patch: {
    label?: string;
    color?: string;
    source?: CalendarSourceKind;
    url?: string;
  } = {};
  if (typeof body.label === "string") patch.label = body.label;
  if (typeof body.color === "string") patch.color = body.color;
  if (
    typeof body.source === "string" &&
    SOURCES.includes(body.source as CalendarSourceKind)
  ) {
    patch.source = body.source as CalendarSourceKind;
  }
  if (typeof body.url === "string" && body.url.trim()) {
    try {
      assertPublicHttpUrl(body.url.trim(), "The calendar URL");
    } catch (err) {
      return urlErrorResponse(err);
    }
    patch.url = body.url.trim();
  }

  const ok = await updateCalendar(id, patch);
  return NextResponse.json({ ok });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteCalendar(id);
  return NextResponse.json({ ok: true });
}
