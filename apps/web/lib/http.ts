import { NextResponse } from "next/server";
import { BlockedUrlError } from "@cockpit/integrations";

/**
 * A rejected outbound URL is the caller's fault, not ours — answer 400 with the
 * guard's explanation. Anything else is a real failure and rethrows.
 */
export function urlErrorResponse(err: unknown): NextResponse {
  if (err instanceof BlockedUrlError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  throw err;
}
