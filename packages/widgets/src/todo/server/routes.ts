import {
  createTodo,
  deleteTodo,
  listTodos,
  setTodo,
  type CockpitDb,
} from "@cockpit/db";
import {
  badRequest,
  json,
  readJson,
  type WidgetRoutes,
} from "../../server/contract";

/** `todos` stays in the core schema: a desk owns its list, cascade included. */
export function buildRoutes(db: CockpitDb, newId: () => string): WidgetRoutes {
  return {
    "GET ": async (_req, ctx) => {
      const profileId = ctx.url.searchParams.get("profileId");
      if (!profileId) return badRequest("profileId is required");
      return json({ todos: listTodos(db, profileId) });
    },

    "POST ": async (req) => {
      const body = await readJson<{ profileId?: unknown; title?: unknown }>(
        req,
      );
      if (
        typeof body?.profileId !== "string" ||
        typeof body.title !== "string"
      ) {
        return badRequest("profileId and title are required");
      }
      const id = newId();
      createTodo(db, { id, profileId: body.profileId, title: body.title });
      return json({ id });
    },

    "PATCH ": async (req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("todo id is required");
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      const patch: Parameters<typeof setTodo>[2] = {};
      if (typeof body.done === "boolean") patch.done = body.done;
      if (typeof body.title === "string") patch.title = body.title;
      if (body.startDate === null) patch.startDate = null;
      else if (typeof body.startDate === "string")
        patch.startDate = new Date(body.startDate);
      if (body.endDate === null) patch.endDate = null;
      else if (typeof body.endDate === "string")
        patch.endDate = new Date(body.endDate);
      setTodo(db, id, patch);
      return json({ ok: true });
    },

    "DELETE ": async (_req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("todo id is required");
      deleteTodo(db, id);
      return json({ ok: true });
    },
  };
}
