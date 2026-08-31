import { NextResponse } from "next/server";
import { getWeatherData } from "@/lib/integration-cache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  const label = sp.get("label") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat/lon required" }, { status: 400 });
  }
  const force = sp.get("refresh") === "1";
  return NextResponse.json(await getWeatherData(lat, lon, label, force));
}
