import { NextResponse } from "next/server";
import { languageLearningServices } from "@/lib/language-learning/composition";
import { LlmNotConfiguredError } from "@/lib/language-learning/infrastructure/anthropic-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    language?: unknown;
    native?: unknown;
    verb?: unknown;
    focusNote?: unknown;
  } | null;

  if (
    !body ||
    typeof body.language !== "string" ||
    typeof body.native !== "string" ||
    typeof body.verb !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { content } = languageLearningServices();
  try {
    const table = await content.conjugate({
      language: body.language,
      native: body.native,
      verb: body.verb.trim(),
      focusNote:
        typeof body.focusNote === "string" ? body.focusNote : undefined,
    });
    return NextResponse.json(table);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return NextResponse.json({ error: "needs-connect" }, { status: 400 });
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
