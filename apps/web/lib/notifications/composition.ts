import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { InboxService } from "./application/inbox-service";
import { NotifyService } from "./application/notify-service";
import type { NotificationInput, Notification } from "./domain/notification";
import type { NotificationChannel } from "./domain/ports";
import { DrizzleNotificationRepository } from "./infrastructure/drizzle-notification-repository";

export interface NotificationServices {
  notify: NotifyService;
  inbox: InboxService;
}

const clock = { now: () => new Date() };
const log = {
  warn: (message: string) => process.stderr.write(`[cockpit] ${message}\n`),
};

/** Delivery channels beyond the inbox. Phone and desktop arrive in phase 1. */
const channels: readonly NotificationChannel[] = [];

/** The only place adapters are wired to services. Cheap; build per call. */
export function notificationServices(): NotificationServices {
  const repo = new DrizzleNotificationRepository(getDb());
  return {
    notify: new NotifyService(repo, channels, clock, log, randomUUID),
    inbox: new InboxService(repo, clock),
  };
}

/** What producers call. Never throws; returns null when nothing was stored. */
export function notify(input: NotificationInput): Promise<Notification | null> {
  return notificationServices().notify.notify(input);
}
