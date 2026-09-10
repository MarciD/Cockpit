import type { Notification, Severity } from "./domain/notification";

/** The JSON shape `/api/notifications` returns; dates as ISO strings. */
export interface NotificationDto {
  id: string;
  profileId: string | null;
  kind: string;
  severity: Severity;
  title: string;
  body: string | null;
  url: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

export interface InboxDto {
  notifications: NotificationDto[];
  unread: number;
  serverTime: string;
}

export function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    profileId: n.profileId,
    kind: n.kind,
    severity: n.severity,
    title: n.title,
    body: n.body,
    url: n.url,
    data: n.data,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
  };
}
