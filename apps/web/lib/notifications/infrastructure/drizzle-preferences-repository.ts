import {
  deleteNotificationPreference,
  getNotificationSettings,
  listNotificationPreferences,
  upsertNotificationPreference,
  upsertNotificationSettings,
  type CockpitDb,
} from "@cockpit/db";
import type { PreferencesRepository, StoredPreferences } from "../domain/ports";
import {
  DEFAULT_PREFERENCES,
  isChannelId,
  type ChannelId,
  type QuietHours,
} from "../domain/routing";

export class DrizzlePreferencesRepository implements PreferencesRepository {
  constructor(
    private readonly db: CockpitDb,
    /** `COCKPIT_PUBLIC_URL`, used until a URL is saved in the settings. */
    private readonly envPublicUrl: string | null,
  ) {}

  load(): StoredPreferences {
    const rows = listNotificationPreferences(this.db);
    const byKind: Record<string, ChannelId[]> = { ...DEFAULT_PREFERENCES };
    for (const row of rows) {
      const channels = Array.isArray(row.channelsJson)
        ? (row.channelsJson as unknown[]).filter(isChannelId)
        : [];
      byKind[row.kind] = channels;
    }
    const settings = getNotificationSettings(this.db);
    const quiet: QuietHours | null =
      settings?.quietFrom && settings.quietTo
        ? { from: settings.quietFrom, to: settings.quietTo }
        : null;
    return {
      byKind,
      quiet,
      publicUrl: settings?.publicUrl ?? this.envPublicUrl,
    };
  }

  /** The given map is authoritative: rows it lacks are removed. */
  saveByKind(byKind: Record<string, ChannelId[]>): void {
    const existing = new Set(
      listNotificationPreferences(this.db).map((r) => r.kind),
    );
    for (const [kind, channels] of Object.entries(byKind)) {
      upsertNotificationPreference(this.db, kind, channels);
      existing.delete(kind);
    }
    for (const kind of existing) deleteNotificationPreference(this.db, kind);
  }

  saveSettings(settings: {
    quiet: QuietHours | null;
    publicUrl: string | null;
  }): void {
    upsertNotificationSettings(this.db, {
      quietFrom: settings.quiet?.from ?? null,
      quietTo: settings.quiet?.to ?? null,
      publicUrl: settings.publicUrl,
    });
  }
}
