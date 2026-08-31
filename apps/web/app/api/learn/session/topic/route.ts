import { NextResponse } from "next/server";
import { languageLearningServices } from "@/lib/language-learning/composition";
import { LlmNotConfiguredError } from "@/lib/language-learning/infrastructure/anthropic-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    topic?: unknown;
    focusNote?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.native !== "string" ||
    typeof body.topic !== "string" ||
    !body.topic.trim()
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { sessions } = languageLearningServices();
  try {
    const session = await sessions.startTopic({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      topic: body.topic.trim(),
      focusNote:
        typeof body.focusNote === "string" ? body.focusNote : undefined,
    });
    return NextResponse.json(session);
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
