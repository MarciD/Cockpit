import { assertFetchableUrl } from "@cockpit/integrations";
import type { Notification, Severity } from "../domain/notification";
import { kindSource } from "../domain/notification";
import type {
  ChannelAvailability,
  DeliveryContext,
  NotificationChannel,
} from "../domain/ports";

export interface NtfyConfig {
  baseUrl: string;
  topic: string;
  token?: string;
}

const TIMEOUT_MS = 10_000;
/** ntfy caps a message at 4 KB; keep well under it. */
const MESSAGE_MAX_LENGTH = 1000;

const PRIORITY: Record<Severity, number> = { info: 3, action: 4, urgent: 5 };

const TAGS: Record<string, string> = {
  tasks: "alarm_clock",
  integration: "key",
  scheduler: "warning",
  system: "white_check_mark",
};

/**
 * Phone push through ntfy (ntfy.sh or self-hosted). One JSON POST to the server
 * root; the topic is the address and, on the public server, the only secret,
 * so the settings panel suggests a long random one. `click` needs the public
 * URL the phone can reach, otherwise the message arrives without a link.
 */
export class NtfyChannel implements NotificationChannel {
  readonly id = "phone" as const;
  readonly label = "Phone (ntfy)";

  constructor(private readonly config: () => Promise<NtfyConfig | null>) {}

  async availability(): Promise<ChannelAvailability> {
    const cfg = await this.config();
    if (!cfg?.baseUrl?.trim() || !cfg.topic?.trim()) {
      return { ok: false, detail: "not connected" };
    }
    let host: string;
    try {
      host = assertFetchableUrl(cfg.baseUrl, "The ntfy server URL").host;
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
    return { ok: true, detail: `${cfg.topic.trim()} @ ${host}` };
  }

  async deliver(n: Notification, context: DeliveryContext): Promise<void> {
    const cfg = await this.config();
    if (!cfg) throw new Error("ntfy is not connected");
    const base = assertFetchableUrl(cfg.baseUrl, "The ntfy server URL");
    const endpoint = `${base.origin}${base.pathname.replace(/\/$/, "")}`;
    const click =
      n.url && context.publicUrl
        ? new URL(n.url, context.publicUrl).href
        : undefined;

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (cfg.token?.trim()) headers.authorization = `Bearer ${cfg.token.trim()}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        topic: cfg.topic.trim(),
        title: n.title,
        message: (n.body ?? n.title).slice(0, MESSAGE_MAX_LENGTH),
        priority: PRIORITY[n.severity],
        tags: [TAGS[kindSource(n.kind)] ?? "bell"],
        ...(click
          ? {
              click,
              actions: [{ action: "view", label: "Open cockpit", url: click }],
            }
          : {}),
      }),
    });
    if (!res.ok) throw new Error(`ntfy responded HTTP ${res.status}`);
  }
}
