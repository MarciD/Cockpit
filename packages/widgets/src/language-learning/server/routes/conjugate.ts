import { json, type WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";
import { LlmNotConfiguredError } from "../infrastructure/anthropic-client";

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    language?: unknown;
    native?: unknown;
    verb?: unknown;
    focusNote?: unknown;
  } | null;

  if (
    !body ||
    typeof body.language !== "string" ||
    typeof body.native !== "string" ||
    typeof body.verb !== "string"
  ) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const { content } = languageLearningServices();
  try {
    const table = await content.conjugate({
      language: body.language,
      native: body.native,
      verb: body.verb.trim(),
      focusNote:
        typeof body.focusNote === "string" ? body.focusNote : undefined,
    });
    return json(table);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return json({ error: "needs-connect" }, { status: 400 });
    }
    return json({ error: (err as Error).message }, { status: 502 });
  }
}
