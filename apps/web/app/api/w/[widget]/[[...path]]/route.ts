import { NextResponse } from "next/server";
import type { HttpMethod } from "@cockpit/widgets/server/contract";
import { widgetServerModules } from "@/lib/widget-server";

export const runtime = "nodejs";

type Params = Promise<{ widget: string; path?: string[] }>;

/**
 * Every widget's server routes, mounted under `/api/w/<widget>/<segment>/…`.
 * Same-origin and the access-token gate apply automatically (middleware).
 *
 * A route is keyed by method and first path segment, and the rest of the path
 * reaches the handler in `ctx.path`. A widget small enough to keep its routes
 * at its own root (`GET /api/w/todo`) names them with an empty segment, and
 * then `PATCH /api/w/todo/<id>` must still reach `"PATCH "` rather than look
 * for a route called `<id>` — so the root handler is the fallback, and it
 * receives the whole path.
 */
async function dispatch(method: HttpMethod, req: Request, params: Params) {
  const { widget, path = [] } = await params;
  const mod = widgetServerModules()[widget];
  if (!mod) {
    return NextResponse.json({ error: "no such widget" }, { status: 404 });
  }
  const [head = "", ...rest] = path;
  const named = mod.routes[`${method} ${head}`];
  const handler = named ?? mod.routes[`${method} `];
  if (!handler) {
    return NextResponse.json({ error: "no such route" }, { status: 404 });
  }
  return handler(req, {
    path: named ? rest : path,
    url: new URL(req.url),
  });
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
