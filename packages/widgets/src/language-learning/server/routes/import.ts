import { json, type WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    nativeLanguage?: unknown;
    csv?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.nativeLanguage !== "string" ||
    typeof body.csv !== "string"
  ) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const { importExport } = languageLearningServices();
  const result = await importExport.import({
    profileId: body.profileId,
    language: body.language,
    native: body.nativeLanguage,
    csv: body.csv,
  });
  return json(result);
}
