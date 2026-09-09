import {
  dedupeSince,
  normalizeInput,
  type Notification,
  type NotificationInput,
} from "../domain/notification";
import type {
  Clock,
  Logger,
  NotificationChannel,
  NotificationRepository,
} from "../domain/ports";

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * The one entry point producers call. It never throws: a producer is usually a
 * scheduled job or a cache refresh, and a broken notification must not take
 * that down with it. Invalid input and failed deliveries are logged instead.
 */
export class NotifyService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly channels: readonly NotificationChannel[],
    private readonly clock: Clock,
    private readonly log: Logger,
    private readonly newId: () => string,
  ) {}

  async notify(input: NotificationInput): Promise<Notification | null> {
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
      await this.deliver(row);
      return row;
    } catch (err) {
      this.log.warn(
        `notification ${input.kind} could not be stored: ${describeError(err)}`,
      );
      return null;
    }
  }

  private async deliver(row: Notification): Promise<void> {
    const results = await Promise.allSettled(
      this.channels.map((channel) => channel.deliver(row)),
    );
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        this.log.warn(
          `channel ${this.channels[i]?.id} failed for ${row.kind}: ${describeError(result.reason)}`,
        );
      }
    });
  }
}
