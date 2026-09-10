import { json, type WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";
import { LlmNotConfiguredError } from "../infrastructure/anthropic-client";

const MAX_COUNT = 20;

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    topic?: unknown;
    mode?: unknown;
    focusNote?: unknown;
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

  const count = Math.min(
    MAX_COUNT,
    Math.max(1, typeof body.count === "number" ? Math.floor(body.count) : 8),
  );

  const { content } = languageLearningServices();
  try {
    const result = await content.generate({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      topic: typeof body.topic === "string" ? body.topic : "",
      mode: typeof body.mode === "string" ? body.mode : "general",
      focusNote:
        typeof body.focusNote === "string" ? body.focusNote : undefined,
      count,
    });
    return json(result);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return json({ error: "needs-connect" }, { status: 400 });
    }
    return json({ error: (err as Error).message }, { status: 502 });
  }
}
