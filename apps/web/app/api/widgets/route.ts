import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createWidgetInstance } from "@cockpit/db";
import { getDb } from "@/lib/db";
import { widgetConfigError } from "@/lib/widget-config";

export const runtime = "nodejs";

/** Add a widget instance to a profile. Config is supplied by the client
 *  (the registry — and thus each widget's default config — lives client-side). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    widgetId?: unknown;
    config?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.widgetId !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const config = body.config ?? {};
  const invalid = widgetConfigError(config);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const id = randomUUID();
  createWidgetInstance(getDb(), {
    id,
    profileId: body.profileId,
    widgetId: body.widgetId,
    config,
  });
  return NextResponse.json({ id });
}
