import "server-only";
import {
  describePayload,
  EMPTY_SCHEMA,
  type WidgetServerFactory,
} from "../../server/contract";
import { buildRoutes, readEvents, type CalendarStore } from "./routes";

const WARM_CRON = "*/5 * * * *";

/**
 * Any iCal feed: Google, Outlook or a plain `.ics`. The URLs are credentials,
 * so the app injects the calendar store rather than this widget reaching into
 * it. The server's own timezone is used for the warm-up and the assistant.
 */
export function calendarServerWith(store: CalendarStore): WidgetServerFactory {
  return (deps) => {
    const serverZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = (force = false) =>
      readEvents(store, deps.cachedFetch, "day", serverZone, force);
    return {
      id: "google-calendar-today",
      routes: buildRoutes(store, deps.cachedFetch),
      jobs: [
        {
          name: "warm",
          cron: WARM_CRON,
          run: async () => void (await today()),
        },
      ],
      assistantTools: [
        {
          name: "get_today_events",
          description: "Today's calendar events.",
          inputSchema: EMPTY_SCHEMA,
          run: async () => describePayload("Calendar", await today()),
        },
      ],
    };
  };
}
