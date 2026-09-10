import { normalizeInput, type NotificationInput } from "../domain/notification";
import type { Clock, Reminder, ReminderRepository } from "../domain/ports";
import type { NotifyService } from "./notify-service";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REMINDER_HISTORY_DAYS = 7;

/**
 * "Raise this notification at 17:30." Rows are drained by a minute-cron and once
 * at boot, so a restart at 17:29 does not swallow a 17:30 reminder.
 */
export class ReminderService {
  constructor(
    private readonly repo: ReminderRepository,
    private readonly notify: NotifyService,
    private readonly clock: Clock,
    private readonly newId: () => string,
  ) {}

  /** Validates the payload now, so a typo fails at the call site, not at 17:30. */
  schedule(fireAt: Date, input: NotificationInput): Reminder {
    if (Number.isNaN(fireAt.getTime())) throw new Error("fireAt is not a date");
    normalizeInput(input);
    return this.repo.add(this.newId(), fireAt, input);
  }

  cancel(id: string): void {
    this.repo.cancel(id);
  }

  /** Fires everything due. Marks first, then notifies: a crash mid-way loses one, never doubles it. */
  async drain(): Promise<number> {
    const now = this.clock.now();
    const due = this.repo.due(now);
    for (const reminder of due) {
      this.repo.markFired(reminder.id, now);
      await this.notify.notify(reminder.payload);
    }
    this.repo.prune(new Date(now.getTime() - REMINDER_HISTORY_DAYS * DAY_MS));
    return due.length;
  }
}
