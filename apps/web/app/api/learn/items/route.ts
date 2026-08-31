import { NextResponse } from "next/server";
import { isCategory } from "@/lib/language-learning/domain/category";
import { languageLearningServices } from "@/lib/language-learning/composition";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profileId");
  const language = url.searchParams.get("language");
  if (!profileId || !language) {
    return NextResponse.json(
      { error: "profileId and language required" },
      { status: 400 },
    );
  }
  const { vocab } = languageLearningServices();
  return NextResponse.json({ items: await vocab.all(profileId, language) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    category?: unknown;
    term?: unknown;
    translation?: unknown;
    notes?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.category !== "string" ||
    typeof body.term !== "string" ||
    typeof body.translation !== "string" ||
    !isCategory(body.category)
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { vocab } = languageLearningServices();
  const imported = await vocab.insertMany(
    body.profileId,
    body.language,
    [
      {
        category: body.category,
        term: body.term.trim(),
        translation: body.translation.trim(),
        notes:
          typeof body.notes === "string" ? body.notes.trim() || null : null,
      },
    ],
    "manual",
  );
  return NextResponse.json({ imported });
}
