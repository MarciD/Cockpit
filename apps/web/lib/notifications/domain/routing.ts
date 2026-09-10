/**
 * Which channels a kind fans out to, and when the phone stays quiet. The inbox
 * row always exists; routing only concerns the external channels.
 */
export type ChannelId = "desktop" | "phone";

export const CHANNEL_IDS: readonly ChannelId[] = ["desktop", "phone"];

/** The row every kind without its own entry falls back to. */
export const DEFAULT_KIND = "*";

/** Kinds cockpit raises today; widgets add theirs here as they land. */
export const KIND_LABELS: Record<string, string> = {
  "tasks.due": "Recurring tasks",
  "integration.auth-failed": "Integrations · reconnect",
  "scheduler.job-failed": "Scheduler · job failed",
  "system.test": "Test messages",
};

export const DEFAULT_PREFERENCES: Record<string, ChannelId[]> = {
  [DEFAULT_KIND]: ["desktop", "phone"],
  "scheduler.job-failed": ["desktop"],
  "integration.auth-failed": ["desktop"],
};

export interface QuietHours {
  from: string; // 'HH:MM'
  to: string; // 'HH:MM'; earlier than `from` means overnight
}

export interface RoutingPreferences {
  byKind: Record<string, ChannelId[]>;
  quiet: QuietHours | null;
}

export const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isChannelId(value: unknown): value is ChannelId {
  return (
    typeof value === "string" &&
    (CHANNEL_IDS as readonly string[]).includes(value)
  );
}

export function channelsFor(
  kind: string,
  byKind: Record<string, ChannelId[]>,
): ChannelId[] {
  return byKind[kind] ?? byKind[DEFAULT_KIND] ?? [];
}

function minutesOf(clock: string): number | null {
  if (!CLOCK_PATTERN.test(clock)) return null;
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Overnight ranges wrap: 23:00–07:00 covers 23:30 and 06:59, not 12:00. */
export function isQuietTime(now: Date, quiet: QuietHours | null): boolean {
  if (!quiet) return false;
  const from = minutesOf(quiet.from);
  const to = minutesOf(quiet.to);
  if (from === null || to === null || from === to) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return from < to
    ? current >= from && current < to
    : current >= from || current < to;
}

export interface Routing {
  channels: ChannelId[];
  quiet: boolean;
}

/**
 * The external channels this kind reaches right now. An explicit `override`
 * (a producer's per-item choice) replaces the preferences; quiet hours hold
 * everything either way.
 */
export function routeFor(
  kind: string,
  prefs: RoutingPreferences,
  now: Date,
  override: ChannelId[] | null = null,
): Routing {
  const quiet = isQuietTime(now, prefs.quiet);
  const channels = override ?? channelsFor(kind, prefs.byKind);
  return { channels: quiet ? [] : channels, quiet };
}
