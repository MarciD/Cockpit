import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Stand-in data source so the sample custom-api widget has something to show. */
export function GET() {
  return NextResponse.json({
    items: [
      {
        id: "1",
        label: "custom-api widget works",
        hint: "served from /api/demo",
      },
      { id: "2", label: "TanStack Query fetched this" },
      { id: "3", label: "loading / error / success states wired" },
    ],
  });
}
