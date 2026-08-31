import { integrationError } from "./errors";
import { BlockedUrlError } from "./net";

export interface JiraConfig {
  /** Jira Cloud site host, e.g. "your-org.atlassian.net". */
  site: string;
  /** Account email (Basic auth username). */
  email: string;
  /** API token (Basic auth password). */
  token: string;
}

/**
 * Bare Jira Cloud host. The site is interpolated straight into a request URL,
 * so anything beyond a hostname (a path, a query, credentials) would rewrite
 * the endpoint rather than point at a different server.
 */
function jiraHost(site: string): string {
  const host = site
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    throw new BlockedUrlError(
      `"${site}" is not a valid Jira site host (expected e.g. your-org.atlassian.net).`,
    );
  }
  return host;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  url: string;
}

interface RawSearch {
  issues?: Array<{
    key: string;
    fields?: { summary?: string; status?: { name?: string } };
  }>;
}

/**
 * Issues assigned to the authenticated user. Uses the current search endpoint
 * (`/rest/api/3/search/jql`) — the old `/search` was shut down through 2025.
 */
export async function listMyIssues(
  config: JiraConfig,
  signal?: AbortSignal,
): Promise<JiraIssue[]> {
  const host = jiraHost(config.site);
  const auth = Buffer.from(`${config.email}:${config.token}`).toString(
    "base64",
  );

  const res = await fetch(`https://${host}/rest/api/3/search/jql`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      jql: "assignee = currentUser() ORDER BY updated DESC",
      maxResults: 20,
      fields: ["summary", "status"],
    }),
    signal,
  });
  if (!res.ok) throw await integrationError("Jira", res, "Jira request");

  const data = (await res.json()) as RawSearch;
  return (data.issues ?? []).map((issue) => ({
    key: issue.key,
    summary: issue.fields?.summary ?? "",
    status: issue.fields?.status?.name ?? "",
    url: `https://${host}/browse/${issue.key}`,
  }));
}
