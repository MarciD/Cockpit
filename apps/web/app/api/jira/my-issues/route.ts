import { NextResponse } from "next/server";
import { getJiraData } from "@/lib/integration-cache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  return NextResponse.json(await getJiraData(force));
}
