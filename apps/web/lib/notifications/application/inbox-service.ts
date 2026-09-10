import type { Notification } from "../domain/notification";
import type {
  Clock,
  ListOptions,
  NotificationRepository,
} from "../domain/ports";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_DAYS = 30;

/** Reading and tidying the inbox. */
export class InboxService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly clock: Clock,
  ) {}

  list(options?: ListOptions): Notification[] {
    return this.repo.list(options);
  }

  unreadCount(): number {
    return this.repo.countUnread();
  }

  setRead(id: string, read: boolean): void {
    this.repo.setRead(id, read);
  }

  markAllRead(): number {
    return this.repo.markAllRead();
  }

  dismiss(id: string): void {
    this.repo.dismiss(id);
  }

  /** Drop read or dismissed rows older than the retention window. */
  prune(retentionDays = DEFAULT_RETENTION_DAYS): number {
    const before = new Date(
      this.clock.now().getTime() - retentionDays * DAY_MS,
    );
    return this.repo.prune(before);
  }
}
