import "server-only";
import type { WidgetServerFactory } from "./contract";
import { xdccWatchServer } from "../xdcc-watch/server";

/** One line per widget with server logic. The app builds each factory once. */
export const serverWidgetFactories: Record<string, WidgetServerFactory> = {
  "xdcc-watch": xdccWatchServer,
};
