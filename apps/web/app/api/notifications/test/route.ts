import { NextResponse } from "next/server";
import { notificationServices } from "@/lib/notifications/composition";

export const runtime = "nodejs";

const MAX_DELAY_MS = 24 * 60 * 60_000;

/**
 * Sends one test notification through the inbox and every routed channel and
 * reports what each channel did. With `{ delayMs }` it schedules the test as a
 * reminder instead, which exercises the drain job end to end.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    delayMs?: unknown;
  } | null;
  const delayMs = typeof body?.delayMs === "number" ? body.delayMs : 0;
  if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > MAX_DELAY_MS) {
    return NextResponse.json(
      { error: "delayMs out of range" },
      { status: 400 },
    );
  }

  const services = notificationServices();
  if (delayMs > 0) {
    const fireAt = new Date(Date.now() + delayMs);
    const reminder = services.reminders.schedule(fireAt, {
      kind: "system.test",
      severity: "info",
      title: "Scheduled test notification",
      body: `Scheduled ${Math.round(delayMs / 1000)} s earlier; the reminder drain delivered it.`,
    });
    return NextResponse.json({
      scheduled: reminder.id,
      fireAt: fireAt.toISOString(),
    });
  }

  const result = await services.notify.notify({
    kind: "system.test",
    severity: "info",
    title: "Test notification",
    body: "If you can read this, the inbox works. Channels report below it.",
  });
  if (!result) {
    return NextResponse.json({ error: "not stored" }, { status: 500 });
  }
  return NextResponse.json({
    id: result.notification.id,
    deliveries: result.deliveries,
  });
}
