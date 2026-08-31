/**
 * The provider rejected our stored credential — expired, revoked, or missing a
 * scope. Kept distinct from a transient failure so a widget can offer
 * "reconnect" instead of a dead error string the user can't act on.
 */
export class IntegrationAuthError extends Error {
  readonly provider: string;
  readonly status: number;

  constructor(provider: string, status: number, detail?: string) {
    super(detail ?? FALLBACK_DETAIL[status] ?? "Authentication failed.");
    this.name = "IntegrationAuthError";
    this.provider = provider;
    this.status = status;
  }
}

const FALLBACK_DETAIL: Record<number, string> = {
  401: "The saved access token is invalid or has expired.",
  403: "The saved access token lacks the required permissions.",
};

/** Error payloads across providers: GitLab, Jira and OAuth-style responses. */
interface RawErrorBody {
  error_description?: unknown;
  error?: unknown;
  message?: unknown;
  errorMessages?: unknown;
}

/**
 * The provider's own explanation, if it sent one worth showing. Bodies that
 * merely restate the status (GitLab answers `{"message":"401 Unauthorized"}`)
 * are dropped so the caller falls back to something actionable instead.
 */
async function detailFrom(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as RawErrorBody;
    const first = Array.isArray(body.errorMessages)
      ? body.errorMessages[0]
      : undefined;
    for (const candidate of [
      body.error_description,
      first,
      body.message,
      body.error,
    ]) {
      if (typeof candidate !== "string") continue;
      const detail = candidate.trim();
      if (detail && !detail.startsWith(String(res.status))) return detail;
    }
  } catch {
    // non-JSON or empty body — fall through
  }
  return undefined;
}

/**
 * Build the error for a failed response: `IntegrationAuthError` on 401/403 (the
 * credential needs re-entering), a plain `Error` otherwise. Consumes the body,
 * so only call this when you are about to throw:
 *
 *     if (!res.ok) throw await integrationError("GitLab", res, "GitLab request");
 */
export async function integrationError(
  provider: string,
  res: Response,
  what: string,
): Promise<Error> {
  const detail = await detailFrom(res);
  if (res.status === 401 || res.status === 403) {
    return new IntegrationAuthError(provider, res.status, detail);
  }
  return new Error(
    `${what} failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
  );
}
