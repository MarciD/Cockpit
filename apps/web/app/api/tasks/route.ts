import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createRecurringTask, listRecurringTasks } from "@cockpit/db";
import { getDb } from "@/lib/db";
import { reloadRecurringTasks } from "@/lib/scheduler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const profileId = new URL(req.url).searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }
  return NextResponse.json({ tasks: listRecurringTasks(getDb(), profileId) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    title?: unknown;
    cron?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.title !== "string" ||
    typeof body.cron !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const id = randomUUID();
  createRecurringTask(getDb(), {
    id,
    profileId: body.profileId,
    title: body.title,
    cron: body.cron,
  });
  reloadRecurringTasks();
  return NextResponse.json({ id });
}
