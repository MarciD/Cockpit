import "server-only";
import type { WidgetServerFactory } from "../../server/contract";
import { buildRoutes } from "./routes";

/** RSS and Atom, no key. Feed URLs are client config, so every one is validated. */
export const newsServer: WidgetServerFactory = (deps) => ({
  id: "news",
  routes: buildRoutes(deps.cachedFetch),
});
