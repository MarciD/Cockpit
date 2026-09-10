import "server-only";
import type { WidgetServerFactory } from "../../server/contract";
import { buildServices } from "./composition";
import { buildRoutes } from "./routes";

const WATCH_CRON = "*/30 * * * *";

/**
 * Release watch's server half: search across public XDCC indexes, saved
 * watches the scheduler re-runs, and one notification per run. It searches and
 * notifies; it never connects to IRC or transfers anything.
 */
export const xdccWatchServer: WidgetServerFactory = (deps) => {
  const services = buildServices(deps);
  return {
    id: "xdcc-watch",
    routes: buildRoutes(services),
    jobs: [
      {
        name: "watch",
        cron: WATCH_CRON,
        run: async () => {
          await services.watches.runDue();
        },
      },
    ],
    kinds: { "xdcc.release": "Release watch · new packs" },
  };
};
