/**
 * A notification is one inbox row. The row is the source of truth; delivery
 * channels (desktop, phone) fan out from it and may fail without losing it.
 */
export type Severity = "info" | "action" | "urgent";

export const SEVERITIES: readonly Severity[] = ["info", "action", "urgent"];

/** `<source>.<event>`, lowercase — e.g. `tasks.due`, `integration.auth-failed`. */
const KIND_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 2000;
export const DEFAULT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** What a producer hands to `notify()`. */
export interface NotificationInput {
  kind: string;
  title: string;
  body?: string;
  /** Same-origin path the inbox row and the toast open, e.g. `/personal`. */
  url?: string;
  severity?: Severity;
  /** The desk this belongs to; null / omitted for app-level events. */
  profileId?: string | null;
  data?: Record<string, unknown>;
  /** Rows sharing a key within `dedupeWindowMs` collapse into the first one. */
  dedupeKey?: string;
  dedupeWindowMs?: number;
}

/** Validated, trimmed input — what the repository stores. */
export interface NormalizedInput {
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  severity: Severity;
  profileId: string | null;
  data: Record<string, unknown> | null;
  dedupeKey: string | null;
  dedupeWindowMs: number;
}

export interface Notification extends Omit<NormalizedInput, "dedupeWindowMs"> {
  id: string;
  createdAt: Date;
  readAt: Date | null;
  dismissedAt: Date | null;
}

export class InvalidNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNotificationError";
  }
}

export function isValidKind(kind: string): boolean {
  return KIND_PATTERN.test(kind);
}

/** The part before the dot: what produced it (`tasks`, `integration`, …). */
export function kindSource(kind: string): string {
  return kind.split(".")[0] ?? kind;
}

/** Only same-origin paths are allowed as deep links. */
function normalizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new InvalidNotificationError(
      `notification url must be a same-origin path, got "${trimmed}"`,
    );
  }
  return trimmed;
}

export function normalizeInput(input: NotificationInput): NormalizedInput {
  if (!isValidKind(input.kind)) {
    throw new InvalidNotificationError(
      `notification kind must look like "source.event", got "${input.kind}"`,
    );
  }
  const title = input.title.trim();
  if (!title) throw new InvalidNotificationError("notification title is empty");
  const severity = input.severity ?? "info";
  if (!SEVERITIES.includes(severity)) {
    throw new InvalidNotificationError(`unknown severity "${severity}"`);
  }
  const body = input.body?.trim() || null;
  return {
    kind: input.kind,
    title: title.slice(0, TITLE_MAX_LENGTH),
    body: body ? body.slice(0, BODY_MAX_LENGTH) : null,
    url: normalizeUrl(input.url),
    severity,
    profileId: input.profileId ?? null,
    data: input.data ?? null,
    dedupeKey: input.dedupeKey?.trim() || null,
    dedupeWindowMs: input.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
  };
}

/** The instant before which an earlier row no longer counts as a duplicate. */
export function dedupeSince(now: Date, windowMs: number): Date {
  return new Date(now.getTime() - windowMs);
}
