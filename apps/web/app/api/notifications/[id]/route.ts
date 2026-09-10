import { NextResponse } from "next/server";
import { notificationServices } from "@/lib/notifications/composition";

export const runtime = "nodejs";

/** Mark one notification read / unread, or dismiss it. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    read?: unknown;
    dismissed?: unknown;
  } | null;

  const read = typeof body?.read === "boolean" ? body.read : undefined;
  const dismissed = body?.dismissed === true;
  if (read === undefined && !dismissed) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { inbox } = notificationServices();
  if (read !== undefined) inbox.setRead(id, read);
  if (dismissed) inbox.dismiss(id);
  return NextResponse.json({ ok: true });
}
