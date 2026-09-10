import { NextResponse } from "next/server";
import type { HttpMethod } from "@cockpit/widgets/server/contract";
import { widgetServerModules } from "@/lib/widget-server";

export const runtime = "nodejs";

type Params = Promise<{ widget: string; path?: string[] }>;

/**
 * Every widget's server routes, mounted under `/api/w/<widget>/<segment>/…`.
 * Same-origin and the access-token gate apply automatically (middleware). The
 * widget's route map is keyed by method and first segment; the rest of the
 * path is handed to the handler.
 */
async function dispatch(method: HttpMethod, req: Request, params: Params) {
  const { widget, path = [] } = await params;
  const mod = widgetServerModules()[widget];
  if (!mod) {
    return NextResponse.json({ error: "no such widget" }, { status: 404 });
  }
  const [head = "", ...rest] = path;
  const handler = mod.routes[`${method} ${head}`];
  if (!handler) {
    return NextResponse.json({ error: "no such route" }, { status: 404 });
  }
  return handler(req, { path: rest, url: new URL(req.url) });
}

type Ctx = { params: Params };
export const GET = (req: Request, ctx: Ctx) => dispatch("GET", req, ctx.params);
export const POST = (req: Request, ctx: Ctx) =>
  dispatch("POST", req, ctx.params);
export const PUT = (req: Request, ctx: Ctx) => dispatch("PUT", req, ctx.params);
export const PATCH = (req: Request, ctx: Ctx) =>
  dispatch("PATCH", req, ctx.params);
export const DELETE = (req: Request, ctx: Ctx) =>
  dispatch("DELETE", req, ctx.params);
