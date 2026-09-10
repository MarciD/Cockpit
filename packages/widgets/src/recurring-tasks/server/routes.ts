import {
  createRecurringTask,
  deleteRecurringTask,
  listRecurringTasks,
  updateRecurringTask,
  type CockpitDb,
} from "@cockpit/db";
import {
  badRequest,
  json,
  readJson,
  type WidgetRoutes,
} from "../../server/contract";

export function buildRoutes(
  db: CockpitDb,
  newId: () => string,
  reload: () => void,
): WidgetRoutes {
  return {
    "GET ": async (_req, ctx) => {
      const profileId = ctx.url.searchParams.get("profileId");
      if (!profileId) return badRequest("profileId is required");
      return json({ tasks: listRecurringTasks(db, profileId) });
    },

    "POST ": async (req) => {
      const body = await readJson<Record<string, unknown>>(req);
      if (
        typeof body?.profileId !== "string" ||
        typeof body.title !== "string" ||
        typeof body.cron !== "string"
      ) {
        return badRequest("profileId, title and cron are required");
      }
      const id = newId();
      createRecurringTask(db, {
        id,
        profileId: body.profileId,
        title: body.title,
        cron: body.cron,
      });
      reload();
      return json({ id });
    },

    "PATCH ": async (req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("task id is required");
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      const patch: Parameters<typeof updateRecurringTask>[2] = {};
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (typeof body.title === "string") patch.title = body.title;
      if (typeof body.cron === "string") patch.cron = body.cron;
      updateRecurringTask(db, id, patch);
      reload();
      return json({ ok: true });
    },

    "DELETE ": async (_req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("task id is required");
      deleteRecurringTask(db, id);
      reload();
      return json({ ok: true });
    },
  };
}
