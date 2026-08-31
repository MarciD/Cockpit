import { NextResponse } from "next/server";
import {
  PRACTICE_MODES,
  type PracticeMode,
} from "@/lib/language-learning/domain/exercise";
import { languageLearningServices } from "@/lib/language-learning/composition";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    itemId?: unknown;
    correct?: unknown;
    mode?: unknown;
    today?: unknown;
    dailyGoalItems?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.itemId !== "string" ||
    typeof body.correct !== "boolean"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const mode: PracticeMode =
    typeof body.mode === "string" &&
    (PRACTICE_MODES as readonly string[]).includes(body.mode)
      ? (body.mode as PracticeMode)
      : "general";
  const today =
    typeof body.today === "string" && DATE_RE.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);
  const dailyGoalItems =
    typeof body.dailyGoalItems === "number" && body.dailyGoalItems > 0
      ? Math.floor(body.dailyGoalItems)
      : undefined;

  const { practice } = languageLearningServices();
  const summary = await practice.submitAnswer({
    profileId: body.profileId,
    language: body.language,
    itemId: body.itemId,
    correct: body.correct,
    mode,
    today,
    dailyGoalItems,
  });
  return NextResponse.json(summary);
}
