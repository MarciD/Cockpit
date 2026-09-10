import type { WidgetRouteContext } from "../../../server/contract";
import { languageLearningServices } from "../composition";

export async function handleGet(req: Request, ctx: WidgetRouteContext) {
  const profileId = ctx.url.searchParams.get("profileId");
  const language = ctx.url.searchParams.get("language");
  const native = ctx.url.searchParams.get("native") ?? "translation";
  if (!profileId || !language) {
    return new Response("profileId and language required", { status: 400 });
  }

  const { importExport } = languageLearningServices();
  const csv = await importExport.export({ profileId, language, native });
  const filename = `state-${language.toLowerCase()}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
