import { NextResponse } from "next/server";
import { deleteProfile, getProfile, updateProfile } from "@cockpit/db";
import { ACCENT_TOKENS } from "@/lib/accent";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const KINDS = new Set(["company", "personal"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  if (!getProfile(db, id)) {
    return NextResponse.json({ error: "no such desk" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    kind?: unknown;
    accent?: unknown;
    monogram?: unknown;
    order?: unknown;
  } | null;

  const patch: {
    name?: string;
    kind?: string;
    accent?: string | null;
    monogram?: string | null;
    order?: number;
  } = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 60);
  }
  if (typeof body?.kind === "string" && KINDS.has(body.kind)) {
    patch.kind = body.kind;
  }
  if (body?.accent === null) patch.accent = null;
  else if (
    typeof body?.accent === "string" &&
    ACCENT_TOKENS.includes(body.accent)
  )
    patch.accent = body.accent;
  // An empty monogram clears the override and falls back to the name.
  if (body?.monogram === null || body?.monogram === "") patch.monogram = null;
  else if (typeof body?.monogram === "string")
    patch.monogram = body.monogram.trim().slice(0, 2).toUpperCase() || null;
  if (typeof body?.order === "number" && Number.isFinite(body.order)) {
    patch.order = Math.trunc(body.order);
  }

  updateProfile(db, id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteProfile(getDb(), id);
  return NextResponse.json({ ok: true });
}
