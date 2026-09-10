import { Cron, type CatchCallbackFn } from "croner";
import { listEnabledRecurringTasks, updateRecurringTask } from "@cockpit/db";
import { getDb } from "./db";
import {
  getCalendarData,
  getGitlabData,
  getJiraData,
} from "./integration-cache";
import { notificationServices, notify } from "./notifications/composition";

interface SchedulerState {
  started: boolean;
  refreshJob: Cron | null;
  pruneJob: Cron | null;
  remindersJob: Cron | null;
  taskJobs: Map<string, Cron>;
}

/** A failing job notifies at most once an hour, so a flapping job cannot flood the inbox. */
const JOB_FAILURE_DEDUPE_MS = 60 * 60_000;

// One scheduler shared across route bundles + instrumentation.
const globalForScheduler = globalThis as unknown as {
  cockpitScheduler?: SchedulerState;
};
const state: SchedulerState = (globalForScheduler.cockpitScheduler ??= {
  started: false,
  refreshJob: null,
  pruneJob: null,
  remindersJob: null,
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

const onJobError: CatchCallbackFn = (err, job) => {
  const name = job.name ?? "unnamed";
  reportJobFailure(name, err);
  // notify() never throws, so this cannot re-enter the failure path.
  void notify({
    kind: "scheduler.job-failed",
    severity: "action",
    title: `Scheduled job ${name} failed`,
    body: err instanceof Error ? err.message : String(err),
    dedupeKey: `scheduler.job-failed:${name}`,
    dedupeWindowMs: JOB_FAILURE_DEDUPE_MS,
  });
};

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
        async () => {
          const next = state.taskJobs.get(task.id)?.nextRun() ?? null;
          updateRecurringTask(getDb(), task.id, { nextRunAt: next });
          // The task firing is the notification; the row deep-links to its desk.
          await notify({
            kind: "tasks.due",
            severity: "action",
            profileId: task.profileId,
            title: task.title,
            body: `Recurring task · ${task.cron}`,
            url: `/${task.profileId}`,
            data: { source: "recurring", taskId: task.id },
          });
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

  // Reminders: anything due fires within the minute, and once at boot so a
  // restart at 17:29 does not swallow a 17:30 reminder.
  const drainReminders = async () => {
    await notificationServices().reminders.drain();
  };
  state.remindersJob = new Cron(
    "* * * * *",
    { name: "reminders:drain", protect: true, catch: onJobError },
    drainReminders,
  );
  void drainReminders().catch((err) =>
    reportJobFailure("reminders:drain (boot)", err),
  );

  // Keep the inbox bounded: read or dismissed rows older than 30 days go.
  state.pruneJob = new Cron(
    "0 4 * * *",
    { name: "notifications:prune", protect: true, catch: onJobError },
    () => {
      notificationServices().inbox.prune();
    },
  );

  reloadRecurringTasks();
  process.stdout.write("[cockpit] scheduler started\n");
}
