import { NextResponse } from "next/server";
import { createProfile, getProfile, listProfiles } from "@cockpit/db";
import { ACCENT_TOKENS } from "@/lib/accent";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/** Path segments the desk slug must not shadow (they are real app routes). */
const RESERVED = new Set(["api", "learn", "login", "_next", "favicon.ico"]);

const KINDS = new Set(["company", "personal"]);

/** URL-safe desk id derived from the name; deduped against existing desks. */
function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip NFKD combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "desk";
}

export async function GET() {
  return NextResponse.json({ profiles: listProfiles(getDb()) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    kind?: unknown;
    accent?: unknown;
    monogram?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const kind =
    typeof body?.kind === "string" && KINDS.has(body.kind)
      ? body.kind
      : "personal";

  const accent =
    typeof body?.accent === "string" && ACCENT_TOKENS.includes(body.accent)
      ? body.accent
      : null;

  const monogram =
    typeof body?.monogram === "string" && body.monogram.trim()
      ? body.monogram.trim().slice(0, 2).toUpperCase()
      : null;

  const db = getDb();
  const slug = slugify(name);
  let id = slug;
  for (let n = 2; RESERVED.has(id) || getProfile(db, id); n += 1) {
    id = `${slug}-${n}`;
  }

  createProfile(db, { id, name, kind, accent, monogram });
  return NextResponse.json({ id }, { status: 201 });
}
