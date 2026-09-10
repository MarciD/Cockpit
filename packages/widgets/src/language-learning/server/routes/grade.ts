import { json, type WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";
import { LlmNotConfiguredError } from "../infrastructure/anthropic-client";

export async function handlePost(req: Request, ctx: WidgetRouteContext) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: unknown;
    language?: unknown;
    native?: unknown;
    prompt?: unknown;
    answer?: unknown;
  } | null;

  if (
    !body ||
    typeof body.profileId !== "string" ||
    typeof body.language !== "string" ||
    typeof body.native !== "string" ||
    typeof body.prompt !== "string" ||
    typeof body.answer !== "string"
  ) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const { grading } = languageLearningServices();
  try {
    const grade = await grading.grade({
      profileId: body.profileId,
      language: body.language,
      native: body.native,
      prompt: body.prompt,
      answer: body.answer,
    });
    return json(grade);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return json({ error: "needs-connect" }, { status: 400 });
    }
    return json({ error: (err as Error).message }, { status: 502 });
  }
}
