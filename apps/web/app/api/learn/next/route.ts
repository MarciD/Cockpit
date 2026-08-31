import { NextResponse } from "next/server";
import {
  PRACTICE_MODES,
  type PracticeMode,
} from "@/lib/language-learning/domain/exercise";
import { languageLearningServices } from "@/lib/language-learning/composition";

export const runtime = "nodejs";

const DEFAULT_COUNT = 6;
const MAX_COUNT = 20;

function parseMode(raw: string | null): PracticeMode {
  return raw && (PRACTICE_MODES as readonly string[]).includes(raw)
    ? (raw as PracticeMode)
    : "general";
}

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
  const mode = parseMode(url.searchParams.get("mode"));
  const count = Math.min(
    MAX_COUNT,
    Math.max(1, Number(url.searchParams.get("count")) || DEFAULT_COUNT),
  );

  const { practice } = languageLearningServices();
  const exercises = await practice.nextBatch(profileId, language, mode, count);
  return NextResponse.json({ exercises });
}
