import {
  countUnreadNotifications,
  dismissNotification,
  findNotificationByDedupeKey,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  pruneNotifications,
  setNotificationRead,
  type CockpitDb,
  type NotificationRow,
} from "@cockpit/db";
import {
  SEVERITIES,
  type Notification,
  type Severity,
} from "../domain/notification";
import type {
  ListOptions,
  NewNotification,
  NotificationRepository,
} from "../domain/ports";

function toSeverity(value: string): Severity {
  return (SEVERITIES as readonly string[]).includes(value)
    ? (value as Severity)
    : "info";
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    profileId: row.profileId,
    kind: row.kind,
    severity: toSeverity(row.severity),
    title: row.title,
    body: row.body,
    url: row.url,
    data: (row.dataJson as Record<string, unknown> | null) ?? null,
    dedupeKey: row.dedupeKey,
    createdAt: row.createdAt,
    readAt: row.readAt,
    dismissedAt: row.dismissedAt,
  };
}

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: CockpitDb) {}

  insert(value: NewNotification): Notification {
    return toNotification(
      insertNotification(this.db, {
        id: value.id,
        profileId: value.profileId,
        kind: value.kind,
        severity: value.severity,
        title: value.title,
        body: value.body,
        url: value.url,
        dataJson: value.data,
        dedupeKey: value.dedupeKey,
        createdAt: value.createdAt,
      }),
    );
  }

  findRecentByDedupeKey(key: string, since: Date): Notification | undefined {
    const row = findNotificationByDedupeKey(this.db, key, since);
    return row ? toNotification(row) : undefined;
  }

  list(options?: ListOptions): Notification[] {
    return listNotifications(this.db, options).map(toNotification);
  }

  countUnread(): number {
    return countUnreadNotifications(this.db);
  }

  setRead(id: string, read: boolean): void {
    setNotificationRead(this.db, id, read);
  }

  markAllRead(): number {
    return markAllNotificationsRead(this.db);
  }

  dismiss(id: string): void {
    dismissNotification(this.db, id);
  }

  prune(before: Date): number {
    return pruneNotifications(this.db, before);
  }
}
