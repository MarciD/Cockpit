import "server-only";
import type { WidgetServerFactory } from "../../server/contract";
import { buildRoutes } from "./routes";

/**
 * The chat itself. It hosts no data of its own: every tool but the inbox one
 * comes from the widget that owns that data, collected through `deps`.
 */
export const aiAssistantServer: WidgetServerFactory = (deps) => ({
  id: "ai-assistant",
  routes: buildRoutes(deps),
});
