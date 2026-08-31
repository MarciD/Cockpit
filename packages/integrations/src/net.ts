/**
 * Outbound-URL guard for server-side fetches.
 *
 * cockpit fetches URLs the client supplies (RSS feeds, iCal addresses, a
 * self-hosted GitLab base). Unchecked, that turns any `/api/*` route into an
 * SSRF proxy: a request for `http://169.254.169.254/…` or a neighbour on the
 * LAN would be made *by the server*, from inside the network, and cached.
 *
 * Two levels, because the trust differs:
 *
 * - `assertPublicHttpUrl` — for URLs an unauthenticated caller can hand us
 *   (feeds, calendars). Public hosts only. `COCKPIT_ALLOW_PRIVATE_FETCH=1`
 *   opts out for people whose feeds really are internal.
 * - `assertFetchableUrl` — for a provider base URL the operator typed into a
 *   widget's connection and that lives in the credential store. Private hosts
 *   stay allowed: a GitLab on `10.x` is a normal setup, not an attack.
 */

/** Thrown instead of making the request. Surfaces as a 400, not a 500. */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Literal IPv4/IPv6 ranges that must never be reachable from a fetch. */
const BLOCKED_V4 = [
  /^0\./, // "this network"
  /^10\./, // private
  /^127\./, // loopback
  /^169\.254\./, // link-local + cloud metadata
  /^172\.(1[6-9]|2\d|3[01])\./, // private
  /^192\.168\./, // private
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT
  /^19[89]\.1[89]\./, // benchmarking
  /^22[4-9]\.|^2[3-9]\d\./, // multicast + reserved
];

/** Hostnames that resolve to the host itself on essentially every machine. */
const BLOCKED_NAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
]);

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_NAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true;

  // IPv6: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10).
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (/^f[cd]/.test(host)) return true;
    if (/^fe[89ab]/.test(host)) return true;
    // IPv4-mapped. `new URL()` canonicalizes ::ffff:127.0.0.1 to ::ffff:7f00:1,
    // so unpack the two hex groups back into a dotted quad before matching.
    const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const n =
        (parseInt(hex[1] ?? "0", 16) << 16) | parseInt(hex[2] ?? "0", 16);
      const quad = [24, 16, 8, 0]
        .map((shift) => (n >>> shift) & 0xff)
        .join(".");
      return BLOCKED_V4.some((re) => re.test(quad));
    }
    const dotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (dotted) return BLOCKED_V4.some((re) => re.test(dotted));
    return false;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return BLOCKED_V4.some((re) => re.test(host));
  }
  return false;
}

/**
 * Shared checks: a parseable http(s) URL with no credentials embedded. Returns
 * the parsed URL so callers can use the normalized form.
 */
function parseFetchable(raw: string, what: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(`${what} is not a valid URL.`);
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedUrlError(
      `${what} must be an http:// or https:// URL (got ${url.protocol}).`,
    );
  }
  if (url.username || url.password) {
    throw new BlockedUrlError(`${what} must not embed credentials.`);
  }
  return url;
}

/** A provider base URL from the credential store. Private hosts allowed. */
export function assertFetchableUrl(raw: string, what = "The URL"): URL {
  return parseFetchable(raw, what);
}

/**
 * A URL supplied by the client. Rejects hosts that only exist inside the
 * network, unless `COCKPIT_ALLOW_PRIVATE_FETCH=1`.
 *
 * Note this is a name/literal check, not a resolve-then-connect one: a public
 * name that resolves to a private address still gets through. Closing that
 * needs a custom DNS-pinning agent, which is out of scope for a local-first
 * dashboard whose real boundary is that it isn't exposed. See SECURITY.md.
 */
export function assertPublicHttpUrl(raw: string, what = "The URL"): URL {
  const url = parseFetchable(raw, what);
  if (process.env.COCKPIT_ALLOW_PRIVATE_FETCH === "1") return url;
  if (isPrivateHost(url.hostname)) {
    throw new BlockedUrlError(
      `${what} points at a private or loopback address (${url.hostname}). ` +
        `Set COCKPIT_ALLOW_PRIVATE_FETCH=1 to allow internal hosts.`,
    );
  }
  return url;
}
