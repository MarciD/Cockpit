import { NextResponse } from "next/server";
import { BlockedUrlError, assertFetchableUrl } from "@cockpit/integrations";
import {
  deleteProviderConfig,
  getProviderConfig,
  setProviderConfig,
} from "@/lib/credentials";
import type { NtfyConfig } from "@/lib/notifications/infrastructure/channel-phone-ntfy";

export const runtime = "nodejs";

/** ntfy topic rules: letters, digits, `-` and `_`, up to 64 characters. */
const TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The phone channel's connection, stored under provider `ntfy` in the shared
 * credential store. Lives here rather than in `/api/credentials/[provider]`
 * because that route only knows the widget providers. The topic is returned
 * (you need it to subscribe on the phone); the token never is.
 */
export async function GET() {
  const cfg = await getProviderConfig<NtfyConfig>("ntfy");
  return NextResponse.json({
    connected: Boolean(cfg?.baseUrl && cfg.topic),
    baseUrl: cfg?.baseUrl ?? null,
    topic: cfg?.topic ?? null,
    hasToken: Boolean(cfg?.token),
  });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    baseUrl?: unknown;
    topic?: unknown;
    token?: unknown;
  } | null;
  const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!TOPIC_PATTERN.test(topic)) {
    return NextResponse.json(
      { error: "topic must be 1–64 letters, digits, - or _" },
      { status: 400 },
    );
  }
  try {
    assertFetchableUrl(baseUrl, "The ntfy server URL");
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // An empty token keeps the one already saved, so changing the topic does
  // not force re-entering the token.
  const previous = await getProviderConfig<NtfyConfig>("ntfy");
  const config: NtfyConfig = {
    baseUrl: baseUrl.replace(/\/$/, ""),
    topic,
    ...(token || previous?.token ? { token: token || previous?.token } : {}),
  };
  await setProviderConfig("ntfy", config);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await deleteProviderConfig("ntfy");
  return NextResponse.json({ ok: true });
}
