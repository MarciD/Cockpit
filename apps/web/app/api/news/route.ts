import { NextResponse } from "next/server";
import { assertPublicHttpUrl } from "@cockpit/integrations";
import { urlErrorResponse } from "@/lib/http";
import { getNewsData } from "@/lib/integration-cache";

export const runtime = "nodejs";

const MAX_LIMIT = 30;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const feeds = sp.getAll("feed").filter(Boolean);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get("limit")) || 8));
  if (feeds.length === 0) {
    return NextResponse.json({ error: "feed required" }, { status: 400 });
  }
  // Feed URLs come straight from widget config, i.e. from the client.
  try {
    for (const feed of feeds) assertPublicHttpUrl(feed, "The feed URL");
  } catch (err) {
    return urlErrorResponse(err);
  }

  const force = sp.get("refresh") === "1";
  return NextResponse.json(await getNewsData(feeds, limit, force));
}
