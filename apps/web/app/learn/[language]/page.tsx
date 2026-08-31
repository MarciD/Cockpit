import { notFound } from "next/navigation";
import { LanguageLearningPage } from "@cockpit/widgets/language-learning/page";

export const dynamic = "force-dynamic";

/**
 * Thin route wrapper for the language-learning full app. All presentation lives
 * in the widget package; this file only resolves the params/search params the
 * tile passes (profile, native language, optional focus note) and renders it.
 */
export default async function LearnLanguagePage({
  params,
  searchParams,
}: {
  params: Promise<{ language: string }>;
  searchParams: Promise<{ profile?: string; native?: string; focus?: string }>;
}) {
  const { language } = await params;
  const { profile, native, focus } = await searchParams;
  if (!profile) notFound();

  return (
    <LanguageLearningPage
      profileId={profile}
      language={decodeURIComponent(language)}
      native={native ?? "German"}
      focusNote={focus}
      backHref={`/${profile}`}
    />
  );
}
