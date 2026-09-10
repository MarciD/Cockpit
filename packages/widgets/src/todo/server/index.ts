import "server-only";
import { listTodos } from "@cockpit/db";
import { EMPTY_SCHEMA, type WidgetServerFactory } from "../../server/contract";
import { buildRoutes } from "./routes";

export const todoServer: WidgetServerFactory = (deps) => ({
  id: "todo",
  routes: buildRoutes(deps.db, () => crypto.randomUUID()),
  assistantTools: [
    {
      name: "get_todos",
      description: "The current desk's ad-hoc to-do checklist.",
      inputSchema: EMPTY_SCHEMA,
      run: async (_input, ctx) =>
        JSON.stringify(listTodos(deps.db, ctx.profileId)),
    },
  ],
});
