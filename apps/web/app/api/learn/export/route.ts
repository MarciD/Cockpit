import { languageLearningServices } from "@/lib/language-learning/composition";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profileId");
  const language = url.searchParams.get("language");
  const native = url.searchParams.get("native") ?? "translation";
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
