import type {
  ChannelAvailability,
  Clock,
  DeliveryLog,
  DeliveryRecord,
  NotificationChannel,
  PreferencesRepository,
} from "../domain/ports";
import { isValidKind } from "../domain/notification";
import {
  CLOCK_PATTERN,
  DEFAULT_KIND,
  KIND_LABELS,
  isChannelId,
  isQuietTime,
  type ChannelId,
  type QuietHours,
} from "../domain/routing";

export class InvalidPreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPreferencesError";
  }
}

export interface ChannelView {
  id: ChannelId;
  label: string;
  availability: ChannelAvailability;
  lastDelivery: DeliveryRecord | null;
}

export interface PreferencesView {
  kinds: { kind: string; label: string }[];
  channels: ChannelView[];
  byKind: Record<string, ChannelId[]>;
  quiet: QuietHours | null;
  quietNow: boolean;
  publicUrl: string | null;
}

export interface PreferencesPatch {
  byKind?: unknown;
  quiet?: unknown;
  publicUrl?: unknown;
}

function parseByKind(value: unknown): Record<string, ChannelId[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidPreferencesError("byKind must be an object");
  }
  const out: Record<string, ChannelId[]> = {};
  for (const [kind, channels] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (kind !== DEFAULT_KIND && !isValidKind(kind)) {
      throw new InvalidPreferencesError(`"${kind}" is not a notification kind`);
    }
    if (!Array.isArray(channels) || !channels.every(isChannelId)) {
      throw new InvalidPreferencesError(
        `channels for "${kind}" must be desktop/phone`,
      );
    }
    out[kind] = Array.from(new Set(channels));
  }
  if (!out[DEFAULT_KIND]) {
    throw new InvalidPreferencesError(`byKind needs a "${DEFAULT_KIND}" row`);
  }
  return out;
}

function parseQuiet(value: unknown): QuietHours | null {
  if (value === null || value === undefined) return null;
  const q = value as { from?: unknown; to?: unknown };
  if (
    typeof q.from !== "string" ||
    typeof q.to !== "string" ||
    !CLOCK_PATTERN.test(q.from) ||
    !CLOCK_PATTERN.test(q.to)
  ) {
    throw new InvalidPreferencesError("quiet hours must be two HH:MM times");
  }
  return { from: q.from, to: q.to };
}

function parsePublicUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new InvalidPreferencesError("publicUrl must be a string");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new InvalidPreferencesError(
      "publicUrl must be an absolute http(s) URL",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidPreferencesError("publicUrl must use http or https");
  }
  return url.href.replace(/\/$/, "");
}

/** Reads and validates what the settings panel shows and saves. */
export class PreferencesService {
  constructor(
    private readonly prefs: PreferencesRepository,
    private readonly channels: readonly NotificationChannel[],
    private readonly deliveries: DeliveryLog,
    private readonly clock: Clock,
  ) {}

  async get(): Promise<PreferencesView> {
    const stored = this.prefs.load();
    const channels = await Promise.all(
      this.channels.map(async (channel) => ({
        id: channel.id,
        label: channel.label,
        availability: await channel.availability(),
        lastDelivery: this.deliveries.latest(channel.id) ?? null,
      })),
    );
    const known = new Set([
      ...Object.keys(KIND_LABELS),
      ...Object.keys(stored.byKind),
    ]);
    known.delete(DEFAULT_KIND);
    return {
      kinds: [...known]
        .sort()
        .map((kind) => ({ kind, label: KIND_LABELS[kind] ?? kind })),
      channels,
      byKind: stored.byKind,
      quiet: stored.quiet,
      quietNow: isQuietTime(this.clock.now(), stored.quiet),
      publicUrl: stored.publicUrl,
    };
  }

  update(patch: PreferencesPatch): void {
    const current = this.prefs.load();
    if (patch.byKind !== undefined)
      this.prefs.saveByKind(parseByKind(patch.byKind));
    if (patch.quiet !== undefined || patch.publicUrl !== undefined) {
      this.prefs.saveSettings({
        quiet:
          patch.quiet !== undefined ? parseQuiet(patch.quiet) : current.quiet,
        publicUrl:
          patch.publicUrl !== undefined
            ? parsePublicUrl(patch.publicUrl)
            : current.publicUrl,
      });
    }
  }
}
