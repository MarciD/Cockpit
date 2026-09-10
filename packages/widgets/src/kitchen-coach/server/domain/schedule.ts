import type { StepDto } from "../../types";

export interface ScheduledStep {
  index: number;
  startsAt: Date;
  text: string;
}

export interface CookSchedule {
  /** When to start cooking so the food is ready at `mealTime`. */
  startAt: Date;
  steps: ScheduledStep[];
  /** Steps that must happen hours earlier: marinate, thaw, proof. */
  leadTime: ScheduledStep[];
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** A step without a stated duration still takes a moment. */
const DEFAULT_STEP_MIN = 3;

/**
 * Works backwards from when you want to eat. Lead-time steps are pulled out
 * of the sequence entirely — they belong to an earlier hour, not to the run.
 */
export function planBackwards(steps: StepDto[], mealTime: Date): CookSchedule {
  const inline = steps.filter((s) => !s.leadTimeHours);
  const total = inline.reduce(
    (m, s) => m + (s.durationMin ?? DEFAULT_STEP_MIN),
    0,
  );
  const startAt = new Date(mealTime.getTime() - total * MINUTE_MS);

  let cursor = startAt.getTime();
  const scheduled: ScheduledStep[] = [];
  steps.forEach((step, index) => {
    if (step.leadTimeHours) return;
    scheduled.push({ index, startsAt: new Date(cursor), text: step.text });
    cursor += (step.durationMin ?? DEFAULT_STEP_MIN) * MINUTE_MS;
  });

  const leadTime: ScheduledStep[] = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => Boolean(step.leadTimeHours))
    .map(({ step, index }) => ({
      index,
      startsAt: new Date(
        mealTime.getTime() - (step.leadTimeHours ?? 0) * HOUR_MS,
      ),
      text: step.text,
    }));

  return { startAt, steps: scheduled, leadTime };
}
