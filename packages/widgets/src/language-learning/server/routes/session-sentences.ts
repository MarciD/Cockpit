import { json, type WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";
import { LlmNotConfiguredError } from "../infrastructure/anthropic-client";

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    count?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.native !== "string"
  ) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const { sessions } = languageLearningServices();
  try {
    const result = await sessions.startSentences({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      count: typeof body.count === "number" ? body.count : undefined,
    });
    return json(result);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return json({ error: "needs-connect" }, { status: 400 });
    }
    return json({ error: (err as Error).message }, { status: 502 });
  }
}
