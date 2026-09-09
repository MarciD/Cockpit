import { NextResponse } from "next/server";
import { notificationServices } from "@/lib/notifications/composition";
import { toNotificationDto, type InboxDto } from "@/lib/notifications/dto";

export const runtime = "nodejs";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/** The inbox: newest first, dismissed rows excluded. `?since=` narrows, `?unread=1` filters. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  const sinceParam = params.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    return NextResponse.json(
      { error: "since must be a date" },
      { status: 400 },
    );
  }
  const limitParam = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(1, Math.floor(limitParam)), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const { inbox } = notificationServices();
  const payload: InboxDto = {
    notifications: inbox
      .list({ since, unreadOnly: params.get("unread") === "1", limit })
      .map(toNotificationDto),
    unread: inbox.unreadCount(),
    serverTime: new Date().toISOString(),
  };
  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
  });
}
