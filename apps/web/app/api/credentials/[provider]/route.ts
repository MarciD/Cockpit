import { NextResponse } from "next/server";
import {
  deleteProviderConfig,
  setProviderConfig,
  type Provider,
} from "@/lib/credentials";

export const runtime = "nodejs";

const PROVIDERS: readonly Provider[] = [
  "gitlab",
  "jira",
  "google",
  "anthropic",
];

function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

function isValid(provider: Provider, body: Record<string, unknown>): boolean {
  if (provider === "gitlab") {
    return typeof body.baseUrl === "string" && typeof body.token === "string";
  }
  if (provider === "jira") {
    return (
      typeof body.site === "string" &&
      typeof body.email === "string" &&
      typeof body.token === "string"
    );
  }
  if (provider === "google") {
    return typeof body.icalUrl === "string" && body.icalUrl.length > 0;
  }
  if (provider === "anthropic") {
    return typeof body.apiKey === "string" && body.apiKey.length > 0;
  }
  return true;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !isValid(provider, body)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  await setProviderConfig(provider, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  await deleteProviderConfig(provider);
  return NextResponse.json({ ok: true });
}
