import { randomUUID } from "node:crypto";
import { getProviderConfig } from "../credentials";
import { getDb } from "../db";
import { InboxService } from "./application/inbox-service";
import { NotifyService } from "./application/notify-service";
import { PreferencesService } from "./application/preferences-service";
import { ReminderService } from "./application/reminder-service";
import type { NotificationInput, Notification } from "./domain/notification";
import type { NotificationChannel, Reminder } from "./domain/ports";
import { TerminalNotifierChannel } from "./infrastructure/channel-desktop";
import {
  NtfyChannel,
  type NtfyConfig,
} from "./infrastructure/channel-phone-ntfy";
import { DrizzleDeliveryLog } from "./infrastructure/drizzle-delivery-log";
import { DrizzleNotificationRepository } from "./infrastructure/drizzle-notification-repository";
import { DrizzlePreferencesRepository } from "./infrastructure/drizzle-preferences-repository";
import { DrizzleReminderRepository } from "./infrastructure/drizzle-reminder-repository";

export interface NotificationServices {
  notify: NotifyService;
  inbox: InboxService;
  preferences: PreferencesService;
  reminders: ReminderService;
}

const clock = { now: () => new Date() };
const log = {
  warn: (message: string) => process.stderr.write(`[cockpit] ${message}\n`),
};

/** Where a desktop click lands. The launchd install sets PORT=4000; dev runs on 4000 too. */
const localUrl = () =>
  process.env.COCKPIT_LOCAL_URL ??
  `http://localhost:${process.env.PORT ?? "4000"}`;

const channels: readonly NotificationChannel[] = [
  new TerminalNotifierChannel(),
  new NtfyChannel(() => getProviderConfig<NtfyConfig>("ntfy")),
];

/** The only place adapters are wired to services. Cheap; build per call. */
export function notificationServices(): NotificationServices {
  const db = getDb();
  const repo = new DrizzleNotificationRepository(db);
  const prefs = new DrizzlePreferencesRepository(
    db,
    process.env.COCKPIT_PUBLIC_URL?.trim() || null,
  );
  const deliveries = new DrizzleDeliveryLog(db, randomUUID);
  const notify = new NotifyService(
    repo,
    channels,
    prefs,
    deliveries,
    { localUrl: localUrl() },
    clock,
    log,
    randomUUID,
  );
  return {
    notify,
    inbox: new InboxService(repo, clock),
    preferences: new PreferencesService(prefs, channels, deliveries, clock),
    reminders: new ReminderService(
      new DrizzleReminderRepository(db),
      notify,
      clock,
      randomUUID,
    ),
  };
}

/** What producers call. Never throws; returns null when nothing was stored. */
export async function notify(
  input: NotificationInput,
): Promise<Notification | null> {
  const result = await notificationServices().notify.notify(input);
  return result?.notification ?? null;
}

/** Raise `input` at `fireAt`; drained every minute and once at boot. */
export function scheduleNotification(
  fireAt: Date,
  input: NotificationInput,
): Reminder {
  return notificationServices().reminders.schedule(fireAt, input);
}
