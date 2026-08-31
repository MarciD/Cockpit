import { NextResponse } from "next/server";
import { languageLearningServices } from "@/lib/language-learning/composition";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    nativeLanguage?: unknown;
    csv?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.nativeLanguage !== "string" ||
    typeof body.csv !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { importExport } = languageLearningServices();
  const result = await importExport.import({
    profileId: body.profileId,
    language: body.language,
    native: body.nativeLanguage,
    csv: body.csv,
  });
  return NextResponse.json(result);
}
