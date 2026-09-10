import "server-only";
import {
  describePayload,
  EMPTY_SCHEMA,
  type WidgetServerFactory,
} from "../../server/contract";
import { buildRoutes, readIssues } from "./routes";

const WARM_CRON = "*/5 * * * *";

export const jiraMyIssuesServer: WidgetServerFactory = (deps) => ({
  id: "jira-my-issues",
  routes: buildRoutes(deps.throughCache),
  jobs: [
    {
      name: "warm",
      cron: WARM_CRON,
      run: async () => {
        await readIssues(deps.throughCache, true);
      },
    },
  ],
  assistantTools: [
    {
      name: "get_jira_issues",
      description: "Jira issues currently assigned to you.",
      inputSchema: EMPTY_SCHEMA,
      run: async () =>
        describePayload("Jira", await readIssues(deps.throughCache)),
    },
  ],
});
