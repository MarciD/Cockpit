import { NextResponse } from "next/server";
import type {
  GitLabConfig,
  GoogleCalendarConfig,
  JiraConfig,
} from "@cockpit/integrations";
import { getProviderConfig } from "@/lib/credentials";

export const runtime = "nodejs";

/** Connection status per provider. Never returns secrets. */
export async function GET() {
  const gitlab = await getProviderConfig<GitLabConfig>("gitlab");
  const jira = await getProviderConfig<JiraConfig>("jira");
  const google = await getProviderConfig<GoogleCalendarConfig>("google");
  const anthropic = await getProviderConfig<{ apiKey: string }>("anthropic");
  return NextResponse.json({
    gitlab: gitlab
      ? { connected: true, baseUrl: gitlab.baseUrl }
      : { connected: false },
    jira: jira
      ? { connected: true, site: jira.site, email: jira.email }
      : { connected: false },
    google: google ? { connected: true } : { connected: false },
    anthropic: anthropic ? { connected: true } : { connected: false },
  });
}
