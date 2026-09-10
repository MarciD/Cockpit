import { json, type WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function handleGet(req: Request, ctx: WidgetRouteContext) {
  const profileId = ctx.url.searchParams.get("profileId");
  const language = ctx.url.searchParams.get("language");
  if (!profileId || !language) {
    return json({ error: "profileId and language required" }, { status: 400 });
  }
  const todayParam = ctx.url.searchParams.get("today");
  const today =
    todayParam && DATE_RE.test(todayParam)
      ? todayParam
      : new Date().toISOString().slice(0, 10);
  const goalParam = Number(ctx.url.searchParams.get("goal"));
  const goalOverride = goalParam > 0 ? Math.floor(goalParam) : undefined;

  const { scores } = languageLearningServices();
  const summary = await scores.summary(
    profileId,
    language,
    today,
    goalOverride,
  );
  return json(summary);
}
