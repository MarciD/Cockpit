import { json, type WidgetRouteContext } from "../../../server/contract";
import { PRACTICE_MODES, type PracticeMode } from "../domain/exercise";
import { languageLearningServices } from "../composition";

const DEFAULT_COUNT = 6;
const MAX_COUNT = 20;

function parseMode(raw: string | null): PracticeMode {
  return raw && (PRACTICE_MODES as readonly string[]).includes(raw)
    ? (raw as PracticeMode)
    : "general";
}

export async function handleGet(req: Request, ctx: WidgetRouteContext) {
  const profileId = ctx.url.searchParams.get("profileId");
  const language = ctx.url.searchParams.get("language");
  if (!profileId || !language) {
    return json({ error: "profileId and language required" }, { status: 400 });
  }
  const mode = parseMode(ctx.url.searchParams.get("mode"));
  const count = Math.min(
    MAX_COUNT,
    Math.max(1, Number(ctx.url.searchParams.get("count")) || DEFAULT_COUNT),
  );

  const { practice } = languageLearningServices();
  const exercises = await practice.nextBatch(profileId, language, mode, count);
  return json({ exercises });
}
