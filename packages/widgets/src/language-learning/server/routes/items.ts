import { json, type WidgetRouteContext } from "../../../server/contract";
import { isCategory } from "../domain/category";
import { languageLearningServices } from "../composition";

export async function handleGet(req: Request, ctx: WidgetRouteContext) {
  const profileId = ctx.url.searchParams.get("profileId");
  const language = ctx.url.searchParams.get("language");
  if (!profileId || !language) {
    return json({ error: "profileId and language required" }, { status: 400 });
  }
  const { vocab } = languageLearningServices();
  return json({ items: await vocab.all(profileId, language) });
}

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    category?: unknown;
    term?: unknown;
    translation?: unknown;
    notes?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.category !== "string" ||
    typeof body.term !== "string" ||
    typeof body.translation !== "string" ||
    !isCategory(body.category)
  ) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const { vocab } = languageLearningServices();
  const imported = await vocab.insertMany(
    body.profileId,
    body.language,
    [
      {
        category: body.category,
        term: body.term.trim(),
        translation: body.translation.trim(),
        notes:
          typeof body.notes === "string" ? body.notes.trim() || null : null,
      },
    ],
    "manual",
  );
  return json({ imported });
}
