import "server-only";
import {
  listEnabledRecurringTasks,
  listRecurringTasks,
  updateRecurringTask,
} from "@cockpit/db";
import {
  EMPTY_SCHEMA,
  type WidgetJob,
  type WidgetServerFactory,
} from "../../server/contract";
import { buildRoutes } from "./routes";

/**
 * One job per enabled task, rebuilt whenever a task changes. Firing a task is
 * what raises its notification; the row deep-links to the desk it belongs to.
 */
export const recurringTasksServer: WidgetServerFactory = (deps) => {
  const jobsFor = (): WidgetJob[] =>
    listEnabledRecurringTasks(deps.db).map((task) => ({
      name: `task:${task.id}`,
      cron: task.cron,
      // The scheduler owns the cron handle, so it tells the job when it fires
      // next; that is what the tile shows as "next Wed 09:00".
      onSchedule: ({ nextRunAt }) =>
        updateRecurringTask(deps.db, task.id, { nextRunAt }),
      run: async ({ nextRunAt }) => {
        updateRecurringTask(deps.db, task.id, { nextRunAt });
        await deps.notify({
          kind: "tasks.due",
          severity: "action",
          profileId: task.profileId,
          title: task.title,
          body: `Recurring task · ${task.cron}`,
          url: `/${task.profileId}`,
          data: { source: "recurring", taskId: task.id },
        });
      },
    }));

  return {
    id: "recurring-tasks",
    routes: buildRoutes(deps.db, () => crypto.randomUUID(), deps.reloadJobs),
    jobs: jobsFor,
    kinds: { "tasks.due": "Recurring tasks" },
    assistantTools: [
      {
        name: "get_recurring_tasks",
        description: "The current desk's recurring (scheduled) tasks.",
        inputSchema: EMPTY_SCHEMA,
        run: async (_input, ctx) =>
          JSON.stringify(listRecurringTasks(deps.db, ctx.profileId)),
      },
    ],
  };
};
