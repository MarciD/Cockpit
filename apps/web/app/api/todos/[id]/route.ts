import { NextResponse } from "next/server";
import { deleteTodo, setTodo } from "@cockpit/db";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    done?: unknown;
    title?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  } | null;

  const patch: {
    done?: boolean;
    title?: string;
    startDate?: Date | null;
    endDate?: Date | null;
  } = {};
  if (typeof body?.done === "boolean") patch.done = body.done;
  if (typeof body?.title === "string") patch.title = body.title;
  if (body?.startDate === null) patch.startDate = null;
  else if (typeof body?.startDate === "string")
    patch.startDate = new Date(body.startDate);
  if (body?.endDate === null) patch.endDate = null;
  else if (typeof body?.endDate === "string")
    patch.endDate = new Date(body.endDate);

  setTodo(getDb(), id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteTodo(getDb(), id);
  return NextResponse.json({ ok: true });
}
