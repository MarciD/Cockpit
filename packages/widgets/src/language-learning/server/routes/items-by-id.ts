import {
  badRequest,
  json,
  type WidgetRouteContext,
} from "../../../server/contract";
import { isCategory } from "../domain/category";
import { languageLearningServices } from "../composition";

export async function handlePatch(req: Request, ctx: WidgetRouteContext) {
  const [id] = ctx.path;
  if (!id) return badRequest("id is required");
  const body = (await req.json().catch(() => null)) as {
    category?: unknown;
    term?: unknown;
    translation?: unknown;
    notes?: unknown;
  } | null;
  if (!body) {
    return json({ error: "invalid payload" }, { status: 400 });
  }

  const patch: {
    category?:
      | "noun"
      | "verb_infinitive"
      | "grammar"
      | "common_word"
      | "phrase"
      | "time_word"
      | "time_phrase";
    term?: string;
    translation?: string;
    notes?: string | null;
  } = {};
  if (typeof body.category === "string" && isCategory(body.category)) {
    patch.category = body.category;
  }
  if (typeof body.term === "string") patch.term = body.term.trim();
  if (typeof body.translation === "string") {
    patch.translation = body.translation.trim();
  }
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;

  const { vocab } = languageLearningServices();
  await vocab.update(id, patch);
  return json({ ok: true });
}

export async function handleDelete(_req: Request, ctx: WidgetRouteContext) {
  const [id] = ctx.path;
  if (!id) return badRequest("id is required");
  const { vocab } = languageLearningServices();
  await vocab.remove(id);
  return json({ ok: true });
}
