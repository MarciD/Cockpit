import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import type { Notification } from "../domain/notification";
import { kindSource } from "../domain/notification";
import type {
  ChannelAvailability,
  DeliveryContext,
  NotificationChannel,
} from "../domain/ports";

const run = promisify(execFile);
const TIMEOUT_MS = 10_000;

/**
 * Native macOS banners through terminal-notifier (`brew install
 * terminal-notifier`). Only meaningful when cockpit runs on the Mac itself,
 * i.e. the launchd install; a Docker container has no Notification Center.
 * osascript was rejected on purpose: its banners are attributed to Script
 * Editor, silently dropped until that app is allowed, and a click does nothing.
 */
export class TerminalNotifierChannel implements NotificationChannel {
  readonly id = "desktop" as const;
  readonly label = "Desktop (macOS)";

  private binary(): string | null {
    const candidates = [
      process.env.COCKPIT_TERMINAL_NOTIFIER,
      "/opt/homebrew/bin/terminal-notifier",
      "/usr/local/bin/terminal-notifier",
    ];
    return candidates.find((c) => c && existsSync(c)) ?? null;
  }

  async availability(): Promise<ChannelAvailability> {
    if (process.platform !== "darwin") {
      return { ok: false, detail: "only on macOS (launchd install)" };
    }
    const binary = this.binary();
    return binary
      ? { ok: true, detail: `terminal-notifier at ${binary}` }
      : {
          ok: false,
          detail:
            "terminal-notifier not installed (brew install terminal-notifier)",
        };
  }

  async deliver(n: Notification, context: DeliveryContext): Promise<void> {
    const binary = this.binary();
    if (!binary) throw new Error("terminal-notifier not installed");
    const args = [
      "-title",
      "cockpit",
      "-subtitle",
      n.body ? n.title : kindSource(n.kind),
      "-message",
      n.body ?? n.title,
      "-group",
      n.dedupeKey ?? n.id,
    ];
    if (n.url) args.push("-open", new URL(n.url, context.localUrl).href);
    await run(binary, args, { timeout: TIMEOUT_MS });
  }
}
