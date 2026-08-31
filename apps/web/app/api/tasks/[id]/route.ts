import { NextResponse } from "next/server";
import { deleteRecurringTask, updateRecurringTask } from "@cockpit/db";
import { getDb } from "@/lib/db";
import { reloadRecurringTasks } from "@/lib/scheduler";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    enabled?: unknown;
    title?: unknown;
    cron?: unknown;
  } | null;

  const patch: { enabled?: boolean; title?: string; cron?: string } = {};
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.title === "string") patch.title = body.title;
  if (typeof body?.cron === "string") patch.cron = body.cron;

  updateRecurringTask(getDb(), id, patch);
  reloadRecurringTasks();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteRecurringTask(getDb(), id);
  reloadRecurringTasks();
  return NextResponse.json({ ok: true });
}
