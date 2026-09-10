import { notFound } from "next/navigation";
import { pageRegistry } from "@cockpit/widgets/pages";

export const dynamic = "force-dynamic";

/**
 * Generic mount for a widget's full page: `/w/<widget>?profile=<desk>&…`. The
 * page component itself lives in the widget's folder; this file only resolves
 * the route params and hands over the remaining query string.
 */
export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ widget: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { widget } = await params;
  const query = await searchParams;
  const Page = pageRegistry[widget];
  const profile = query.profile;
  if (!Page || typeof profile !== "string" || !profile) notFound();

  const rest: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key !== "profile" && typeof value === "string") rest[key] = value;
  }
  return <Page profileId={profile} params={rest} backHref={`/${profile}`} />;
}
