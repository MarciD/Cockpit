import type { Notification, NormalizedInput } from "./notification";

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

/** A delivery target beyond the inbox (desktop banner, phone push, …). */
export interface NotificationChannel {
  readonly id: string;
  deliver(notification: Notification): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface Logger {
  warn(message: string): void;
}
