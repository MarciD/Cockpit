/**
 * Types only, safe for client bundles. `dto.ts` carries the server-side mapper
 * and stays out of "use client" files.
 */
export type { InboxDto, NotificationDto } from "./dto";
export type { Severity } from "./domain/notification";
export type { ChannelId } from "./domain/routing";
export type { DeliveryOutcome as DeliveryOutcomeDto } from "./domain/ports";

/** `GET /api/notifications/preferences` as the client sees it (dates as strings). */
export interface PreferencesViewDto {
  kinds: { kind: string; label: string }[];
  channels: {
    id: import("./domain/routing").ChannelId;
    label: string;
    availability: { ok: boolean; detail: string };
    lastDelivery: {
      status: "sent" | "failed" | "skipped";
      detail: string | null;
      at: string;
    } | null;
  }[];
  byKind: Record<string, import("./domain/routing").ChannelId[]>;
  quiet: { from: string; to: string } | null;
  quietNow: boolean;
  publicUrl: string | null;
}
