import { NextResponse } from "next/server";
import { deleteWidgetInstance, updateWidgetInstanceConfig } from "@cockpit/db";
import { getDb } from "@/lib/db";
import { widgetConfigError } from "@/lib/widget-config";

export const runtime = "nodejs";

/** Update a widget instance's config. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    config?: unknown;
  } | null;

  if (!body || !("config" in body)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const invalid = widgetConfigError(body.config);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  updateWidgetInstanceConfig(getDb(), id, body.config);
  return NextResponse.json({ ok: true });
}

/** Remove a widget instance. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteWidgetInstance(getDb(), id);
  return NextResponse.json({ ok: true });
}
