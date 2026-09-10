import "server-only";
import type { WidgetServerFactory } from "../../server/contract";
import { defaultOptions, slotForTime } from "../config";
import type { IdeaOptions } from "../types";
import { buildServices } from "./composition";
import type { DeskContext } from "./application/suggestion-service";
import { buildRoutes } from "./routes";

/** Checked every quarter hour; the nudge fires in the quarter it is due. */
const NUDGE_CRON = "0,15,30,45 * * * *";

/**
 * Küche's server half. Two things it reads from elsewhere, both through the
 * cache the weather and calendar widgets already fill, and both only when the
 * request asks for them: today's weather and the next appointment.
 */
export const kitchenCoachServer: WidgetServerFactory = (deps) => {
  const { services, setTier } = buildServices(deps);

  const desk = async (
    _profileId: string,
    options: IdeaOptions,
  ): Promise<DeskContext> => {
    const context: DeskContext = {};
    if (options.useWeather) {
      const cached = await deps.cachedFetch<{
        tempC: number;
        condition: string;
      }>("weather:52.52,13.405", async () => {
        throw new Error("no cached weather");
      });
      const w = cached.items;
      if (w) context.weather = `${w.tempC} °C, ${w.condition}`;
    }
    if (options.useCalendar) {
      const cached = await deps.cachedFetch<
        { title: string; start: string; allDay: boolean }[]
      >("kitchen:calendar-today", async () => {
        throw new Error("no cached calendar");
      });
      const next = (cached.items ?? [])
        .filter((e) => !e.allDay && new Date(e.start) > new Date())
        .sort((a, b) => a.start.localeCompare(b.start))[0];
      if (next)
        context.nextEvent = {
          title: next.title,
          startsAt: new Date(next.start),
        };
    }
    return context;
  };

  return {
    id: "kitchen-coach",
    routes: buildRoutes(services, setTier, desk),
    jobs: [
      {
        name: "dinner-nudge",
        cron: NUDGE_CRON,
        run: async () => {
          // A reminder to decide, not a generated menu: ideas cost a model
          // call each and are better fetched when you actually tap.
          const now = new Date();
          const today = now.toISOString().slice(0, 10);
          for (const nudge of services.library.nudges()) {
            if (!nudge.days.includes(now.getDay())) continue;
            const [hour, minute] = nudge.at.split(":").map(Number);
            if (hour !== now.getHours()) continue;
            if (Math.abs(now.getMinutes() - (minute ?? 0)) > 7) continue;
            await deps.notify({
              kind: "kitchen.dinner",
              severity: "info",
              profileId: nudge.profileId,
              title: "Heute Abend?",
              body: "Sag mir, was da ist — der Chef macht drei Vorschläge.",
              url: `/w/kitchen-coach?profile=${encodeURIComponent(nudge.profileId)}`,
              dedupeKey: `kitchen.dinner:${nudge.profileId}:${today}`,
              data: { source: "küche" },
            });
          }
        },
      },
    ],
    kinds: {
      "kitchen.dinner": "Küche · Abend-Anstupser",
      "kitchen.prep": "Küche · Vorbereitung",
      "kitchen.timer": "Küche · Timer",
    },
  };
};

export { defaultOptions, slotForTime };
