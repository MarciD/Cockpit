import { NextResponse } from "next/server";
import { languageLearningServices } from "@/lib/language-learning/composition";
import { LlmNotConfiguredError } from "@/lib/language-learning/infrastructure/anthropic-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    prompt?: unknown;
    answer?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.native !== "string" ||
    typeof body.prompt !== "string" ||
    typeof body.answer !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { grading } = languageLearningServices();
  try {
    const grade = await grading.grade({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      prompt: body.prompt,
      answer: body.answer,
    });
    return NextResponse.json(grade);
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
