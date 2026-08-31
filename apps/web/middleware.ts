import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Two guards, both cheap enough to run on every request. This file is on the
 * Edge runtime, so it uses Web Crypto only — no `node:crypto`.
 *
 * 1. Same-origin enforcement. cockpit has no per-request CSRF token, so any
 *    page you visit could otherwise make your browser POST to
 *    http://localhost:3000 or trigger a server-side feed fetch. A cross-origin
 *    request to /api/* is never legitimate here.
 *
 * 2. An optional shared-token gate (COCKPIT_ACCESS_TOKEN). Unset, cockpit is
 *    open — fine when it is bound to loopback. Set, every request needs the
 *    session cookie or a bearer token, which is what makes serving it to a LAN
 *    defensible. It is one shared secret, not user accounts: see SECURITY.md.
 */

/** Reachable without the token: the health probe and logging in itself. */
const PUBLIC_PATHS = new Set(["/api/health", "/login", "/api/auth"]);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Hex SHA-256. The cookie carries this rather than the token itself. */
async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent, branch-free comparison of two equal-length hex strings. */
function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** The host this request was actually addressed to, proxy included. */
function requestHost(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? null;
}

function isCrossOrigin(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false; // curl, the healthcheck, a typed-in URL
  try {
    return new URL(origin).host !== requestHost(req);
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // --- 1. same-origin ---
  // Browsers always send Origin on a state-changing request, so its absence
  // means a non-browser client with no ambient cookies to abuse — `curl -X
  // POST` keeps working. A mismatched Origin is always refused.
  const unsafe = !SAFE_METHODS.has(req.method);
  const hasOrigin = req.headers.get("origin") !== null;
  if (((unsafe && hasOrigin) || isApi) && isCrossOrigin(req)) {
    return NextResponse.json(
      { error: "cross-origin request refused" },
      { status: 403 },
    );
  }

  // --- 2. shared-token gate ---
  const token = process.env.COCKPIT_ACCESS_TOKEN?.trim();
  if (!token || PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const expected = await digest(token);
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && sameDigest(cookie, expected)) return NextResponse.next();

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && sameDigest(await digest(bearer), expected)) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything but Next's own static output and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
