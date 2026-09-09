import { NextResponse } from "next/server";
import { notify } from "@/lib/notifications/composition";

export const runtime = "nodejs";

/** Sends one test notification through the inbox and every enabled channel. */
export async function POST() {
  const row = await notify({
    kind: "system.test",
    severity: "info",
    title: "Test notification",
    body: "If you can read this, the inbox works. Channels report below it.",
  });
  if (!row) {
    return NextResponse.json({ error: "not stored" }, { status: 500 });
  }
  return NextResponse.json({ id: row.id });
}
