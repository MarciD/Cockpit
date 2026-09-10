import { json, type WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";
import { LlmNotConfiguredError } from "../infrastructure/anthropic-client";

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    topic?: unknown;
    focusNote?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.native !== "string" ||
    typeof body.topic !== "string" ||
    !body.topic.trim()
  ) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const { sessions } = languageLearningServices();
  try {
    const session = await sessions.startTopic({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      topic: body.topic.trim(),
      focusNote:
        typeof body.focusNote === "string" ? body.focusNote : undefined,
    });
    return json(session);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return json({ error: "needs-connect" }, { status: 400 });
    }
    return json({ error: (err as Error).message }, { status: 502 });
  }
}
