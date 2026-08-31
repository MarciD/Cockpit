import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createTodo, listTodos } from "@cockpit/db";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const profileId = new URL(req.url).searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }
  return NextResponse.json({ todos: listTodos(getDb(), profileId) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    title?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.title !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const id = randomUUID();
  createTodo(getDb(), { id, profileId: body.profileId, title: body.title });
  return NextResponse.json({ id });
}
