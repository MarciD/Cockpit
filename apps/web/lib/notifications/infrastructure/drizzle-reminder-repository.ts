import {
  cancelScheduledNotification,
  insertScheduledNotification,
  listDueScheduledNotifications,
  markScheduledNotificationFired,
  pruneScheduledNotifications,
  type CockpitDb,
  type ScheduledNotificationRow,
} from "@cockpit/db";
import type { NotificationInput } from "../domain/notification";
import type { Reminder, ReminderRepository } from "../domain/ports";

function toReminder(row: ScheduledNotificationRow): Reminder {
  return {
    id: row.id,
    fireAt: row.fireAt,
    payload: row.payloadJson as NotificationInput,
    firedAt: row.firedAt,
  };
}

export class DrizzleReminderRepository implements ReminderRepository {
  constructor(private readonly db: CockpitDb) {}

  add(id: string, fireAt: Date, payload: NotificationInput): Reminder {
    return toReminder(
      insertScheduledNotification(this.db, {
        id,
        fireAt,
        payloadJson: payload,
      }),
    );
  }

  due(now: Date): Reminder[] {
    return listDueScheduledNotifications(this.db, now).map(toReminder);
  }

  markFired(id: string, at: Date): void {
    markScheduledNotificationFired(this.db, id, at);
  }

  cancel(id: string): void {
    cancelScheduledNotification(this.db, id);
  }

  prune(before: Date): number {
    return pruneScheduledNotifications(this.db, before);
  }
}
