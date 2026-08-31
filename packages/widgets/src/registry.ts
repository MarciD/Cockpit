import type { WidgetDefinition, WidgetRegistry } from "@cockpit/widget-sdk";
import aiAssistant from "./ai-assistant";
import customApi from "./custom-api";
import gitlabOpenMrs from "./gitlab-open-mrs";
import googleCalendarToday from "./google-calendar-today";
import jiraMyIssues from "./jira-my-issues";
import languageLearning from "./language-learning";
import news from "./news";
import recurringTasks from "./recurring-tasks";
import todo from "./todo";
import weather from "./weather";

/**
 * The widget catalog. Adding a widget = create a folder under `src/`, default-
 * export `defineWidget({...})`, and add it to this array. The registry is a
 * typed map the host uses to render instances by `widgetId`.
 */
const definitions: WidgetDefinition[] = [
  aiAssistant as unknown as WidgetDefinition,
  gitlabOpenMrs as unknown as WidgetDefinition,
  jiraMyIssues as unknown as WidgetDefinition,
  googleCalendarToday as unknown as WidgetDefinition,
  weather as unknown as WidgetDefinition,
  todo as unknown as WidgetDefinition,
  news as unknown as WidgetDefinition,
  recurringTasks as unknown as WidgetDefinition,
  customApi as unknown as WidgetDefinition,
  languageLearning as unknown as WidgetDefinition,
];

export const widgetRegistry: WidgetRegistry = Object.fromEntries(
  definitions.map((widget) => [widget.id, widget]),
);

export function getWidget(id: string): WidgetDefinition | undefined {
  return widgetRegistry[id];
}

export function listWidgets(): WidgetDefinition[] {
  return definitions;
}

export type { WidgetDefinition, WidgetRegistry } from "@cockpit/widget-sdk";
