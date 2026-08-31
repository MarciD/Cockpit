import { NextResponse } from "next/server";
import { saveLayout } from "@cockpit/db";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/** Persist a profile's grid layout for one responsive breakpoint. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    breakpoint?: unknown;
    layout?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.breakpoint !== "string" ||
    !Array.isArray(body.layout)
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  saveLayout(getDb(), body.profileId, body.breakpoint, body.layout);
  return NextResponse.json({ ok: true });
}
