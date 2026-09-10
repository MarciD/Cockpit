import { Cron, type CatchCallbackFn } from "croner";
import { resolveJobs } from "@cockpit/widgets/server/contract";
import { notificationServices, notify } from "./notifications/composition";
import { setWidgetJobReloader } from "./widget-jobs";
import { widgetServerModules } from "./widget-server";

interface SchedulerState {
  started: boolean;
  remindersJob: Cron | null;
  pruneJob: Cron | null;
  /** Per widget, so one widget's jobs can be rebuilt without touching the rest. */
  widgetJobs: Map<string, Cron[]>;
}

/** A failing job notifies at most once an hour, so a flapping job cannot flood the inbox. */
const JOB_FAILURE_DEDUPE_MS = 60 * 60_000;

// One scheduler shared across route bundles + instrumentation.
const globalForScheduler = globalThis as unknown as {
  cockpitScheduler?: SchedulerState;
};
const state: SchedulerState = (globalForScheduler.cockpitScheduler ??= {
  started: false,
  remindersJob: null,
  pruneJob: null,
  widgetJobs: new Map(),
});

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

/**
 * (Re)register one widget's jobs. A widget whose jobs depend on stored rows
 * (recurring tasks) declares `jobs` as a function and calls `deps.reloadJobs()`
 * after a change, which lands here.
 */
export function registerWidgetJobs(widgetId: string): void {
  for (const job of state.widgetJobs.get(widgetId) ?? []) job.stop();
  state.widgetJobs.delete(widgetId);

  const mod = widgetServerModules()[widgetId];
  if (!mod) return;

  const running: Cron[] = [];
  for (const job of resolveJobs(mod)) {
    try {
      // Annotated because the callback closes over `cron` itself.
      const cron: Cron = new Cron(
        job.cron,
        { name: `${widgetId}:${job.name}`, protect: true, catch: onJobError },
        () => job.run({ nextRunAt: cron.nextRun() }),
      );
      job.onSchedule?.({ nextRunAt: cron.nextRun() });
      running.push(cron);
    } catch {
      // An invalid cron expression is the widget's problem, not the server's.
    }
  }
  state.widgetJobs.set(widgetId, running);
}

/** Started once from instrumentation.ts (Node runtime only). */
export function startScheduler(): void {
  if (state.started) return;
  state.started = true;

  setWidgetJobReloader(registerWidgetJobs);

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

  // Every widget's own jobs — warm-ups, watches, per-row reminders.
  for (const widgetId of Object.keys(widgetServerModules())) {
    registerWidgetJobs(widgetId);
  }

  process.stdout.write("[cockpit] scheduler started\n");
}
