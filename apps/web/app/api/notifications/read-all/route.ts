import { NextResponse } from "next/server";
import { notificationServices } from "@/lib/notifications/composition";

export const runtime = "nodejs";

export async function POST() {
  const count = notificationServices().inbox.markAllRead();
  return NextResponse.json({ ok: true, count });
}
