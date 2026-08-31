import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Exchange the shared token for a session cookie. */
export async function POST(req: Request) {
  const expected = process.env.COCKPIT_ACCESS_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ error: "no gate configured" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  const given = typeof body?.token === "string" ? body.token.trim() : "";
  if (!given || sha256(given) !== sha256(expected)) {
    return NextResponse.json({ error: "wrong token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: sha256(expected),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
    // Only over HTTPS when we're actually on HTTPS — cockpit is usually plain
    // http on a LAN, and a Secure cookie would never be sent back.
    secure: new URL(req.url).protocol === "https:",
  });
  return res;
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
