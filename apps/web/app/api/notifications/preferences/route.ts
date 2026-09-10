import { NextResponse } from "next/server";
import { InvalidPreferencesError } from "@/lib/notifications/application/preferences-service";
import { notificationServices } from "@/lib/notifications/composition";
import { widgetServerModules } from "@/lib/widget-server";

export const runtime = "nodejs";

/** Routing matrix, quiet hours, public URL, and each channel's state. */
export async function GET() {
  // Building the widget modules is what registers their notification kinds,
  // so the matrix lists them even if no widget route has been hit yet.
  widgetServerModules();
  const view = await notificationServices().preferences.get();
  return NextResponse.json(view, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    byKind?: unknown;
    quiet?: unknown;
    publicUrl?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  try {
    notificationServices().preferences.update(body);
  } catch (err) {
    if (err instanceof InvalidPreferencesError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
