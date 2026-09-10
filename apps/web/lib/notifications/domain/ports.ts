import type {
  Notification,
  NotificationInput,
  NormalizedInput,
} from "./notification";
import type { ChannelId, QuietHours } from "./routing";

export interface NewNotification extends Omit<
  NormalizedInput,
  "dedupeWindowMs"
> {
  id: string;
  createdAt: Date;
}

export interface ListOptions {
  since?: Date;
  unreadOnly?: boolean;
  limit?: number;
}

export interface NotificationRepository {
  insert(value: NewNotification): Notification;
  findRecentByDedupeKey(key: string, since: Date): Notification | undefined;
  list(options?: ListOptions): Notification[];
  countUnread(): number;
  setRead(id: string, read: boolean): void;
  markAllRead(): number;
  dismiss(id: string): void;
  prune(before: Date): number;
}

/** Where a channel should point a click: the phone needs the public URL, the Mac the local one. */
export interface DeliveryContext {
  publicUrl: string | null;
  localUrl: string;
}

export interface ChannelAvailability {
  ok: boolean;
  /** Human-readable: "terminal-notifier at /opt/homebrew/bin" or "not connected". */
  detail: string;
}

/** A delivery target beyond the inbox (desktop banner, phone push). */
export interface NotificationChannel {
  readonly id: ChannelId;
  readonly label: string;
  availability(): Promise<ChannelAvailability>;
  deliver(notification: Notification, context: DeliveryContext): Promise<void>;
}

export type DeliveryStatus = "sent" | "failed" | "skipped";

export interface DeliveryOutcome {
  channel: ChannelId;
  status: DeliveryStatus;
  detail: string | null;
}

export interface DeliveryRecord extends DeliveryOutcome {
  notificationId: string;
  at: Date;
}

export interface DeliveryLog {
  record(entry: DeliveryRecord): void;
  latest(channel: ChannelId): DeliveryRecord | undefined;
}

export interface StoredPreferences {
  byKind: Record<string, ChannelId[]>;
  quiet: QuietHours | null;
  publicUrl: string | null;
}

export interface PreferencesRepository {
  load(): StoredPreferences;
  saveByKind(byKind: Record<string, ChannelId[]>): void;
  saveSettings(settings: {
    quiet: QuietHours | null;
    publicUrl: string | null;
  }): void;
}

export interface Reminder {
  id: string;
  fireAt: Date;
  payload: NotificationInput;
  firedAt: Date | null;
}

export interface ReminderRepository {
  add(id: string, fireAt: Date, payload: NotificationInput): Reminder;
  due(now: Date): Reminder[];
  markFired(id: string, at: Date): void;
  cancel(id: string): void;
  prune(before: Date): number;
}

export interface Clock {
  now(): Date;
}

export interface Logger {
  warn(message: string): void;
}
