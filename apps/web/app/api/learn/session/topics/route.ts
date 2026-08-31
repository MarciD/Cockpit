import { NextResponse } from "next/server";
import { CURATED_TOPICS } from "@/lib/language-learning/domain/topic";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ topics: CURATED_TOPICS });
}
