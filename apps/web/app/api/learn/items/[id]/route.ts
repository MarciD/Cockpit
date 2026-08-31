import { NextResponse } from "next/server";
import { isCategory } from "@/lib/language-learning/domain/category";
import { languageLearningServices } from "@/lib/language-learning/composition";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    category?: unknown;
    term?: unknown;
    translation?: unknown;
    notes?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const patch: {
    category?:
      | "noun"
      | "verb_infinitive"
      | "grammar"
      | "common_word"
      | "phrase"
      | "time_word"
      | "time_phrase";
    term?: string;
    translation?: string;
    notes?: string | null;
  } = {};
  if (typeof body.category === "string" && isCategory(body.category)) {
    patch.category = body.category;
  }
  if (typeof body.term === "string") patch.term = body.term.trim();
  if (typeof body.translation === "string") {
    patch.translation = body.translation.trim();
  }
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;

  const { vocab } = languageLearningServices();
  await vocab.update(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { vocab } = languageLearningServices();
  await vocab.remove(id);
  return NextResponse.json({ ok: true });
}
