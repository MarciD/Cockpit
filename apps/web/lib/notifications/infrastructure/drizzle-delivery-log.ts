import {
  latestNotificationDelivery,
  recordNotificationDelivery,
  type CockpitDb,
  type NotificationDeliveryRow,
} from "@cockpit/db";
import type {
  DeliveryLog,
  DeliveryRecord,
  DeliveryStatus,
} from "../domain/ports";
import { isChannelId, type ChannelId } from "../domain/routing";

function toRecord(row: NotificationDeliveryRow): DeliveryRecord | undefined {
  if (!isChannelId(row.channel)) return undefined;
  return {
    channel: row.channel,
    status: row.status as DeliveryStatus,
    detail: row.error,
    notificationId: row.notificationId,
    at: row.at,
  };
}

export class DrizzleDeliveryLog implements DeliveryLog {
  constructor(
    private readonly db: CockpitDb,
    private readonly newId: () => string,
  ) {}

  record(entry: DeliveryRecord): void {
    recordNotificationDelivery(this.db, {
      id: this.newId(),
      notificationId: entry.notificationId,
      channel: entry.channel,
      status: entry.status,
      error: entry.detail,
      at: entry.at,
    });
  }

  latest(channel: ChannelId): DeliveryRecord | undefined {
    const row = latestNotificationDelivery(this.db, channel);
    return row ? toRecord(row) : undefined;
  }
}
