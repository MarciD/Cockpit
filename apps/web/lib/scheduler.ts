import { Cron, type CatchCallbackFn } from "croner";
import { listEnabledRecurringTasks, updateRecurringTask } from "@cockpit/db";
import { getDb } from "./db";
import {
  getCalendarData,
  getGitlabData,
  getJiraData,
} from "./integration-cache";

interface SchedulerState {
  started: boolean;
  refreshJob: Cron | null;
  taskJobs: Map<string, Cron>;
}

// One scheduler shared across route bundles + instrumentation.
const globalForScheduler = globalThis as unknown as {
  cockpitScheduler?: SchedulerState;
};
const state: SchedulerState = (globalForScheduler.cockpitScheduler ??= {
  started: false,
  refreshJob: null,
  taskJobs: new Map(),
});

async function refreshAll(): Promise<void> {
  await Promise.allSettled([
    getGitlabData(true),
    getJiraData(true),
    getCalendarData(),
  ]);
}

/**
 * croner's `catch` option defaults to `false`, and that default is dangerous
 * here: croner then awaits the job function completely unguarded, so a throw or
 * a rejected promise inside a job becomes an unhandled rejection and Node takes
 * the whole server down with it. Every `new Cron` below therefore passes
 * `catch`, and it passes a function rather than `true` so a failing job is
 * visible instead of silently skipped.
 */
function reportJobFailure(name: string, err: unknown): void {
  const detail =
    err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`[cockpit] scheduled job ${name} failed: ${detail}\n`);
}

const onJobError: CatchCallbackFn = (err, job) =>
  reportJobFailure(job.name ?? "unnamed", err);

/** (Re)register a croner job per enabled recurring task; refresh next-run. */
export function reloadRecurringTasks(): void {
  for (const job of state.taskJobs.values()) job.stop();
  state.taskJobs.clear();

  const db = getDb();
  for (const task of listEnabledRecurringTasks(db)) {
    try {
      const job = new Cron(
        task.cron,
        { name: `task:${task.id}`, protect: true, catch: onJobError },
        () => {
          const next = state.taskJobs.get(task.id)?.nextRun() ?? null;
          updateRecurringTask(getDb(), task.id, { nextRunAt: next });
        },
      );
      state.taskJobs.set(task.id, job);
      updateRecurringTask(db, task.id, { nextRunAt: job.nextRun() ?? null });
    } catch {
      // invalid cron expression — skip this task
    }
  }
}

/** Started once from instrumentation.ts (Node runtime only). */
export function startScheduler(): void {
  if (state.started) return;
  state.started = true;

  // Warm the integration caches now, then every 5 minutes — fires even with
  // the browser closed, as long as the server (launchd agent) is running.
  state.refreshJob = new Cron(
    "*/5 * * * *",
    { name: "refresh", protect: true, catch: onJobError },
    refreshAll,
  );
  // Outside croner, so the `catch` above does not cover it.
  void refreshAll().catch((err) => reportJobFailure("refresh (warm-up)", err));

  reloadRecurringTasks();
  process.stdout.write("[cockpit] scheduler started\n");
}
