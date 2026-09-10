import { json, type WidgetRouteContext } from "../../../server/contract";
import { ItemNotFoundError } from "../application/hint-service";
import { languageLearningServices } from "../composition";
import { LlmNotConfiguredError } from "../infrastructure/anthropic-client";

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    itemId?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.native !== "string" ||
    typeof body.itemId !== "string"
  ) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const { hints } = languageLearningServices();
  try {
    const hint = await hints.hint({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      itemId: body.itemId,
    });
    return json(hint);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return json({ error: "needs-connect" }, { status: 400 });
    }
    if (err instanceof ItemNotFoundError) {
      return json({ error: "not-found" }, { status: 404 });
    }
    return json({ error: (err as Error).message }, { status: 502 });
  }
}
