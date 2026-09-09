/**
 * Types only, safe for client bundles. `dto.ts` carries the server-side mapper
 * and stays out of "use client" files.
 */
export type { InboxDto, NotificationDto } from "./dto";
export type { Severity } from "./domain/notification";
