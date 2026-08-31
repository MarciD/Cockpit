import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import {
  getProfile,
  listInstances,
  listLayouts,
  listProfiles,
  recordUsage,
} from "@cockpit/db";
import { AppShell } from "@/components/app-shell";
import { ProfileView } from "@/components/profile-view";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ profile: string }>;
}) {
  const { profile } = await params;
  const db = getDb();

  const prof = getProfile(db, profile);
  if (!prof) notFound();

  recordUsage(db, {
    id: randomUUID(),
    profileId: profile,
    kind: "open-profile",
  });

  const allProfiles = listProfiles(db).map((p) => ({
    id: p.id,
    name: p.name,
    accent: p.accent,
    monogram: p.monogram,
  }));

  const instances = listInstances(db, profile).map((row) => ({
    instanceId: row.id,
    profileId: row.profileId,
    widgetId: row.widgetId,
    config: row.config,
  }));

  const initialLayouts: Record<string, unknown> = {};
  for (const row of listLayouts(db, profile)) {
    initialLayouts[row.breakpoint] = row.layoutJson;
  }

  return (
    <AppShell profiles={allProfiles} activeId={profile}>
      <ProfileView
        profileId={profile}
        name={prof.name}
        kind={prof.kind}
        accent={prof.accent}
        instances={instances}
        initialLayouts={initialLayouts}
      />
    </AppShell>
  );
}
