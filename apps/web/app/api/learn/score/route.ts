import { NextResponse } from "next/server";
import { languageLearningServices } from "@/lib/language-learning/composition";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const todayParam = url.searchParams.get("today");
  const today =
    todayParam && DATE_RE.test(todayParam)
      ? todayParam
      : new Date().toISOString().slice(0, 10);
  const goalParam = Number(url.searchParams.get("goal"));
  const goalOverride = goalParam > 0 ? Math.floor(goalParam) : undefined;

  const { scores } = languageLearningServices();
  const summary = await scores.summary(
    profileId,
    language,
    today,
    goalOverride,
  );
  return NextResponse.json(summary);
}
