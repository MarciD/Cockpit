import { NextResponse } from "next/server";
import { listProfiles } from "@cockpit/db";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Liveness probe for Docker. Reachable without the access token, so it reports
 * nothing sensitive — just that the database opened and the registry loaded.
 */
export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      desks: listProfiles(getDb()).length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 503 },
    );
  }
}
