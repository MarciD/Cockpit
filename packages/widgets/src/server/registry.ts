import "server-only";
import type { WidgetServerFactory } from "./contract";
import { aiAssistantServer } from "../ai-assistant/server";
import { calendarServerWith } from "../google-calendar-today/server";
import { gitlabOpenMrsServer } from "../gitlab-open-mrs/server";
import { languageLearningServer } from "../language-learning/server";
import { jiraMyIssuesServer } from "../jira-my-issues/server";
import { newsServer } from "../news/server";
import { recurringTasksServer } from "../recurring-tasks/server";
import { todoServer } from "../todo/server";
import { weatherServer } from "../weather/server";
import { xdccWatchServer } from "../xdcc-watch/server";

export type { CalendarStore } from "../google-calendar-today/server/routes";

/**
 * One line per widget with server logic. The app builds each factory once.
 * `google-calendar-today` is the one exception to "no arguments": its iCal
 * URLs are credentials, so the app injects the store that holds them.
 */
export function serverWidgetFactoriesWith(
  calendarStore: import("../google-calendar-today/server/routes").CalendarStore,
): Record<string, WidgetServerFactory> {
  return {
    ...serverWidgetFactories,
    "google-calendar-today": calendarServerWith(calendarStore),
  };
}

export const serverWidgetFactories: Record<string, WidgetServerFactory> = {
  "ai-assistant": aiAssistantServer,
  "gitlab-open-mrs": gitlabOpenMrsServer,
  "jira-my-issues": jiraMyIssuesServer,
  "language-learning": languageLearningServer,
  news: newsServer,
  "recurring-tasks": recurringTasksServer,
  todo: todoServer,
  weather: weatherServer,
  "xdcc-watch": xdccWatchServer,
};
