import {
  dedupeSince,
  normalizeInput,
  type Notification,
  type NotificationInput,
} from "../domain/notification";
import type {
  Clock,
  DeliveryContext,
  DeliveryLog,
  DeliveryOutcome,
  Logger,
  NotificationChannel,
  NotificationRepository,
  PreferencesRepository,
} from "../domain/ports";
import { routeFor } from "../domain/routing";

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export interface NotifyResult {
  notification: Notification;
  deliveries: DeliveryOutcome[];
}

/**
 * The one entry point producers call. It never throws: a producer is usually a
 * scheduled job or a cache refresh, and a broken notification must not take
 * that down with it. Invalid input and failed deliveries are logged instead.
 */
export class NotifyService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly channels: readonly NotificationChannel[],
    private readonly prefs: PreferencesRepository,
    private readonly deliveries: DeliveryLog,
    private readonly context: Omit<DeliveryContext, "publicUrl">,
    private readonly clock: Clock,
    private readonly log: Logger,
    private readonly newId: () => string,
  ) {}

  async notify(input: NotificationInput): Promise<NotifyResult | null> {
    let normalized;
    try {
      normalized = normalizeInput(input);
    } catch (err) {
      this.log.warn(`notification rejected: ${describeError(err)}`);
      return null;
    }

    try {
      const now = this.clock.now();
      if (normalized.dedupeKey) {
        const earlier = this.repo.findRecentByDedupeKey(
          normalized.dedupeKey,
          dedupeSince(now, normalized.dedupeWindowMs),
        );
        if (earlier) return null;
      }

      const { dedupeWindowMs: _window, ...stored } = normalized;
      const row = this.repo.insert({
        ...stored,
        id: this.newId(),
        createdAt: now,
      });
      const deliveries = await this.fanOut(row, now);
      return { notification: row, deliveries };
    } catch (err) {
      this.log.warn(
        `notification ${input.kind} could not be stored: ${describeError(err)}`,
      );
      return null;
    }
  }

  /** Every channel the kind is routed to gets one attempt; each is recorded. */
  private async fanOut(
    row: Notification,
    now: Date,
  ): Promise<DeliveryOutcome[]> {
    const stored = this.prefs.load();
    const routing = routeFor(row.kind, stored, now);
    const context: DeliveryContext = {
      publicUrl: stored.publicUrl,
      localUrl: this.context.localUrl,
    };
    const outcomes: DeliveryOutcome[] = [];

    for (const channel of this.channels) {
      if (!routing.channels.includes(channel.id)) {
        outcomes.push({
          channel: channel.id,
          status: "skipped",
          detail: routing.quiet ? "quiet hours" : "off for this kind",
        });
        continue;
      }
      const outcome = await this.attempt(channel, row, context);
      outcomes.push(outcome);
      this.deliveries.record({ ...outcome, notificationId: row.id, at: now });
    }
    return outcomes;
  }

  private async attempt(
    channel: NotificationChannel,
    row: Notification,
    context: DeliveryContext,
  ): Promise<DeliveryOutcome> {
    try {
      const availability = await channel.availability();
      if (!availability.ok) {
        return {
          channel: channel.id,
          status: "skipped",
          detail: availability.detail,
        };
      }
      await channel.deliver(row, context);
      return { channel: channel.id, status: "sent", detail: null };
    } catch (err) {
      const detail = describeError(err);
      this.log.warn(`channel ${channel.id} failed for ${row.kind}: ${detail}`);
      return { channel: channel.id, status: "failed", detail };
    }
  }
}
