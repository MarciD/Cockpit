import { NextResponse } from "next/server";
import { languageLearningServices } from "@/lib/language-learning/composition";
import { LlmNotConfiguredError } from "@/lib/language-learning/infrastructure/anthropic-client";

export const runtime = "nodejs";

const MAX_COUNT = 20;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    topic?: unknown;
    mode?: unknown;
    focusNote?: unknown;
    count?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.native !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const count = Math.min(
    MAX_COUNT,
    Math.max(1, typeof body.count === "number" ? Math.floor(body.count) : 8),
  );

  const { content } = languageLearningServices();
  try {
    const result = await content.generate({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      topic: typeof body.topic === "string" ? body.topic : "",
      mode: typeof body.mode === "string" ? body.mode : "general",
      focusNote:
        typeof body.focusNote === "string" ? body.focusNote : undefined,
      count,
    });
    return NextResponse.json(result);
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
